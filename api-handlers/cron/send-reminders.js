import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles } from '../../db/schema/cycles.js';
import { cycleShares } from '../../db/schema/cycle-shares.js';
import { preferences } from '../../db/schema/preferences.js';
import { fractionalPreferences } from '../../db/schema/fractional-preferences.js';
import { users } from '../../db/schema/users.js';
import { sendEmail } from '../../lib/email.js';
import { deadlineReminderEmail } from '../../lib/email-templates.js';
import { createNotification } from '../../lib/notifications.js';
import { getRequiredEnv } from '../../lib/env.js';

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${getRequiredEnv('CRON_SECRET')}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date().toISOString().split('T')[0];
    const activeCycles = await db.select().from(cycles).where(eq(cycles.status, 'collecting'));

    let totalSent = 0;

    for (const cycle of activeCycles) {
      const deadlineDate = cycle.preferenceDeadline
        ? (typeof cycle.preferenceDeadline === 'string'
          ? cycle.preferenceDeadline.split('T')[0]
          : cycle.preferenceDeadline.toISOString().split('T')[0])
        : null;

      if (!deadlineDate) continue;

      const daysRemaining = daysBetween(today, deadlineDate);
      if (![7, 3, 1].includes(daysRemaining)) continue;

      const sharesInCycle = await db
        .select({
          piId: cycleShares.piId,
          piName: users.name,
          piEmail: users.email,
        })
        .from(cycleShares)
        .innerJoin(users, eq(cycleShares.piId, users.id))
        .where(eq(cycleShares.cycleId, cycle.id));

      const submittedWhole = await db
        .select({ piId: preferences.piId })
        .from(preferences)
        .where(and(eq(preferences.cycleId, cycle.id), isNotNull(preferences.submittedAt)))
        .groupBy(preferences.piId);

      const submittedFractional = await db
        .select({ piId: fractionalPreferences.piId })
        .from(fractionalPreferences)
        .where(and(
          eq(fractionalPreferences.cycleId, cycle.id),
          isNotNull(fractionalPreferences.submittedAt),
        ))
        .groupBy(fractionalPreferences.piId);

      const submittedPiIds = new Set([
        ...submittedWhole.map((s) => s.piId),
        ...submittedFractional.map((s) => s.piId),
      ]);

      for (const share of sharesInCycle) {
        if (submittedPiIds.has(share.piId)) continue;

        const emailData = deadlineReminderEmail({
          name: share.piName,
          cycleName: cycle.name,
          daysRemaining,
          deadlineDate: formatDate(deadlineDate),
        });

        await sendEmail({ to: share.piEmail, ...emailData });
        await createNotification({
          userId: share.piId,
          type: 'deadline_reminder',
          title: `Preference Deadline: ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
          message: `Submit your beam time preferences for ${cycle.name} before ${cycle.preferenceDeadline}.`,
        });
        totalSent += 1;
      }
    }

    console.log(`[CRON] Deadline reminders sent: ${totalSent}`);
    return res.status(200).json({
      data: { message: `Sent ${totalSent} reminder(s)`, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[CRON] Reminder cron error:', err);
    return res.status(500).json({ error: 'Cron job failed', code: 'CRON_ERROR' });
  }
}
