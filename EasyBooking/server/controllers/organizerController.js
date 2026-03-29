import mongoose from 'mongoose';

import Event from '../models/Event.js';
import ProcessedPayment from '../models/ProcessedPayment.js';
import User from '../models/User.js';

const DEFAULT_CURRENCY = 'CAD';

const roundToCurrency = (amount) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
};

const buildAmountBreakdown = (amount) => ({
  original: {
    amount: roundToCurrency(amount),
    currency: DEFAULT_CURRENCY,
  },
});

const normalizeUser = (user) => {
  if (!user) return null;
  if (typeof user.toJSON === 'function') {
    return user.toJSON();
  }
  const plain = { ...user };
  if (plain._id && !plain.id) {
    plain.id = plain._id.toString();
    delete plain._id;
  }
  delete plain.__v;
  delete plain.password;
  return plain;
};

const withActiveAmount = (breakdown) => {
  if (!breakdown || typeof breakdown !== 'object') {
    return null;
  }

  const original =
    breakdown.original && typeof breakdown.original === 'object'
      ? { ...breakdown.original }
      : null;

  if (!original) {
    return null;
  }

  const amount = Number.isFinite(original.amount) ? Number(original.amount) : 0;
  const currency = original.currency || DEFAULT_CURRENCY;

  return {
    original,
    currency,
    amount,
  };
};

const normalizeEvent = (event, salesByEvent = new Map()) => {
  if (!event) return null;
  const plain = typeof event.toJSON === 'function' ? event.toJSON() : { ...event };
  if (plain._id && !plain.id) {
    plain.id = plain._id.toString();
    delete plain._id;
  }
  const capacity = Number(plain.capacity) || 0;
  const existingAvailable = Number(plain.available);
  const soldFromPayments = salesByEvent.get(plain.id) || 0;
  const availableFromDoc = Number.isFinite(existingAvailable) ? existingAvailable : capacity;
  const computedSold = soldFromPayments || Math.max(0, capacity - availableFromDoc);
  const sold = Math.max(0, computedSold);
  const available = Math.max(0, capacity - sold);
  const price = Number(plain.price) || 0;
  const occupancy = capacity ? Number(((sold / capacity) * 100).toFixed(2)) : 0;
  const revenue = Number((sold * price).toFixed(2));
  const potentialRevenue = Number((capacity * price).toFixed(2));

  const pricing = withActiveAmount(buildAmountBreakdown(price));
  const revenueBreakdown = withActiveAmount(buildAmountBreakdown(revenue));
  const potentialBreakdown = withActiveAmount(buildAmountBreakdown(potentialRevenue));

  return {
    ...plain,
    available,
    sold,
    occupancy,
    revenue,
    potentialRevenue,
    pricing,
    financials: {
      price: pricing,
      revenue: revenueBreakdown,
      potentialRevenue: potentialBreakdown,
    },
  };
};

