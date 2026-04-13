import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema/users.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { generateToken, tokenExpiresAt } from '../../../lib/auth-utils.js';

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
      activationToken,
      activationTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    await logAudit(req.user.userId, 'user.resend_invite', {
      targetUserId: id,
      email: user.email,
    });

    console.log(`[RESEND INVITE] Token for ${user.email}: ${activationToken}`);
    console.log(`[RESEND INVITE] Link: ${process.env.APP_URL}/activate?token=${activationToken}`);

    return res.status(200).json({
      data: {
        message: 'Invitation resent',
        activationToken,
        email: user.email,
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
