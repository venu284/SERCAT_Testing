import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { hashToken } from '../../lib/auth-utils.js';
import { logAudit } from '../../lib/audit.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { checkTokenRateLimit } from '../../lib/middleware/with-rate-limit.js';

async function handler(req, res) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const rateCheck = checkTokenRateLimit(ip);
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${retryMinutes} minutes.`, code: 'RATE_LIMITED' });
    }

    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required', code: 'TOKEN_MISSING' });
    }

    const tokenHash = hashToken(token);

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.emailVerifyTokenHash, tokenHash),
          gt(users.emailVerifyTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired email verification link.',
        code: 'TOKEN_INVALID',
      });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({ error: 'No pending email change found.', code: 'NO_PENDING_EMAIL' });
    }

    await db.update(users).set({
      email: user.pendingEmail,
      pendingEmail: null,
      emailVerifyTokenHash: null,
      emailVerifyTokenExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    await logAudit(user.id, 'user.email_change_verified', { newEmail: user.pendingEmail });

    return res.status(200).json({ data: { message: 'Email updated successfully.' } });
  } catch (err) {
    console.error('Email verify error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('GET', handler);
