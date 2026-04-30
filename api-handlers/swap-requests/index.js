import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { swapRequests } from '../../db/schema/swap-requests.js';
import { scheduleAssignments } from '../../db/schema/schedule-assignments.js';
import { schedules } from '../../db/schema/schedules.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import {
  isIsoDateString,
  mapSwapRequestRow,
  parsePreferredDates,
  serializePreferredDates,
  swapRequestBaseQuery,
} from '../../lib/swap-request-utils.js';
import { getZodMessage, uuidSchema } from '../../lib/validation.js';
import { ROLES } from '../../lib/constants.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';

const createSwapRequestSchema = z.object({
  scheduleId: uuidSchema,
  targetAssignmentId: uuidSchema,
  preferredDates: z.array(z.string()).optional().default([]),
}).superRefine((body, ctx) => {
  body.preferredDates.forEach((date, index) => {
    if (!isIsoDateString(date)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Preferred dates must use YYYY-MM-DD format',
        path: ['preferredDates', index],
      });
    }
  });
});

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { page, limit, offset } = parsePagination(req.query || {});
      const isAdmin = req.user.role === ROLES.ADMIN;

      const countQuery = db.select({ total: count() }).from(swapRequests);
      const [{ total }] = isAdmin
        ? await countQuery
        : await countQuery.where(eq(swapRequests.requesterId, req.user.userId));

      const baseQuery = swapRequestBaseQuery();
      const rows = isAdmin
        ? await baseQuery.orderBy(desc(swapRequests.createdAt)).limit(limit).offset(offset)
        : await baseQuery
          .where(eq(swapRequests.requesterId, req.user.userId))
          .orderBy(desc(swapRequests.createdAt))
          .limit(limit)
          .offset(offset);

      return res.status(200).json(paginatedResponse(rows.map(mapSwapRequestRow), Number(total), page, limit));
    }

    if (req.user.role === ROLES.ADMIN) {
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
