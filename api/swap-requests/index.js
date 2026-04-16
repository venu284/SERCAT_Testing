import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { swapRequests } from '../../db/schema/swap-requests.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { scheduleAssignments } from '../../db/schema/schedule-assignments.js';
import { schedules } from '../../db/schema/schedules.js';
import { cycles } from '../../db/schema/cycles.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { isIsoDateString, parsePreferredDates, serializePreferredDates } from '../../lib/swap-request-utils.js';

const createSwapRequestSchema = z.object({
  scheduleId: z.string().uuid(),
  targetAssignmentId: z.string().uuid(),
  preferredDates: z.array(z.string()).optional().default([]),
}).superRefine((body, ctx) => {
  body.preferredDates.forEach((date, index) => {
    if (!isIsoDateString(date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preferred dates must use YYYY-MM-DD format',
        path: ['preferredDates', index],
      });
    }
  });
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

function mapSwapRequestRow(row) {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    requesterId: row.requesterId,
    targetAssignmentId: row.targetAssignmentId,
    preferredDates: parsePreferredDates(row.preferredDates),
    status: row.status,
    adminNotes: row.adminNotes,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    institutionAbbreviation: row.institutionAbbreviation,
    scheduleStatus: row.scheduleStatus,
    cycleId: row.cycleId,
    cycleName: row.cycleName,
    targetAssignment: {
      id: row.targetAssignmentId,
      assignedDate: row.targetAssignmentAssignedDate,
      shift: row.targetAssignmentShift,
      shareIndex: row.targetAssignmentShareIndex,
      blockIndex: row.targetAssignmentBlockIndex,
    },
  };
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const baseQuery = db
        .select({
          id: swapRequests.id,
          scheduleId: swapRequests.scheduleId,
          requesterId: swapRequests.requesterId,
          targetAssignmentId: swapRequests.targetAssignmentId,
          preferredDates: swapRequests.preferredDates,
          status: swapRequests.status,
          adminNotes: swapRequests.adminNotes,
          reviewedBy: swapRequests.reviewedBy,
          reviewedAt: swapRequests.reviewedAt,
          createdAt: swapRequests.createdAt,
          requesterName: users.name,
          requesterEmail: users.email,
          institutionId: institutions.id,
          institutionName: institutions.name,
          institutionAbbreviation: institutions.abbreviation,
          targetAssignmentAssignedDate: scheduleAssignments.assignedDate,
          targetAssignmentShift: scheduleAssignments.shift,
          targetAssignmentShareIndex: scheduleAssignments.shareIndex,
          targetAssignmentBlockIndex: scheduleAssignments.blockIndex,
          scheduleStatus: schedules.status,
          cycleId: schedules.cycleId,
          cycleName: cycles.name,
        })
        .from(swapRequests)
        .innerJoin(users, eq(swapRequests.requesterId, users.id))
        .leftJoin(institutions, eq(users.institutionId, institutions.id))
        .innerJoin(scheduleAssignments, eq(swapRequests.targetAssignmentId, scheduleAssignments.id))
        .innerJoin(schedules, eq(swapRequests.scheduleId, schedules.id))
        .leftJoin(cycles, eq(schedules.cycleId, cycles.id));

      const rows = req.user.role === 'admin'
        ? await baseQuery.orderBy(desc(swapRequests.createdAt))
        : await baseQuery
          .where(eq(swapRequests.requesterId, req.user.userId))
          .orderBy(desc(swapRequests.createdAt));

      return res.status(200).json({ data: rows.map(mapSwapRequestRow) });
    }

    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Only PIs can create swap requests', code: 'FORBIDDEN' });
    }

    const body = createSwapRequestSchema.parse(req.body);

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, body.scheduleId)).limit(1);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });
    }
    if (schedule.status !== 'published') {
      return res.status(400).json({ error: 'Swap requests require a published schedule', code: 'INVALID_SCHEDULE' });
    }

    const [assignment] = await db
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.id, body.targetAssignmentId))
      .limit(1);

    if (!assignment || assignment.scheduleId !== body.scheduleId || assignment.piId !== req.user.userId) {
      return res.status(400).json({
        error: 'Target assignment must belong to the current PI on the selected schedule',
        code: 'INVALID_ASSIGNMENT',
      });
    }

    const [created] = await db.insert(swapRequests).values({
      scheduleId: body.scheduleId,
      requesterId: req.user.userId,
      targetAssignmentId: body.targetAssignmentId,
      preferredDates: serializePreferredDates(body.preferredDates),
      status: 'pending',
    }).returning();

    await logAudit(req.user.userId, 'swap_request.create', {
      scheduleId: body.scheduleId,
      targetAssignmentId: body.targetAssignmentId,
    });

    return res.status(201).json({
      data: {
        ...created,
        preferredDates: parsePreferredDates(created.preferredDates),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Swap requests error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod(['GET', 'POST'], withAuth(handler));
