import { z } from 'zod';
import { desc, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles } from '../../db/schema/cycles.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { getZodMessage } from '../../lib/validation.js';
import { ROLES } from '../../lib/constants.js';

const createCycleSchema = z.object({
  name: z.string().trim().min(1, 'Cycle name is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  preferenceDeadline: z.string().min(1, 'Preference deadline is required'),
}).refine((data) => data.startDate <= data.endDate, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate'],
});


async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { page, limit, offset } = parsePagination(req.query || {});
      const rows = await db
        .select()
        .from(cycles)
        .orderBy(desc(cycles.createdAt))
        .limit(limit)
        .offset(offset);
      const [{ total }] = await db.select({ total: count() }).from(cycles);
      return res.status(200).json(paginatedResponse(rows, Number(total), page, limit));
    }

    const body = createCycleSchema.parse(req.body);
    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }

    const [created] = await db.insert(cycles).values({
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      preferenceDeadline: new Date(body.preferenceDeadline),
      status: 'setup',
    }).returning();

    await logAudit(req.user.userId, 'cycle.create', { cycleId: created.id, name: body.name });
    return res.status(201).json({ data: created });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Cycles error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAuth(withMethod(['GET', 'POST'], handler));
