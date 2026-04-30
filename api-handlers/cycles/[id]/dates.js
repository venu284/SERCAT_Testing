import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { cycles } from '../../../db/schema/cycles.js';
import { availableDates } from '../../../db/schema/available-dates.js';
import { withAuth } from '../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { getZodMessage } from '../../../lib/validation.js';
import { ROLES } from '../../../lib/constants.js';

const setDatesSchema = z.object({
  dates: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isAvailable: z.boolean().default(true),
      ds1Available: z.boolean().default(true),
      ds2Available: z.boolean().default(true),
      nsAvailable: z.boolean().default(true),
    }),
  ).min(1, 'At least one date is required'),
});


async function handler(req, res) {
  try {
    const { id } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    if (req.method === 'GET') {
      const rows = await db
        .select()
        .from(availableDates)
        .where(eq(availableDates.cycleId, id))
        .orderBy(availableDates.date);
      return res.status(200).json({ data: rows });
    }

    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }

    if (cycle.status === 'archived') {
      return res.status(400).json({
        error: 'Cannot modify dates for an archived cycle',
        code: 'CYCLE_ARCHIVED',
      });
    }

    const body = setDatesSchema.parse(req.body);

    await db.delete(availableDates).where(eq(availableDates.cycleId, id));

    const rows = body.dates.map((d) => ({
      cycleId: id,
      date: d.date,
      isAvailable: d.isAvailable,
      ds1Available: d.ds1Available ?? true,
      ds2Available: d.ds2Available ?? true,
      nsAvailable: d.nsAvailable ?? true,
    }));

    const inserted = await db.insert(availableDates).values(rows).returning();
    await logAudit(req.user.userId, 'cycle.dates_updated', {
      cycleId: id,
      dateCount: inserted.length,
    });

    return res.status(200).json({ data: inserted });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Available dates error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAuth(withMethod(['GET', 'POST'], handler));
