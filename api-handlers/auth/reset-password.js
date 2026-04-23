import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { generateToken, hashToken, tokenExpiresAt } from '../../lib/auth-utils.js';
import { sendEmail } from '../../lib/email.js';
import { passwordResetEmail } from '../../lib/email-templates.js';
import { withMethod } from '../../lib/middleware/with-method.js';

const resetSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    const body = resetSchema.parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

    if (user && user.isActive && user.isActivated) {
      const resetToken = generateToken();
      const expiresAt = tokenExpiresAt(1);

      await db.update(users).set({
        resetTokenHash: hashToken(resetToken),
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      const emailData = passwordResetEmail({
        name: user.name,
        email: user.email,
        resetToken,
      });
      void sendEmail({ to: user.email, ...emailData });
    }

    return res.status(200).json({
      data: { message: 'If that email is registered, a reset link has been sent.' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }

    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', handler);
