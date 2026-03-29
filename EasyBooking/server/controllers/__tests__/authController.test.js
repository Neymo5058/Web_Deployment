import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    sign: vi.fn(),
  },
}));

vi.mock('../../models/User.js', () => {
  const mockedModel = {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  };
  mockedModel.ROLES = ['user', 'admin', 'organizer'];
  return {
    __esModule: true,
    default: mockedModel,
  };
});

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  sanitizeUser,
  updateProfile,
  signup,
  login,
  logout,
  me,
} from '../authController.js';
import User from '../../models/User.js';

const createResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  res.status.mockImplementation(() => res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
});

describe('sanitizeUser', () => {
  it('removes sensitive fields and adds defaults when plain object is provided', () => {
    const user = {
      _id: 'mock-user-id-1234567890abcd',
      id: undefined,
      fullname: 'Alice',
      email: 'alice@example.com',
      password: 'hashed',
      __v: 0,
    };

    const sanitized = sanitizeUser(user);

    expect(sanitized).toEqual(
      expect.objectContaining({
        id: 'mock-user-id-1234567890abcd',
        fullname: 'Alice',
        email: 'alice@example.com',
        currency: 'CAD',
      })
    );
    expect('password' in sanitized).toBe(false);
    expect('__v' in sanitized).toBe(false);
  });

  it('prefers toJSON representation when available and enforces default currency', () => {
    const user = {
      toJSON() {
        return {
          id: 'user-123',
          fullname: 'Bob',
          currency: 'USD',
        };
      },
    };

    const sanitized = sanitizeUser(user);

    expect(sanitized).toEqual({
      id: 'user-123',
      fullname: 'Bob',
      currency: 'CAD',
    });
  });

  it('returns null when a falsy user is provided', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser(undefined)).toBeNull();
  });
});

describe('signup', () => {
  it('creates a user, hashes password and sends auth response', async () => {
    const req = {
      body: {
        fullname: '  Alice Smith  ',
        email: '  Alice@example.com ',
        password: 'secret',
        role: 'invalid-role',
      },
    };
    const res = createResponse();

    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-secret');
    const createdUser = {
      id: 'user-1',
      role: 'user',
      toJSON() {
        return {
          id: 'user-1',
          fullname: 'Alice Smith',
          email: 'alice@example.com',
          currency: 'USD',
        };
      },
    };
    User.create.mockResolvedValue(createdUser);
    jwt.sign.mockReturnValue('token-123');

    await signup(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'alice@example.com' });
    expect(bcrypt.hash).toHaveBeenCalledWith('secret', 12);
    expect(User.create).toHaveBeenCalledWith({
      fullname: 'Alice Smith',
      email: 'alice@example.com',
      password: 'hashed-secret',
      role: 'user',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'jwt',
      'token-123',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'User registered successfully',
        token: 'token-123',
        user: expect.objectContaining({
          id: 'user-1',
          fullname: 'Alice Smith',
          email: 'alice@example.com',
          currency: 'CAD',
        }),
      })
    );
  });

  it('returns a validation error when required fields are missing', async () => {
    const req = { body: { email: 'missing@example.com' } };
    const res = createResponse();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'All fields are required' });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('returns an error when email already exists', async () => {
    const req = {
      body: {
        fullname: 'Existing',
        email: 'existing@example.com',
        password: 'secret',
      },
    };
    const res = createResponse();

    User.findOne.mockResolvedValue({ id: 'existing' });

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email already in use' });
    expect(User.create).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});

describe('login', () => {
  it('authenticates the user and sends auth response', async () => {
    const req = {
      body: { email: ' USER@example.com ', password: 'secret' },
    };
    const res = createResponse();

    const userDoc = {
      id: 'user-2',
      password: 'hashed',
      toJSON() {
        return {
          id: 'user-2',
          fullname: 'User Two',
          currency: 'USD',
        };
      },
    };

    const selectMock = vi.fn().mockResolvedValue(userDoc);
    User.findOne.mockReturnValue({ select: selectMock });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('jwt-token');

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(selectMock).toHaveBeenCalledWith('+password');
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed');
    expect(res.cookie).toHaveBeenCalledWith(
      'jwt',
      'jwt-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Logged in successfully',
        token: 'jwt-token',
        user: expect.objectContaining({ id: 'user-2', currency: 'CAD' }),
      })
    );
  });

  it('rejects invalid credentials when user is not found', async () => {
    const req = {
      body: { email: 'missing@example.com', password: 'secret' },
    };
    const res = createResponse();

    const selectMock = vi.fn().mockResolvedValue(null);
    User.findOne.mockReturnValue({ select: selectMock });

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials when password does not match', async () => {
    const req = {
      body: { email: 'user@example.com', password: 'wrong' },
    };
    const res = createResponse();

    const userDoc = { password: 'hashed' };
    const selectMock = vi.fn().mockResolvedValue(userDoc);
    User.findOne.mockReturnValue({ select: selectMock });
    bcrypt.compare.mockResolvedValue(false);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    expect(res.cookie).not.toHaveBeenCalled();
  });
});

