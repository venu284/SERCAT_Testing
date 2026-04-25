import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { swapRequests } from '../../db/schema/swap-requests.js';
import { users } from '../../db/schema/users.js';
import { scheduleAssignments } from '../../db/schema/schedule-assignments.js';
import { schedules } from '../../db/schema/schedules.js';
import { cycles } from '../../db/schema/cycles.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { sendEmail } from '../../lib/email.js';
import { swapRequestUpdateEmail } from '../../lib/email-templates.js';
import { createNotification } from '../../lib/notifications.js';
import {
  fetchSwapRequestRow,
  isIsoDateString,
  mapSwapRequestRow,
} from '../../lib/swap-request-utils.js';
import { getZodMessage } from '../../lib/validation.js';

const resolveSwapRequestSchema = z.object({
  status: z.enum(['approved', 'denied']),
  adminNotes: z.string().optional(),
  reassignedDate: z.string().optional(),
  reassignedShift: z.enum(['DS1', 'DS2', 'NS']).optional(),
}).superRefine((body, ctx) => {
  if (body.status === 'approved') {
    if (!body.reassignedDate || !isIsoDateString(body.reassignedDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Approved requests require a YYYY-MM-DD reassigned date',
        path: ['reassignedDate'],
      });
    }
    if (!body.reassignedShift) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Approved requests require a reassigned shift',
        path: ['reassignedShift'],
      });
    }
  }
});

async function getHandler(req, res) {
  try {
    const { id } = req.query;
    const row = await fetchSwapRequestRow(id);

    if (!row) {
      return res.status(404).json({ error: 'Swap request not found', code: 'NOT_FOUND' });
    }
    if (req.user.role === 'pi' && row.requesterId !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to view this request', code: 'FORBIDDEN' });
    }

    return res.status(200).json({ data: mapSwapRequestRow(row) });
  } catch (err) {
    console.error('Get swap request error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

async function putHandler(req, res) {
  try {
    const { id } = req.query;
    const body = resolveSwapRequestSchema.parse(req.body || {});

    const row = await fetchSwapRequestRow(id);
    if (!row) {
      return res.status(404).json({ error: 'Swap request not found', code: 'NOT_FOUND' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'Swap request already resolved', code: 'ALREADY_RESOLVED' });
    }

    const adminNotes = String(body.adminNotes || '').trim();
    const now = new Date();

    if (body.status === 'approved') {
      const [targetAssignment] = await db
        .select()
        .from(scheduleAssignments)
        .where(eq(scheduleAssignments.id, row.targetAssignmentId))
        .limit(1);

      if (!targetAssignment) {
        return res.status(404).json({ error: 'Target assignment not found', code: 'NOT_FOUND' });
      }

      const conflicts = await db
        .select({ id: scheduleAssignments.id })
        .from(scheduleAssignments)
        .where(and(
          eq(scheduleAssignments.scheduleId, row.scheduleId),
          eq(scheduleAssignments.assignedDate, body.reassignedDate),
          eq(scheduleAssignments.shift, body.reassignedShift),
        ));

      if (conflicts.some((assignment) => assignment.id !== targetAssignment.id)) {
        return res.status(400).json({
          error: 'Selected reassignment slot is already assigned',
          code: 'ASSIGNMENT_CONFLICT',
        });
      }

      await db
        .update(scheduleAssignments)
        .set({
          assignedDate: body.reassignedDate,
          shift: body.reassignedShift,
          isManualOverride: true,
          assignmentReason: 'manual_override',
        })
        .where(eq(scheduleAssignments.id, row.targetAssignmentId));
    }

    await db
      .update(swapRequests)
      .set({
        status: body.status,
        adminNotes: adminNotes || null,
        reviewedBy: req.user.userId,
        reviewedAt: now,
      })
      .where(eq(swapRequests.id, id));

    const [[requesterUser], [schedule]] = await Promise.all([
      db.select().from(users).where(eq(users.id, row.requesterId)).limit(1),
      db.select().from(schedules).where(eq(schedules.id, row.scheduleId)).limit(1),
    ]);
    const [cycle] = schedule
      ? await db.select().from(cycles).where(eq(cycles.id, schedule.cycleId)).limit(1)
      : [null];

    await createNotification({
      userId: row.requesterId,
      type: 'swap_update',
      title: `Swap Request ${body.status === 'approved' ? 'Approved' : 'Denied'}`,
      message: body.status === 'approved'
        ? `Your shift change request has been approved. New assignment: ${body.reassignedDate} ${body.reassignedShift}.`
        : `Your shift change request has been denied.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
    });

    if (requesterUser?.email) {
      void sendEmail({
        to: requesterUser.email,
        ...swapRequestUpdateEmail({
          name: requesterUser.name,
          cycleName: cycle?.name || 'Current Cycle',
          status: body.status,
          adminNotes,
        }),
      });
    }

    await logAudit(req.user.userId, 'swap_request.resolve', {
      swapRequestId: id,
      status: body.status,
      reassignedDate: body.reassignedDate || null,
      reassignedShift: body.reassignedShift || null,
    });

    const updatedRow = await fetchSwapRequestRow(id);
    return res.status(200).json({ data: mapSwapRequestRow(updatedRow) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Resolve swap request error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

async function handler(req, res) {
  if (req.method === 'GET') {
    return getHandler(req, res);
  }
  return putHandler(req, res);
}

export default withMethod(['GET', 'PUT'], withAuth((req, res) => {
  if (req.method === 'PUT' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }
  return handler(req, res);
}));
