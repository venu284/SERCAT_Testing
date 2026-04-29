import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycleShares } from '../../../../db/schema/cycle-shares.js';
import { institutions } from '../../../../db/schema/institutions.js';
import { users } from '../../../../db/schema/users.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { withAdmin } from '../../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    const rows = await db
      .select({
        id: cycleShares.id,
        cycleId: cycleShares.cycleId,
        institutionId: cycleShares.institutionId,
        institutionName: institutions.name,
        institutionAbbreviation: institutions.abbreviation,
        piId: cycleShares.piId,
        piName: users.name,
        piEmail: users.email,
        isActive: users.isActive,
        wholeShares: cycleShares.wholeShares,
        fractionalShares: cycleShares.fractionalShares,
        snapshotAt: cycleShares.snapshotAt,
      })
      .from(cycleShares)
      .innerJoin(institutions, eq(cycleShares.institutionId, institutions.id))
      .innerJoin(users, eq(cycleShares.piId, users.id))
      .where(and(eq(cycleShares.cycleId, id), isNull(users.deletedAt)))
      .orderBy(institutions.name);

    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('Cycle shares error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('GET', handler));
