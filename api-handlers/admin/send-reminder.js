import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { cycles } from '../../db/schema/cycles.js';
import { cycleShares } from '../../db/schema/cycle-shares.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { sendEmail } from '../../lib/email.js';
import { manualReminderEmail } from '../../lib/email-templates.js';
import { createNotification } from '../../lib/notifications.js';
import { getZodMessage } from '../../lib/validation.js';

const reminderSchema = z.object({
  cycleId: z.string().uuid(),
  message: z.string().min(1, 'Message is required').max(2000),
  piIds: z.array(z.string().uuid()).optional(),
});


async function handler(req, res) {
  try {
    const body = reminderSchema.parse(req.body);

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, body.cycleId)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    let targetPIs;
    if (body.piIds && body.piIds.length > 0) {
      targetPIs = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, body.piIds));
    } else {
      targetPIs = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(cycleShares)
        .innerJoin(users, eq(cycleShares.piId, users.id))
        .where(eq(cycleShares.cycleId, body.cycleId));
    }

    let sent = 0;
    for (const pi of targetPIs) {
      const emailData = manualReminderEmail({
        name: pi.name,
        cycleName: cycle.name,
        customMessage: body.message,
      });
      await sendEmail({ to: pi.email, ...emailData });
      await createNotification({
        userId: pi.id,
        type: 'deadline_reminder',
        title: 'Reminder from Admin',
        message: body.message || 'Please submit your beam time preferences for the current cycle.',
      });
      sent += 1;
    }

    await logAudit(req.user.userId, 'admin.send_reminder', {
      cycleId: body.cycleId,
      recipientCount: sent,
      targetPiIds: body.piIds || 'all',
    });

    return res.status(200).json({
      data: { message: `Reminder sent to ${sent} PI(s)`, sent },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Send reminder error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('POST', handler));
