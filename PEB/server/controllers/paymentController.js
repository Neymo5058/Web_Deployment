import mongoose from 'mongoose';
import Stripe from 'stripe';

import Event from '../models/Event.js';
import ProcessedPayment from '../models/ProcessedPayment.js';

const DEFAULT_PAYMENT_CURRENCY = 'CAD';

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key (STRIPE_SECRET_KEY) is not configured.');
  }

  if (!globalThis.__STRIPE_CLIENT__) {
    globalThis.__STRIPE_CLIENT__ = new Stripe(secretKey, {
      apiVersion: '2022-11-15',
    });
  }

  return globalThis.__STRIPE_CLIENT__;
};

const parseDecimal = (value, fallback = 0) => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const parsePositiveInteger = (value, fallback = 1) => {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
};

const toStripeAmount = (value, currency) => {
  const numeric = Number(value) || 0;
  if (ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase())) {
    return Math.round(numeric);
  }
  return Math.round(numeric * 100);
};

const normalizeBaseCurrency = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_PAYMENT_CURRENCY;
  }

  const normalized = value.trim().toUpperCase();
  return normalized === DEFAULT_PAYMENT_CURRENCY
    ? normalized
    : DEFAULT_PAYMENT_CURRENCY;
};

const buildOrderSummary = (event, quantity, taxRate, serviceFee) => {
  const pricePerTicket = Number(event.price) || 0;
  const subtotal = pricePerTicket * quantity;
  const taxes = subtotal * taxRate;
  const fees = quantity > 0 ? serviceFee : 0;
  const total = subtotal + taxes + fees;

  const currency = normalizeBaseCurrency(event.currency);

  return {
    eventId: event.id || event._id?.toString(),
    currency,
    quantity,
    pricePerTicket,
    subtotal,
    taxes,
    fees,
    total,
    taxRate,
    serviceFee,
  };
};

export const createPaymentIntent = async (req, res, next) => {
  try {
    const { eventId, quantity: rawQuantity } = req.body || {};

    if (!eventId || !mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }

    const quantity = parsePositiveInteger(rawQuantity, 1);

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (typeof event.available === 'number' && event.available < quantity) {
      return res.status(400).json({ message: 'Not enough tickets available.' });
    }

    const taxRate = parseDecimal(process.env.PAYMENT_TAX_RATE ?? 0.15, 0.15);
    const serviceFee = parseDecimal(process.env.PAYMENT_SERVICE_FEE ?? 2.99, 2.99);

    const originalSummary = buildOrderSummary(event, quantity, taxRate, serviceFee);

    if (originalSummary.total <= 0) {
      return res.status(400).json({ message: 'Invalid total amount for this order.' });
    }

    const orderSummary = {
      currency: originalSummary.currency,
      quantity: originalSummary.quantity,
      pricePerTicket: originalSummary.pricePerTicket,
      subtotal: originalSummary.subtotal,
      taxes: originalSummary.taxes,
      fees: originalSummary.fees,
      total: originalSummary.total,
      serviceFee: originalSummary.serviceFee,
      taxRate: originalSummary.taxRate,
      eventId: originalSummary.eventId,
      original: { ...originalSummary },
    };

    let stripe;
    try {
      stripe = getStripeClient();
    } catch (error) {
      return res.status(503).json({ message: error.message });
    }

    const amount = toStripeAmount(originalSummary.total, originalSummary.currency);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: originalSummary.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        eventId: originalSummary.eventId,
        quantity: String(originalSummary.quantity),
        subtotal: originalSummary.subtotal.toFixed(2),
        taxes: originalSummary.taxes.toFixed(2),
        fees: originalSummary.fees.toFixed(2),
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      orderSummary,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPaymentIntent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Invalid payment intent id.' });
    }

    let stripe;
    try {
      stripe = getStripeClient();
    } catch (error) {
      return res.status(503).json({ message: error.message });
    }

    const intent = await stripe.paymentIntents.retrieve(id);

    return res.json({
      paymentIntent: {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        customer: intent.customer,
        receiptEmail: intent.receipt_email,
        metadata: intent.metadata,
      },
    });
  } catch (error) {
    if (error && error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ message: 'Payment intent not found.' });
    }
    return next(error);
  }
};

export const confirmPaymentCompletion = async (req, res, next) => {
  try {
    const { paymentIntentId, eventId: providedEventId } = req.body || {};

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ message: 'A valid paymentIntentId is required.' });
    }

    let stripe;
    try {
      stripe = getStripeClient();
    } catch (error) {
      return res.status(503).json({ message: error.message });
    }

    let intent;
    try {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      if (error && error.type === 'StripeInvalidRequestError') {
        return res.status(404).json({ message: 'Payment intent not found.' });
      }
      throw error;
    }

    if (!intent || intent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment intent is not completed yet.' });
    }

    const metadata = intent.metadata || {};
    const eventId = metadata.eventId;
    const quantity = parsePositiveInteger(metadata.quantity, 0);

    if (!eventId || !mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({ message: 'Invalid event associated with this payment.' });
    }

    if (providedEventId && providedEventId !== eventId) {
      return res.status(400).json({ message: 'Payment data does not match the selected event.' });
    }

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ message: 'This payment is missing a valid ticket quantity.' });
    }

    try {
      const existing = await ProcessedPayment.findOne({ paymentIntentId: intent.id });
      if (existing) {
        const existingEvent = await Event.findById(existing.event);
        return res.json({
          processed: false,
          alreadyProcessed: true,
          event: existingEvent ? existingEvent.toJSON() : null,
          message: 'Tickets already deducted for this payment.',
        });
      }
    } catch (error) {
      return next(error);
    }

    let record;
    try {
      record = await ProcessedPayment.create({
        paymentIntentId: intent.id,
        event: eventId,
        quantity,
        amount: intent.amount_received ?? intent.amount ?? 0,
        currency: intent.currency ? intent.currency.toUpperCase() : undefined,
        metadata,
        status: 'pending',
      });
    } catch (error) {
      if (error && error.code === 11000) {
        const existingEvent = await Event.findById(eventId);
        return res.json({
          processed: false,
          alreadyProcessed: true,
          event: existingEvent ? existingEvent.toJSON() : null,
          message: 'Tickets already deducted for this payment.',
        });
      }
      return next(error);
    }

    try {
      const updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, available: { $gte: quantity } },
        { $inc: { available: -quantity } },
        { new: true }
      );

      if (!updatedEvent) {
        await ProcessedPayment.deleteOne({ _id: record._id });

        const exists = await Event.exists({ _id: eventId });
        if (!exists) {
          return res.status(404).json({ message: 'Event not found.' });
        }

        return res
          .status(400)
          .json({ message: 'Not enough tickets available to complete the operation.' });
      }

      record.status = 'processed';
      await record.save();

      return res.json({ processed: true, event: updatedEvent.toJSON() });
    } catch (error) {
      await ProcessedPayment.deleteOne({ _id: record._id });
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
};

export default {
  createPaymentIntent,
  getPaymentIntent,
  confirmPaymentCompletion,
};
