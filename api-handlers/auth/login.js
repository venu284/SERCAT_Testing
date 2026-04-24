import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { verifyPassword, signToken, setSessionCookie } from '../../lib/auth-utils.js';
import { checkRateLimit, resetRateLimit } from '../../lib/middleware/with-rate-limit.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { getZodMessage } from '../../lib/validation.js';

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});


async function handler(req, res) {
  try {
    const body = loginSchema.parse(req.body);
    const loginAt = Math.floor(Date.now() / 1000);

    const rateCheck = checkRateLimit(body.email);
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
      return res.status(429).json({
        error: `Too many login attempts. Try again in ${retryMinutes} minutes.`,
        code: 'RATE_LIMITED',
      });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        role: users.role,
        institutionId: users.institutionId,
        institutionName: institutions.name,
        institutionAbbreviation: institutions.abbreviation,
        isActive: users.isActive,
        isActivated: users.isActivated,
      })
      .from(users)
      .leftJoin(institutions, eq(users.institutionId, institutions.id))
      .where(eq(users.email, body.email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'This account is deactivated. Contact admin@ser-cat.org.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    if (!user.isActivated) {
      return res.status(401).json({
        error: 'Your account has not been activated yet. Check your email for the activation link.',
        code: 'ACCOUNT_NOT_ACTIVATED',
      });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    resetRateLimit(body.email);

    const token = signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
      institutionId: user.institutionId,
      loginAt,
    });

    setSessionCookie(res, token);

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    return res.status(200).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          institutionId: user.institutionId,
          institutionName: user.institutionName,
          institutionAbbreviation: user.institutionAbbreviation,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }

    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', handler);
