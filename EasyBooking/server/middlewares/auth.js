import jwt from 'jsonwebtoken';

const getTokenFromRequest = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }

  if (req.cookies?.jwt) {
    return req.cookies.jwt;
  }

  return null;
};

export const protect = (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production');
    req.user = { id: decoded.id, role: decoded.role };
    return next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return next();
};

export default {
  protect,
  restrictTo,
};
