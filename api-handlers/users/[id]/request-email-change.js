import { z } from 'zod';
import { eq, and, ilike, ne } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema/users.js';
import { withAuth } from '../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { generateToken, hashToken, tokenExpiresAt } from '../../../lib/auth-utils.js';
import { sendEmail } from '../../../lib/email.js';
import { emailVerifyEmail } from '../../../lib/email-templates.js';
import { getZodMessage } from '../../../lib/validation.js';
import { getEnvOrDefault } from '../../../lib/env.js';

const requestSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

async function handler(req, res) {
  try {
    const { id } = req.query;
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.userId === id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    const body = requestSchema.parse(req.body);

    if (body.email === existing.email) {
      return res.status(400).json({ error: 'New email must differ from current email', code: 'SAME_EMAIL' });
    }

    const [dup] = await db
      .select()
      .from(users)
      .where(and(ilike(users.email, body.email), ne(users.id, id)))
      .limit(1);
    if (dup) {
      return res.status(409).json({
        error: `Email "${body.email}" is already registered`,
        code: 'DUPLICATE',
      });
    }

    const token = generateToken();
    const appUrl = getEnvOrDefault('APP_URL', 'https://sercat.org');
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    await db.update(users).set({
      pendingEmail: body.email,
      emailVerifyTokenHash: hashToken(token),
      emailVerifyTokenExpiresAt: tokenExpiresAt(24),
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    await sendEmail({
      to: body.email,
      ...emailVerifyEmail({ name: existing.name, verifyUrl }),
    });

    await logAudit(req.user.userId, 'user.email_change_requested', { targetUserId: id, pendingEmail: body.email });

    return res.status(200).json({ data: { message: 'Verification email sent.' } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Email change request error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAuth(withMethod('POST', handler));
