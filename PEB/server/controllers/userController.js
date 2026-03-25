import User from '../models/User.js';

const ALLOWED_ROLES = ['user', 'organizer', 'admin'];

export const listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return res.json({
      users: users.map((user) => user.toJSON()),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : null;

    if (!normalizedRole || !ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid role provided' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = normalizedRole;
    await user.save();

    return res.json({ user: user.toJSON() });
  } catch (error) {
    return next(error);
  }
};

export default {
  listUsers,
  updateUserRole,
};
