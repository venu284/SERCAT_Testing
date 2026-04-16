import { eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { withAdmin } from '../../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';
import { logAudit } from '../../../../lib/audit.js';
import { loadEngineInput } from '../../../../lib/scheduling/data-loader.js';
import { runSchedulingEngine } from '../../../../lib/scheduling/engine.js';
import { persistEngineResults } from '../../../../lib/scheduling/result-persister.js';

async function handler(req, res) {
  const { id: cycleId } = req.query;
  let previousStatus = null;

  try {
    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }
    if (cycle.status === 'archived') {
      return res.status(400).json({ error: 'Cannot generate schedule for an archived cycle', code: 'CYCLE_ARCHIVED' });
    }

    previousStatus = cycle.status;
    const engineInput = await loadEngineInput(cycleId);
    const activeShares = (engineInput.shares || []).filter((share) => (
      share.isActive
      && ((Number(share.wholeShares) || 0) > 0 || (Number(share.fractionalShares) || 0) > 0)
    ));
    if (activeShares.length === 0) {
      return res.status(400).json({ error: 'No active members with shares in this cycle. Snapshot shares first.', code: 'NO_MEMBERS' });
    }

    await db.update(cycles).set({ status: 'scheduling', updatedAt: new Date() }).where(eq(cycles.id, cycleId));

    const engineOutput = runSchedulingEngine(engineInput);
    const { scheduleId, scheduleVersion } = await persistEngineResults(engineOutput, engineInput, req.user.userId);

    await logAudit(req.user.userId, 'schedule.generate', {
      cycleId,
      scheduleId,
      version: scheduleVersion,
      assignmentCount: engineOutput.assignments.length,
      errors: engineOutput.errors.length,
    });

    return res.status(200).json({
      data: {
        scheduleId,
        version: scheduleVersion,
        status: 'draft',
        _scheduleId: scheduleId,
        ...engineOutput,
      },
    });
  } catch (err) {
    if (previousStatus !== null) {
      try {
        await db.update(cycles).set({ status: previousStatus, updatedAt: new Date() }).where(eq(cycles.id, cycleId));
      } catch (rollbackErr) {
        console.error('Failed to rollback cycle status:', rollbackErr);
      }
    }
    console.error('Generate schedule error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', withAdmin(handler));
