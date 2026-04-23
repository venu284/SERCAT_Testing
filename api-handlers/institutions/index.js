import { z } from 'zod';
import { count, ilike } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Institution name is required'),
  abbreviation: z.string().trim().min(1, 'Abbreviation is required').max(20),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { page, limit, offset } = parsePagination(req.query || {});
      const rows = await db
        .select()
        .from(institutions)
        .orderBy(institutions.name)
        .limit(limit)
        .offset(offset);
      const [{ total }] = await db.select({ total: count() }).from(institutions);
      return res.status(200).json(paginatedResponse(rows, Number(total), page, limit));
    }

    const body = createSchema.parse(req.body);

    const [existingName] = await db
      .select()
      .from(institutions)
      .where(ilike(institutions.name, body.name))
      .limit(1);
    if (existingName) {
      return res.status(409).json({
        error: `Institution "${body.name}" already exists`,
        code: 'DUPLICATE',
      });
    }

    const [existingAbbr] = await db
      .select()
      .from(institutions)
      .where(ilike(institutions.abbreviation, body.abbreviation))
      .limit(1);
    if (existingAbbr) {
      return res.status(409).json({
        error: `Abbreviation "${body.abbreviation}" already exists`,
        code: 'DUPLICATE',
      });
    }

    const [created] = await db.insert(institutions).values(body).returning();
    await logAudit(req.user.userId, 'institution.create', {
      institutionId: created.id,
      name: body.name,
      abbreviation: body.abbreviation,
    });

    return res.status(201).json({ data: created });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Institutions error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod(['GET', 'POST'], handler));
