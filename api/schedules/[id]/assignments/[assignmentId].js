import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { schedules } from '../../../../db/schema/schedules.js';
import { scheduleAssignments } from '../../../../db/schema/schedule-assignments.js';
import { withAdmin } from '../../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';
import { logAudit } from '../../../../lib/audit.js';

const adjustSchema = z.object({
  assignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shift: z.enum(['DS1', 'DS2', 'NS']).optional(),
});

async function handler(req, res) {
  try {
    const { id: scheduleId, assignmentId } = req.query;

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });
    }
    if (schedule.status === 'published') {
      return res.status(400).json({ error: 'Cannot adjust a published schedule. Move it back to draft first.', code: 'ALREADY_PUBLISHED' });
    }

    const [assignment] = await db.select().from(scheduleAssignments).where(eq(scheduleAssignments.id, assignmentId)).limit(1);
    if (!assignment || assignment.scheduleId !== scheduleId) {
      return res.status(404).json({ error: 'Assignment not found', code: 'NOT_FOUND' });
    }

    const body = adjustSchema.parse(req.body);
    const updateData = { isManualOverride: true, assignmentReason: 'manual_override' };
    if (body.assignedDate) updateData.assignedDate = body.assignedDate;
    if (body.shift) updateData.shift = body.shift;

    const [updated] = await db
      .update(scheduleAssignments)
      .set(updateData)
      .where(eq(scheduleAssignments.id, assignmentId))
      .returning();

    await logAudit(req.user.userId, 'schedule.manual_adjust', {
      scheduleId,
      assignmentId,
      changes: body,
      previousDate: assignment.assignedDate,
      previousShift: assignment.shift,
    });

    return res.status(200).json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request', code: 'VALIDATION_ERROR' });
    }
    console.error('Adjust assignment error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('PUT', withAdmin(handler));
