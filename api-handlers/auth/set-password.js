import { z } from 'zod';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { hashPassword, hashToken } from '../../lib/auth-utils.js';
import { strongPasswordSchema, getZodMessage } from '../../lib/validation.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { checkTokenRateLimit } from '../../lib/middleware/with-rate-limit.js';

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});


async function handler(req, res) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const rateCheck = checkTokenRateLimit(ip);
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${retryMinutes} minutes.`, code: 'RATE_LIMITED' });
    }

    const body = setPasswordSchema.parse(req.body);
    const resetTokenHash = hashToken(body.token);

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetTokenHash, resetTokenHash),
          gt(users.resetTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token. Request a new one.',
        code: 'INVALID_TOKEN',
      });
    }

    const passwordHash = await hashPassword(body.password);

    await db.update(users).set({
      passwordHash,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    return res.status(200).json({
      data: { message: 'Password updated successfully. You can now sign in.' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }

    console.error('Set password error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', handler);
