import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema/users.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { generateToken, hashToken, tokenExpiresAt } from '../../../lib/auth-utils.js';
import { sendEmail } from '../../../lib/email.js';
import { accountInviteEmail } from '../../../lib/email-templates.js';

const resendInviteSchema = z.object({
  activationToken: z.string().trim().min(1).optional(),
});

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    if (user.isActivated) {
      return res.status(400).json({ error: 'User is already activated', code: 'ALREADY_ACTIVATED' });
    }

    const body = resendInviteSchema.parse(req.body || {});
    const activationToken = body.activationToken || generateToken();
    const expiresAt = tokenExpiresAt(72);

    await db.update(users).set({
      activationTokenHash: hashToken(activationToken),
      activationTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    await logAudit(req.user.userId, 'user.resend_invite', {
      targetUserId: id,
      email: user.email,
    });

    const emailData = accountInviteEmail({
      name: user.name,
      email: user.email,
      activationToken,
      institutionName: null,
    });
    const emailResult = await sendEmail({ to: user.email, ...emailData });
    if (!emailResult.ok) {
      console.warn('[RESEND INVITE] Email failed to send to', user.email, ':', emailResult.error);
    }

    return res.status(200).json({
      data: {
        message: 'Invitation resent',
        activationToken,
        email: user.email,
        emailSent: emailResult.ok,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request', code: 'VALIDATION_ERROR' });
    }
    console.error('Resend invite error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('POST', handler));
