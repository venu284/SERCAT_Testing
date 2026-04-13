import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { preferences } from '../../../../db/schema/preferences.js';
import { users } from '../../../../db/schema/users.js';
import { institutions } from '../../../../db/schema/institutions.js';
import { withAuth } from '../../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';

const submitPreferenceSchema = z.object({
  preferences: z.array(z.object({
    shareIndex: z.number().int().min(1),
    slotKey: z.enum(['DAY1', 'DAY2', 'NS']),
    choice1Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    choice2Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    const { id: cycleId } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    if (req.method === 'GET') {
      if (req.user.role === 'admin') {
        const rows = await db
          .select({
            id: preferences.id,
            cycleId: preferences.cycleId,
            piId: preferences.piId,
            piName: users.name,
            piEmail: users.email,
            institutionName: institutions.name,
            shareIndex: preferences.shareIndex,
            slotKey: preferences.slotKey,
            choice1Date: preferences.choice1Date,
            choice2Date: preferences.choice2Date,
            submittedAt: preferences.submittedAt,
            updatedAt: preferences.updatedAt,
          })
          .from(preferences)
          .innerJoin(users, eq(preferences.piId, users.id))
          .leftJoin(institutions, eq(users.institutionId, institutions.id))
          .where(eq(preferences.cycleId, cycleId))
          .orderBy(users.name, preferences.shareIndex, preferences.slotKey);

        return res.status(200).json({ data: rows });
      }

      const rows = await db
        .select()
        .from(preferences)
        .where(and(eq(preferences.cycleId, cycleId), eq(preferences.piId, req.user.userId)))
        .orderBy(preferences.shareIndex, preferences.slotKey);

      return res.status(200).json({ data: rows });
    }

    if (!['collecting', 'setup'].includes(cycle.status)) {
      return res.status(400).json({
        error: `Cannot submit preferences when cycle is in "${cycle.status}" status`,
        code: 'INVALID_CYCLE_STATUS',
      });
    }

    const body = submitPreferenceSchema.parse(req.body);
    const piId = req.user.userId;
    const now = new Date();

    await db.delete(preferences).where(
      and(eq(preferences.cycleId, cycleId), eq(preferences.piId, piId)),
    );

    if (body.preferences.length > 0) {
      const rows = body.preferences.map((p) => ({
        cycleId,
        piId,
        shareIndex: p.shareIndex,
        slotKey: p.slotKey,
        choice1Date: p.choice1Date || null,
        choice2Date: p.choice2Date || null,
        submittedAt: now,
        updatedAt: now,
      }));

      await db.insert(preferences).values(rows);
    }

    const inserted = await db
      .select()
      .from(preferences)
      .where(and(eq(preferences.cycleId, cycleId), eq(preferences.piId, piId)))
      .orderBy(preferences.shareIndex, preferences.slotKey);

    return res.status(200).json({ data: inserted });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Preferences error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod(['GET', 'POST'], withAuth(handler));