export const getOrganizerMetrics = async (req, res, next) => {
  try {
    const { organizerId, organizer: organizerName } = req.query || {};
    let organizerUser = null;

    if (req.user?.role === 'admin' && organizerId) {
      organizerUser = await User.findById(organizerId);
      if (!organizerUser) {
        return res.status(404).json({ message: 'Organizer not found' });
      }
    }

    if (!organizerUser && req.user) {
      organizerUser = await User.findById(req.user.id);
    }

    if (!organizerUser) {
      return res.status(404).json({ message: 'Organizer profile not found' });
    }

    const identifiers = new Set();
    if (organizerUser.fullname) identifiers.add(organizerUser.fullname);
    if (organizerUser.email) identifiers.add(organizerUser.email);
    if (organizerName) identifiers.add(String(organizerName));

    let match = {};
    if (identifiers.size > 0 && (req.user.role !== 'admin' || organizerId || organizerName)) {
      match = { organizer: { $in: Array.from(identifiers) } };
    }

    const events = await Event.find(match).sort({ startsAt: 1 });

    const eventIds = events.map((event) => event._id).filter(Boolean);
    const normalizedEventIds = eventIds.map((id) =>
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );

    const sales = normalizedEventIds.length
      ? await ProcessedPayment.aggregate([
          {
            $match: {
              status: 'processed',
              event: { $in: normalizedEventIds },
            },
          },
          {
            $group: {
              _id: '$event',
              ticketsSold: { $sum: '$quantity' },
            },
          },
        ])
      : [];

    const salesMap = sales.reduce((acc, item) => {
      if (item?._id) {
        acc.set(item._id.toString(), Number(item.ticketsSold) || 0);
      }
      return acc;
    }, new Map());

    const normalizedEvents = events.map((event) => normalizeEvent(event, salesMap));

    const now = new Date();
    const summary = normalizedEvents.reduce(
      (acc, event) => {
        const capacity = Number(event.capacity) || 0;
        const available = Number(event.available) || 0;
        const sold = Number(event.sold) || 0;
        acc.totalEvents += 1;
        acc.totalCapacity += capacity;
        acc.totalAvailable += available;
        acc.totalTicketsSold += sold;
        acc.revenueGenerated += Number(event.revenue) || 0;
        acc.potentialRevenue += Number(event.potentialRevenue) || 0;
        if (event.startsAt && new Date(event.startsAt) >= now) {
          acc.upcomingEvents += 1;
        }
        return acc;
      },
      {
        totalEvents: 0,
        upcomingEvents: 0,
        totalCapacity: 0,
        totalAvailable: 0,
        totalTicketsSold: 0,
        revenueGenerated: 0,
        potentialRevenue: 0,
      }
    );

    const occupancyRate = summary.totalCapacity
      ? Number(((summary.totalTicketsSold / summary.totalCapacity) * 100).toFixed(2))
      : 0;
    const averageTicketPrice = summary.totalTicketsSold
      ? Number((summary.revenueGenerated / summary.totalTicketsSold).toFixed(2))
      : 0;

    const aggregateFinancials = normalizedEvents.reduce(
      (acc, event) => {
        const revenueAmount = Number(event?.financials?.revenue?.amount);
        const potentialAmount = Number(event?.financials?.potentialRevenue?.amount);

        if (Number.isFinite(revenueAmount)) {
          acc.revenueGenerated += revenueAmount;
        }

        if (Number.isFinite(potentialAmount)) {
          acc.potentialRevenue += potentialAmount;
        }

        return acc;
      },
      { revenueGenerated: 0, potentialRevenue: 0 }
    );

    const revenueAmount = roundToCurrency(aggregateFinancials.revenueGenerated) ?? 0;
    const potentialAmount =
      roundToCurrency(aggregateFinancials.potentialRevenue) ?? 0;
    const averageTicketPriceAmount = summary.totalTicketsSold
      ? roundToCurrency(
          aggregateFinancials.revenueGenerated / summary.totalTicketsSold
        ) ?? 0
      : 0;

    const summaryFinancials = {
      currency: DEFAULT_CURRENCY,
      revenueGenerated: {
        amount: revenueAmount,
        currency: DEFAULT_CURRENCY,
      },
      potentialRevenue: {
        amount: potentialAmount,
        currency: DEFAULT_CURRENCY,
      },
      averageTicketPrice: {
        amount: averageTicketPriceAmount,
        currency: DEFAULT_CURRENCY,
      },
    };

    const upcomingEvents = normalizedEvents
      .filter((event) => event.startsAt && new Date(event.startsAt) >= now)
      .slice(0, 5);

    const topPerformers = [...normalizedEvents]
      .sort((a, b) => (b.sold || 0) - (a.sold || 0))
      .slice(0, 5);

    return res.json({
      organizer: normalizeUser(organizerUser),
      summary: {
        ...summary,
        occupancyRate,
        averageTicketPrice,
        lastUpdated: new Date().toISOString(),
        financials: summaryFinancials,
      },
      events: normalizedEvents,
      upcomingEvents,
      topPerformers,
    });
  } catch (error) {
    return next(error);
  }
};

export const acknowledgeNotification = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id: notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({ message: 'Notification id is required' });
    }

    const organizerUser = await User.findById(req.user.id);

    if (!organizerUser) {
      return res.status(404).json({ message: 'Organizer profile not found' });
    }

    const notifications = Array.isArray(organizerUser.notifications)
      ? organizerUser.notifications
      : [];

    const target = notifications.find((entry) => {
      if (!entry) return false;
      if (entry.id && entry.id === notificationId) {
        return true;
      }
      if (entry._id && entry._id.toString() === notificationId) {
        return true;
      }
      return false;
    });

    if (!target) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (!target.readAt) {
      target.readAt = new Date();
    }

    await organizerUser.save();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export default {
  getOrganizerMetrics,
  acknowledgeNotification,
};
