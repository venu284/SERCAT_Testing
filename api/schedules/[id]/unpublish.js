import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { schedules } from '../../../db/schema/schedules.js';
import { cycles } from '../../../db/schema/cycles.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';

async function handler(req, res) {
  try {
    const { id: scheduleId } = req.query;

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });
    }
    if (schedule.status !== 'published') {
      return res.status(400).json({ error: 'Schedule is not published', code: 'NOT_PUBLISHED' });
    }

    await db.update(schedules).set({ status: 'draft', publishedAt: null }).where(eq(schedules.id, scheduleId));
    await db.update(cycles).set({ status: 'scheduling', updatedAt: new Date() }).where(eq(cycles.id, schedule.cycleId));

    await logAudit(req.user.userId, 'schedule.unpublish', { scheduleId, cycleId: schedule.cycleId });

    return res.status(200).json({ data: { message: 'Schedule moved to draft', scheduleId } });
  } catch (err) {
    console.error('Unpublish error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', withAdmin(handler));
