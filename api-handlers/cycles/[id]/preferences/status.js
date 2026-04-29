import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { cycleShares } from '../../../../db/schema/cycle-shares.js';
import { preferences } from '../../../../db/schema/preferences.js';
import { fractionalPreferences } from '../../../../db/schema/fractional-preferences.js';
import { users } from '../../../../db/schema/users.js';
import { institutions } from '../../../../db/schema/institutions.js';
import { withAdmin } from '../../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';

async function handler(req, res) {
  try {
    const { id: cycleId } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    const shares = await db
      .select({
        piId: cycleShares.piId,
        piName: users.name,
        piEmail: users.email,
        institutionName: institutions.name,
        institutionAbbreviation: institutions.abbreviation,
        wholeShares: cycleShares.wholeShares,
        fractionalShares: cycleShares.fractionalShares,
      })
      .from(cycleShares)
      .innerJoin(users, eq(cycleShares.piId, users.id))
      .leftJoin(institutions, eq(cycleShares.institutionId, institutions.id))
      .where(and(eq(cycleShares.cycleId, cycleId), eq(users.isActive, true), isNull(users.deletedAt)))
      .orderBy(institutions.name);

    // When no snapshot taken yet, fall back to all active+activated PI users
    let piList = shares;
    if (shares.length === 0) {
      const piUsers = await db
        .select({
          piId: users.id,
          piName: users.name,
          piEmail: users.email,
          institutionName: institutions.name,
          institutionAbbreviation: institutions.abbreviation,
        })
        .from(users)
        .leftJoin(institutions, eq(users.institutionId, institutions.id))
        .where(and(eq(users.role, 'pi'), eq(users.isActive, true), eq(users.isActivated, true), isNull(users.deletedAt)))
        .orderBy(institutions.name);

      piList = piUsers.map((u) => ({ ...u, wholeShares: null, fractionalShares: null }));
    }

    const submittedWhole = await db
      .select({ piId: preferences.piId })
      .from(preferences)
      .where(and(eq(preferences.cycleId, cycleId), isNotNull(preferences.submittedAt)))
      .groupBy(preferences.piId);

    const submittedFractional = await db
      .select({ piId: fractionalPreferences.piId })
      .from(fractionalPreferences)
      .where(and(eq(fractionalPreferences.cycleId, cycleId), isNotNull(fractionalPreferences.submittedAt)))
      .groupBy(fractionalPreferences.piId);

    const submittedPiIds = new Set([
      ...submittedWhole.map((s) => s.piId),
      ...submittedFractional.map((s) => s.piId),
    ]);

    const status = piList.map((s) => ({
      ...s,
      hasSubmitted: submittedPiIds.has(s.piId),
    }));

    const totalPIs = status.length;
    const submittedCount = status.filter((s) => s.hasSubmitted).length;

    return res.status(200).json({
      data: {
        status,
        summary: {
          total: totalPIs,
          submitted: submittedCount,
          pending: totalPIs - submittedCount,
        },
      },
    });
  } catch (err) {
    console.error('Preference status error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('GET', withAdmin(handler));
