import { z } from 'zod';

// Reusable schemas
export const emailSchema = z.string().email().trim().toLowerCase();
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const slotKeySchema = z.enum(['DAY1', 'DAY2', 'NS']);
export const shiftTypeSchema = z.enum(['DS1', 'DS2', 'NS']);
export const userRoleSchema = z.enum(['admin', 'pi']);

// Helper to validate request body
export async function validateBody(request, schema) {
  const body = await request.json();
  return schema.parse(body);
}
