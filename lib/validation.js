import { z } from 'zod';

export const strongPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

export const emailSchema = z.email().trim().toLowerCase();
export const uuidSchema = z.uuid();
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

export function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}
