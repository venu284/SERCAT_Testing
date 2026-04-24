import { z } from 'zod';
import { eq, and, ne, ilike } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { getZodMessage } from '../../lib/validation.js';

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  abbreviation: z.string().trim().min(1).max(20).optional(),
}).refine((data) => data.name || data.abbreviation, { message: 'At least one field required' });


async function handler(req, res) {
  try {
    const { id } = req.query;

    const [existing] = await db.select().from(institutions).where(eq(institutions.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Institution not found', code: 'NOT_FOUND' });
    }

    const body = updateSchema.parse(req.body);

    if (body.name) {
      const [dup] = await db
        .select()
        .from(institutions)
        .where(and(ilike(institutions.name, body.name), ne(institutions.id, id)))
        .limit(1);
      if (dup) {
        return res.status(409).json({
          error: `Institution "${body.name}" already exists`,
          code: 'DUPLICATE',
        });
      }
    }

    if (body.abbreviation) {
      const [dup] = await db
        .select()
        .from(institutions)
        .where(and(ilike(institutions.abbreviation, body.abbreviation), ne(institutions.id, id)))
        .limit(1);
      if (dup) {
        return res.status(409).json({
          error: `Abbreviation "${body.abbreviation}" already exists`,
          code: 'DUPLICATE',
        });
      }
    }

    const [updated] = await db
      .update(institutions)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(institutions.id, id))
      .returning();

    await logAudit(req.user.userId, 'institution.update', { institutionId: id, changes: body });
    return res.status(200).json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Institution update error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('PUT', handler));
