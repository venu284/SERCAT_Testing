import { z } from 'zod';

// Reusable schemas
export const emailSchema = z.string().email().trim().toLowerCase();
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const strongPasswordSchema = passwordSchema
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');
export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const shiftSchema = z.enum(['DS1', 'DS2', 'NS']);
export const assignmentReasonSchema = z.enum([
  'choice1',
  'choice1_no_conflict',
  'choice2',
  'fallback_proximity',
  'fallback_any',
  'auto_assigned',
  'fractional_packed',
  'manual_override',
]);
export const userRoleSchema = z.enum(['admin', 'pi']);

// Helper to validate request body
export async function validateBody(request, schema) {
  const body = await request.json();
  return schema.parse(body);
}
