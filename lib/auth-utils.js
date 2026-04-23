import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;
const JWT_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours
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
  return jwt.verify(token, process.env.JWT_SECRET);
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
  return uuidv4();
}

export function tokenExpiresAt(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export { COOKIE_NAME };
