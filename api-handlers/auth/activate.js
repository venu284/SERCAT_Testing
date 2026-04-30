import { z } from 'zod';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { hashPassword, hashToken } from '../../lib/auth-utils.js';
import { strongPasswordSchema, getZodMessage } from '../../lib/validation.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { checkTokenRateLimit } from '../../lib/middleware/with-rate-limit.js';

const activateSchema = z.object({
  token: z.string().min(1, 'Activation token is required'),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
  phone: z.string().optional().default(''),
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

    const body = activateSchema.parse(req.body);
    const activationTokenHash = hashToken(body.token);

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.activationTokenHash, activationTokenHash),
          eq(users.isActivated, false),
          gt(users.activationTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired activation token. Contact admin@ser-cat.org.',
        code: 'INVALID_TOKEN',
      });
    }

    const passwordHash = await hashPassword(body.password);

    await db.update(users).set({
      passwordHash,
      isActivated: true,
      activationTokenHash: null,
      activationTokenExpiresAt: null,
      phone: body.phone || null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    let institution = null;
    if (user.institutionId) {
      const [inst] = await db
        .select()
        .from(institutions)
        .where(eq(institutions.id, user.institutionId))
        .limit(1);
      institution = inst || null;
    }

    return res.status(200).json({
      data: {
        message: 'Account activated successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          institutionName: institution?.name || null,
          institutionAbbreviation: institution?.abbreviation || null,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }

    console.error('Activate error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', handler);
