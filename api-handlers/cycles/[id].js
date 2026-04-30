import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles } from '../../db/schema/cycles.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { getZodMessage } from '../../lib/validation.js';

const updateCycleSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferenceDeadline: z.string().optional(),
  status: z.enum(['setup', 'collecting', 'scheduling', 'published', 'archived']).optional(),
  notes: z.string().optional().nullable(),
  shiftTimingOverrides: z.string().optional().nullable(),
});


async function handler(req, res) {
  try {
    const { id } = req.query;

    const [existing] = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    if (existing.status === 'archived') {
      return res.status(400).json({ error: 'Cannot modify an archived cycle', code: 'CYCLE_ARCHIVED' });
    }

    const body = updateCycleSchema.parse(req.body);
    const updateData = { ...body, updatedAt: new Date() };
    if (body.preferenceDeadline) {
      updateData.preferenceDeadline = new Date(body.preferenceDeadline);
    }

    const [updated] = await db.update(cycles).set(updateData).where(eq(cycles.id, id)).returning();
    await logAudit(req.user.userId, 'cycle.update', { cycleId: id, changes: body });

    return res.status(200).json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Cycle update error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('PUT', handler));
