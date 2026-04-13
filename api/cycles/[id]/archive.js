import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { cycles } from '../../../db/schema/cycles.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }
    if (cycle.status === 'archived') {
      return res.status(400).json({ error: 'Cycle is already archived', code: 'ALREADY_ARCHIVED' });
    }

    const [archived] = await db
      .update(cycles)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(cycles.id, id))
      .returning();

    await logAudit(req.user.userId, 'cycle.archive', { cycleId: id, previousStatus: cycle.status });
    return res.status(200).json({ data: archived });
  } catch (err) {
    console.error('Archive cycle error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('POST', handler));
