import { eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { masterShares } from '../../../../db/schema/master-shares.js';
import { cycleShares } from '../../../../db/schema/cycle-shares.js';
import { withAdmin } from '../../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';
import { logAudit } from '../../../../lib/audit.js';

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }
    if (!['setup', 'collecting', 'scheduling'].includes(cycle.status)) {
      return res.status(400).json({
        error: `Cannot snapshot shares when cycle is in "${cycle.status}" status. Must be "setup", "collecting", or "scheduling".`,
        code: 'INVALID_STATUS',
      });
    }

    await db.delete(cycleShares).where(eq(cycleShares.cycleId, id));

    const masters = await db.select().from(masterShares);
    if (masters.length === 0) {
      return res.status(400).json({
        error: 'No master shares to snapshot. Upload shares first.',
        code: 'NO_SHARES',
      });
    }

    const now = new Date();
    const rows = masters.map((ms) => ({
      cycleId: id,
      institutionId: ms.institutionId,
      piId: ms.piId,
      wholeShares: ms.wholeShares,
      fractionalShares: ms.fractionalShares,
      snapshotAt: now,
    }));

    const inserted = await db.insert(cycleShares).values(rows).returning();

    await logAudit(req.user.userId, 'cycle.shares_snapshot', {
      cycleId: id,
      shareCount: inserted.length,
    });

    return res.status(201).json({
      data: {
        message: `Snapshot created with ${inserted.length} share entries`,
        count: inserted.length,
        snapshotAt: now,
      },
    });
  } catch (err) {
    console.error('Snapshot error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('POST', handler));
