import mongoose from 'mongoose';

import Event from '../models/Event.js';
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
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const SORTABLE_FIELDS = new Set([
  'startsAt',
  'price',
  'createdAt',
  'title',
  'available',
  'capacity',
]);
const SEARCHABLE_FIELDS = ['title', 'subtitle', 'organizer', 'place.name', 'place.city'];

const clampNumber = (value, { min, max } = {}) => {
  let result = value;
  if (typeof min === 'number' && result < min) {
    result = min;
  }
  if (typeof max === 'number' && result > max) {
    result = max;
  }
  return result;
};

const parsePositiveInteger = (value, fallback, { min = 1, max } = {}) => {
  const parsed = Number.parseInt(value, 10);
  const base = Number.isNaN(parsed) ? fallback ?? min ?? 1 : parsed;
  return clampNumber(base, { min, max });
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSearchTerm = (term) => {
  if (typeof term !== 'string') return '';
  return term.trim().replace(/\s+/g, ' ');
};

const buildSearchQuery = (searchTerm) => {
  const normalized = normalizeSearchTerm(searchTerm);
  if (!normalized) return {};

  const tokens = normalized.split(' ');
  return {
    $and: tokens.map((token) => {
      const regex = new RegExp(escapeRegex(token), 'i');
      return {
        $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: { $regex: regex } })),
      };
    }),
  };
};

const parseSortToken = (token) => {
  if (!token) return {};

  let field = token;
  let direction;

  if (token.includes(':')) {
    const [fieldPart, directionPart] = token.split(':', 2);
    field = fieldPart;
    direction = directionPart;
  }

  if (field.startsWith('-')) {
    field = field.slice(1);
    direction = 'desc';
  }

  return { field, direction };
};

const resolveSort = (query) => {
  const rawSort = typeof query.sort === 'string' ? query.sort.trim() : '';
  const { field: sortFieldFromSort, direction: sortDirectionFromSort } = parseSortToken(rawSort);

  let field = sortFieldFromSort;
  let direction = sortDirectionFromSort;

  if (!field && typeof query.sortBy === 'string') {
    field = query.sortBy.trim();
  }

  if (!direction && typeof query.sortOrder === 'string') {
    direction = query.sortOrder.trim();
  }

  if (!SORTABLE_FIELDS.has(field)) {
    field = 'startsAt';
  }

  const normalizedDirection = String(direction || '').toLowerCase() === 'desc' ? -1 : 1;

  const sort = { [field]: normalizedDirection };
  if (field !== 'createdAt') {
    sort.createdAt = -1;
  }

  return sort;
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

const buildEventResponse = (event) => {
  if (!event) return null;

  const plain = typeof event.toJSON === 'function' ? event.toJSON() : { ...event };
  const pricing = withActiveAmount(buildAmountBreakdown(plain.price));

  return {
    ...plain,
    pricing,
  };
};

export const listEvents = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, { min: 1 });
    const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT, {
      min: 1,
      max: MAX_LIMIT,
    });

    const searchQuery = buildSearchQuery(req.query.search);
    const query = { ...searchQuery, isApproved: true };
    const sort = resolveSort(req.query);

    const skip = (page - 1) * limit;

    const [events, totalItems] = await Promise.all([
      Event.find(query).sort(sort).skip(skip).limit(limit),
      Event.countDocuments(query),
    ]);

    const decoratedEvents = events.map((event) => buildEventResponse(event));

    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

    return res.json({
      events: decoratedEvents,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: totalPages > 0 && page < totalPages,
        hasPrevPage: totalItems > 0 && page > 1,
      },

    });
  } catch (error) {
    return next(error);
  }
};

export const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findById(id);

    if (!event || !event.isApproved) {
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.json({ event: buildEventResponse(event) });
  } catch (error) {
    return next(error);
  }
};

export const createEvent = async (req, res, next) => {
  try {
    const payload = req.validatedEvent || req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ message: 'Invalid request payload' });
    }

    const event = await Event.create(payload);

    return res.status(201).json({ event: event.toJSON() });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors || {}).map((err) => ({
        field: err.path,
        message: err.message,
      }));

      return res.status(400).json({
        message: 'Event validation failed',
        errors,
      });
    }

    return next(error);
  }
};

