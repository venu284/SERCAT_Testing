import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { masterShares } from '../../db/schema/master-shares.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';

const updateShareSchema = z.object({
  wholeShares: z.number().int().min(0).optional(),
  fractionalShares: z.number().min(0).optional(),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [existing] = await db.select().from(masterShares).where(eq(masterShares.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Share entry not found', code: 'NOT_FOUND' });
    }

    const body = updateShareSchema.parse(req.body);
    const updateData = { updatedAt: new Date() };
    if (body.wholeShares !== undefined) updateData.wholeShares = body.wholeShares;
    if (body.fractionalShares !== undefined) updateData.fractionalShares = String(body.fractionalShares);

    const [updated] = await db
      .update(masterShares)
      .set(updateData)
      .where(eq(masterShares.id, id))
      .returning();

    await logAudit(req.user.userId, 'shares.update', { shareId: id, changes: body });
    return res.status(200).json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Share update error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('PUT', handler));
