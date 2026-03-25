// server/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const DEFAULT_CURRENCY = 'CAD';

const signToken = (user) =>
  jwt.sign(
    { id: user.id || user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

export const sanitizeUser = (user) => {
  if (!user) return null;

  let sanitized;

  if (typeof user.toJSON === 'function') {
    sanitized = user.toJSON();
  } else {
    const clone = { ...user };
    delete clone.password;
    if (clone._id && !clone.id) {
      clone.id = clone._id.toString();
      delete clone._id;
    }
    delete clone.__v;
    sanitized = clone;
  }

  return {
    ...sanitized,
    currency: DEFAULT_CURRENCY,
  };
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 60 * 60 * 1000,
  path: '/',
};

// Helper to send response
const sendAuthResponse = (res, user, { statusCode = 200, message } = {}) => {
  const token = signToken(user);
  res.cookie('jwt', token, cookieOptions);
  res.status(statusCode).json({
    token,
    user: sanitizeUser(user),
    message,
  });
};

const normalizeOptionalString = (value) => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

const clampBio = (value) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  return normalized.length <= 280 ? normalized : normalized.slice(0, 280);
};

export const signup = async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullname: fullname.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role && User.ROLES.includes(role) ? role : 'user',
    });

    sendAuthResponse(res, user, {
      statusCode: 201,
      message: 'User registered successfully',
    });
  } catch (err) {
    console.error('Register error:', err);
    res
      .status(500)
      .json({ error: 'Internal server error', details: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+password'
    );

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    sendAuthResponse(res, user, { message: 'Logged in successfully' });
  } catch (err) {
    console.error('Login error:', err);
    res
      .status(500)
      .json({ error: 'Internal server error', details: err.message });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('jwt', cookieOptions);
  res.status(200).json({ message: 'Logged out successfully' });
};

export const me = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ message: 'Not authenticated' });
    const user = await User.findById(req.user.id);
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res
      .status(500)
      .json({ error: 'Internal server error', details: err.message });
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      fullname,
      phone,
      bio,
      avatarUrl,
      country,
      preferences = {},
    } = req.body || {};

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (fullname !== undefined) {
      const normalized = normalizeOptionalString(fullname);
      if (!normalized) {
        return res
          .status(400)
          .json({ message: 'Le nom complet est requis.' });
      }
      user.fullname = normalized;
    }

    if (phone !== undefined) {
      user.phone = normalizeOptionalString(phone);
    }

    if (bio !== undefined) {
      user.bio = clampBio(bio);
    }

    if (avatarUrl !== undefined) {
      user.avatarUrl = normalizeOptionalString(avatarUrl);
    }

    if (country !== undefined) {
      const normalized = normalizeOptionalString(country);
      const uppercased = normalized ? normalized.toUpperCase() : undefined;
      if (uppercased && !/^[A-Z]{2}$/.test(uppercased)) {
        return res.status(400).json({
          message: 'Code pays invalide.',
          errors: [{ field: 'country', message: 'Code pays invalide.' }],
        });
      }
      user.country = uppercased;
      user.currency = DEFAULT_CURRENCY;
    }

    if (!user.preferences) {
      user.preferences = {};
    }

    if (Object.prototype.hasOwnProperty.call(preferences, 'language')) {
      const language = normalizeOptionalString(preferences.language);
      if (language) {
        user.preferences.language = language;
      }
    }

    if (Object.prototype.hasOwnProperty.call(preferences, 'newsletter')) {
      user.preferences.newsletter = Boolean(preferences.newsletter);
    }

    await user.save();

    return res.json({
      message: 'Profile updated successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};
