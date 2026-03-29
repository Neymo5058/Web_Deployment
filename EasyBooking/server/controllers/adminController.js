import mongoose from 'mongoose';

import Event from '../models/Event.js';
import ProcessedPayment from '../models/ProcessedPayment.js';
import User from '../models/User.js';
import { updateUserRole as updateUserRoleHandler } from './userController.js';

const buildPendingEventsQuery = () => ({
  $or: [
    { status: 'pending' },
    { status: { $exists: false }, isApproved: false },
  ],
});

const buildPendingEventMatch = (id) => ({
  _id: id,
  ...buildPendingEventsQuery(),
});

const escapeRegExp = (value = '') => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

const buildOrganizerMatch = (organizer) => {
  if (!organizer || typeof organizer !== 'string') {
    return null;
  }

  const normalized = organizer.trim();
  if (!normalized) {
    return null;
  }

  const regex = new RegExp(`^${escapeRegExp(normalized)}$`, 'i');
  return {
    $or: [{ fullname: regex }, { email: normalized.toLowerCase() }],
  };
};

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

export const getAdminMetrics = async (_req, res, next) => {
  try {
    const now = new Date();
    const [
      totalUsers,
      totalAdmins,
      totalOrganizers,
      totalEvents,
      events,
      recentUsers,
      pendingEventsCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'organizer' }),
      Event.countDocuments({ isApproved: true }),
      Event.find(
        { isApproved: true },
        { capacity: 1, available: 1, price: 1, organizer: 1, startsAt: 1 }
      )
        .lean()
        .exec(),
      User.find().sort({ createdAt: -1 }).limit(5),
      Event.countDocuments(buildPendingEventsQuery()),
    ]);

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

    const totals = events.reduce(
      (acc, event) => {
        const capacity = Number(event.capacity) || 0;
        const price = Number(event.price) || 0;
        const existingAvailable = Number(event.available);
        const soldFromPayments = salesMap.get(event._id?.toString()) || 0;
        const availableFromDoc = Number.isFinite(existingAvailable) ? existingAvailable : capacity;
        const computedSold = soldFromPayments || Math.max(0, capacity - availableFromDoc);
        const sold = Math.max(0, computedSold);
        const available = Math.max(0, capacity - sold);

        acc.totalCapacity += capacity;
        acc.totalAvailable += available;
        acc.ticketsSold += sold;
        acc.revenueGenerated += sold * price;
        acc.potentialRevenue += capacity * price;
        if (event.startsAt && new Date(event.startsAt) >= now) {
          acc.upcomingEvents += 1;
        }
        if (event.organizer) {
          acc.organizers.add(event.organizer);
        }
        return acc;
      },
      {
        totalCapacity: 0,
        totalAvailable: 0,
        ticketsSold: 0,
        revenueGenerated: 0,
        potentialRevenue: 0,
        upcomingEvents: 0,
        organizers: new Set(),
      }
    );

    const occupancyRate = totals.totalCapacity
      ? Number(((totals.ticketsSold / totals.totalCapacity) * 100).toFixed(2))
      : 0;

    const roleDistribution = {
      admin: totalAdmins,
      organizer: totalOrganizers,
      user: Math.max(0, totalUsers - totalAdmins - totalOrganizers),
    };

    return res.json({
      summary: {
        totalUsers,
        totalEvents,
        upcomingEvents: totals.upcomingEvents,
        activeOrganizers: totals.organizers.size,
        totalCapacity: totals.totalCapacity,
        ticketsSold: totals.ticketsSold,
        occupancyRate,
        revenueGenerated: Number(totals.revenueGenerated.toFixed(2)),
        potentialRevenue: Number(totals.potentialRevenue.toFixed(2)),
        pendingApproval: pendingEventsCount,
        lastUpdated: new Date().toISOString(),
      },
      roleDistribution,
      latestUsers: recentUsers.map((user) => normalizeUser(user)),
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminAccessOverview = async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    const summary = users.reduce(
      (acc, user) => {
        acc.total += 1;
        const role = user.role || 'user';
        acc.byRole[role] = (acc.byRole[role] || 0) + 1;
        return acc;
      },
      { total: 0, byRole: { user: 0, organizer: 0, admin: 0 } }
    );

    return res.json({
      summary: {
        totalUsers: summary.total,
        byRole: summary.byRole,
        lastUpdated: new Date().toISOString(),
      },
      users: users.map((user) => normalizeUser(user)),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserRole = (req, res, next) => updateUserRoleHandler(req, res, next);

export const getPendingEvents = async (_req, res, next) => {
  try {
    const events = await Event.find(buildPendingEventsQuery())
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json({
      summary: {
        totalPending: events.length,
        lastUpdated: new Date().toISOString(),
      },
      events: events.map((event) => {
        const { _id, ...rest } = event;
        const status =
          typeof event.status === 'string' && event.status.trim().length
            ? event.status
            : event.isApproved
              ? 'approved'
              : 'pending';
        return {
          ...rest,
          id: _id?.toString(),
          status,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
};

export const approveEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const now = new Date();
    const update = {
      status: 'approved',
      isApproved: true,
      approvedAt: now,
    };

    if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
      update.approvedBy = new mongoose.Types.ObjectId(req.user.id);
    }

    const updatedEvent = await Event.findOneAndUpdate(
      buildPendingEventMatch(id),
      { $set: update, $unset: { rejectedAt: '', rejectedBy: '', rejectionReason: '' } },
      { new: true }
    );

    if (!updatedEvent) {
      const existingEvent = await Event.findById(id).select('status isApproved').lean();
      if (existingEvent) {
        if (existingEvent.status === 'rejected') {
          return res
            .status(409)
            .json({ message: 'Event has already been rejected' });
        }
        if (existingEvent.status === 'approved' || existingEvent.isApproved) {
          return res.status(409).json({ message: 'Event is already approved' });
        }
        return res.status(409).json({ message: 'Event has already been processed' });
      }
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.json({ event: updatedEvent.toJSON() });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    return next(error);
  }
};

export const rejectEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status === 'approved' || event.isApproved) {
      return res.status(409).json({ message: 'Event is already approved' });
    }

    if (event.status === 'rejected') {
      return res
        .status(409)
        .json({ message: 'Event has already been rejected' });
    }

    const now = new Date();
    const organizerMatch = buildOrganizerMatch(event.organizer);
    let organizerUser = null;

    if (organizerMatch) {
      organizerUser = await User.findOne(organizerMatch);
    }

    await Event.deleteOne({ _id: id });

    if (organizerUser) {
      if (!Array.isArray(organizerUser.notifications)) {
        organizerUser.notifications = [];
      }

      const notification = {
        id: new mongoose.Types.ObjectId().toString(),
        type: 'event-rejected',
        message: `Your event "${event.title}" was rejected by the admin and removed from the platform.`,
        createdAt: now,
        metadata: {
          eventId: event._id.toString(),
          eventTitle: event.title,
          organizer: event.organizer,
        },
      };

      organizerUser.notifications.push(notification);

      if (organizerUser.notifications.length > 20) {
        organizerUser.notifications = organizerUser.notifications.slice(
          organizerUser.notifications.length - 20
        );
      }

      await organizerUser.save();
    }

    return res.json({ message: 'Event rejected and removed' });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Invalid event id' });
    }
    return next(error);
  }
};

export default {
  getAdminMetrics,
  getAdminAccessOverview,
  updateUserRole,
  getPendingEvents,
  approveEvent,
  rejectEvent,
};