export const decrementAvailable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ticketsSold, quantity, amount, value } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const rawValue = ticketsSold ?? quantity ?? amount ?? value;
    const parsed = Number.parseInt(rawValue, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({ message: 'A positive integer quantity is required' });
    }

    const updatedEvent = await Event.findOneAndUpdate(
      { _id: id, available: { $gte: parsed } },
      { $inc: { available: -parsed } },
      { new: true }
    );

    if (!updatedEvent) {
      const eventExists = await Event.exists({ _id: id });
      if (!eventExists) {
        return res.status(404).json({ message: 'Event not found' });
      }

      return res
        .status(400)
        .json({ message: 'Not enough tickets available to complete the operation' });
    }

    return res.json({ event: updatedEvent.toJSON() });
  } catch (error) {
    return next(error);
  }
};

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const EVENT_UPDATABLE_FIELDS = new Set([
  'title',
  'subtitle',
  'imageUrl',
  'startsAt',
  'hour',
  'place',
  'organizer',
  'price',
  'currency',
  'capacity',
  'available',
  'description',
]);

export const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const mergedPayload = req.validatedEvent
      ? { ...req.body, ...req.validatedEvent }
      : { ...req.body };

    if (req.user?.role !== 'admin') {
      const organizerUser = await User.findById(req.user?.id);

      if (!organizerUser) {
        return res.status(403).json({ message: 'Organizer profile not found' });
      }

      const identifiers = new Set(
        [
          organizerUser.fullname,
          organizerUser.email,
          event.organizer,
          mergedPayload.organizer,
        ]
          .map(normalizeString)
          .filter(Boolean)
      );

      if (!identifiers.has(normalizeString(event.organizer))) {
        return res.status(403).json({ message: 'You are not allowed to update this event' });
      }

      if (
        mergedPayload.organizer &&
        !identifiers.has(normalizeString(mergedPayload.organizer))
      ) {
        mergedPayload.organizer = event.organizer;
      }
    }

    const updates = Object.keys(mergedPayload).reduce((acc, key) => {
      if (EVENT_UPDATABLE_FIELDS.has(key)) {
        acc[key] = mergedPayload[key];
      }
      return acc;
    }, {});

    const previousCapacity = Number(event.capacity) || 0;
    const previousAvailable = Number.isFinite(Number(event.available))
      ? Number(event.available)
      : previousCapacity;
    const ticketsSold = Math.max(previousCapacity - previousAvailable, 0);

    const hasCapacityUpdate = Object.prototype.hasOwnProperty.call(updates, 'capacity');
    const hasAvailableUpdate = Object.prototype.hasOwnProperty.call(updates, 'available');

    const nextCapacity = hasCapacityUpdate
      ? Number(updates.capacity)
      : previousCapacity;

    if (Number.isNaN(nextCapacity) || nextCapacity < 1) {
      return res.status(400).json({ message: 'Capacity must be a positive number' });
    }

    if (ticketsSold > nextCapacity) {
      return res
        .status(400)
        .json({ message: 'Capacity cannot be lower than tickets already sold' });
    }

    let nextAvailable = hasAvailableUpdate
      ? Number(updates.available)
      : previousAvailable;

    if (hasAvailableUpdate && Number.isNaN(nextAvailable)) {
      return res
        .status(400)
        .json({ message: 'Available spots must be a valid number' });
    }

    if (!hasAvailableUpdate && hasCapacityUpdate) {
      nextAvailable = Math.max(nextCapacity - ticketsSold, 0);
      updates.available = nextAvailable;
    }

    if (nextAvailable < 0 || nextAvailable > nextCapacity) {
      return res
        .status(400)
        .json({ message: 'Available spots must be between 0 and the event capacity' });
    }

    const nextSold = Math.max(nextCapacity - nextAvailable, 0);

    if (nextSold < ticketsSold) {
      return res.status(400).json({
        message: 'Available spots cannot reduce the number of tickets already sold',
      });
    }

    Object.assign(event, updates);

    const updatedEvent = await event.save();

    return res.json({ event: updatedEvent.toJSON() });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors || {}).map((err) => ({
        field: err.path,
        message: err.message,
      }));

      return res.status(400).json({
        message: 'Event validation failed',
        errors,
      });
    }

    return next(error);
  }
};

export const batchCreateEvents = async (req, res, next) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'Events array is required' });
    }

    // Validation basique
    const invalid = events.find((e) => !e.title || !e.startsAt || !e.endsAt);
    if (invalid) {
      return res.status(400).json({
        message: 'Each event must include title, startsAt, and endsAt',
      });
    }

    const createdEvents = await Event.insertMany(events);

    return res.status(201).json({
      message: `${createdEvents.length} events created successfully`,
      events: createdEvents.map((e) => e.toJSON()),
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  listEvents,
  getEventById,
  createEvent,
  decrementAvailable,
  updateEvent,
  batchCreateEvents,
};