describe('me', () => {
  it('returns unauthorized when no user is in the request', async () => {
    const res = createResponse();

    await me({ user: null }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authenticated' });
  });

  it('returns sanitized user information for an authenticated request', async () => {
    const res = createResponse();
    const userDoc = {
      _id: 'mock-user-id-1234567890abcd',
      password: 'secret',
      toJSON() {
        return {
          id: 'user-3',
          fullname: 'Charlie',
          currency: 'USD',
        };
      },
    };
    User.findById.mockResolvedValue(userDoc);

    await me({ user: { id: 'user-3' } }, res);

    expect(User.findById).toHaveBeenCalledWith('user-3');
    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 'user-3', currency: 'CAD' }),
    });
  });
});

describe('logout', () => {
  it('clears the auth cookie and returns a confirmation message', async () => {
    const res = createResponse();

    await logout({}, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      'jwt',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
  });
});

describe('updateProfile', () => {
  const buildUser = (overrides = {}) => {
    const base = {
      id: 'user123',
      fullname: 'Existing User',
      preferences: {},
      save: vi.fn(),
      toJSON() {
        return {
          id: this.id,
          fullname: this.fullname,
          phone: this.phone,
          bio: this.bio,
          avatarUrl: this.avatarUrl,
          country: this.country,
          currency: this.currency,
          preferences: this.preferences,
        };
      },
    };
    return Object.assign(base, overrides);
  };

  it('normalizes incoming fields, updates the user and returns sanitized payload', async () => {
    const user = buildUser();
    User.findById.mockResolvedValue(user);

    const req = {
      user: { id: 'user123' },
      body: {
        fullname: '  Alice Smith  ',
        phone: '  555-1234  ',
        bio: 'Hello world',
        avatarUrl: '  https://example.com/avatar.png  ',
        country: 'ca',
        preferences: {
          language: '  en  ',
          newsletter: 'true',
        },
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await updateProfile(req, res, next);

    expect(User.findById).toHaveBeenCalledWith('user123');
    expect(user.fullname).toBe('Alice Smith');
    expect(user.phone).toBe('555-1234');
    expect(user.bio).toBe('Hello world');
    expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    expect(user.country).toBe('CA');
    expect(user.currency).toBe('CAD');
    expect(user.preferences.language).toBe('en');
    expect(user.preferences.newsletter).toBe(true);
    expect(user.save).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Profile updated successfully',
        user: expect.objectContaining({
          id: 'user123',
          fullname: 'Alice Smith',
          phone: '555-1234',
          country: 'CA',
          currency: 'CAD',
          preferences: expect.objectContaining({
            language: 'en',
            newsletter: true,
          }),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a validation error when an invalid country code is provided', async () => {
    const user = buildUser();
    User.findById.mockResolvedValue(user);

    const req = {
      user: { id: 'user123' },
      body: { country: 'invalid' },
    };
    const res = createResponse();
    const next = vi.fn();

    await updateProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Code pays invalide.',
      })
    );
    expect(user.save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns unauthorized response when request is not authenticated', async () => {
    const res = createResponse();
    const next = vi.fn();

    await updateProfile({ user: null, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authenticated' });
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found when the user cannot be located', async () => {
    User.findById.mockResolvedValue(null);
    const req = { user: { id: 'missing' }, body: {} };
    const res = createResponse();
    const next = vi.fn();

    await updateProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards unexpected errors to the error handler', async () => {
    const error = new Error('database down');
    User.findById.mockRejectedValue(error);
    const req = { user: { id: 'user123' }, body: {} };
    const res = createResponse();
    const next = vi.fn();

    await updateProfile(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
