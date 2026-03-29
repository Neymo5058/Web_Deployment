import { randomBytes } from 'node:crypto';

const baseSecret = (process.env.JWT_SECRET || 'change-me-in-production').trim();

const runtimeSecret =
  globalThis.__RUNTIME_JWT_SECRET__ || randomBytes(32).toString('hex');

globalThis.__RUNTIME_JWT_SECRET__ = runtimeSecret;

export const JWT_SIGNING_SECRET = `${baseSecret}:${runtimeSecret}`;

export const TOKEN_EXPIRATION_SECONDS = 60 * 60; // 1 hour

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: TOKEN_EXPIRATION_SECONDS * 1000,
  path: '/',
};

export default {
  JWT_SIGNING_SECRET,
  TOKEN_EXPIRATION_SECONDS,
  cookieOptions,
};
