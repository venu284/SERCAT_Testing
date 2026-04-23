import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours
const ABSOLUTE_MAX_SECONDS = 7 * 24 * 60 * 60; // 7 days
const COOKIE_NAME = 'sercat_session';

// --- Password ---

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// --- JWT ---

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const loginAt = payload.loginAt ?? payload.iat;

  if (typeof loginAt === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now - loginAt > ABSOLUTE_MAX_SECONDS) {
      throw new Error('Session expired');
    }
  }

  return payload;
}

// --- Cookie ---

export function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${JWT_EXPIRY_SECONDS}`,
    isProduction ? 'Secure' : '',
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res) {
  const cookie = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ].join('; ');

  res.setHeader('Set-Cookie', cookie);
}

export function getSessionCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return match.split('=')[1]?.trim() || null;
}

// --- Activation & Reset Tokens ---

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function tokenExpiresAt(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export { ABSOLUTE_MAX_SECONDS, COOKIE_NAME };
