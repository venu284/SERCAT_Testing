import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { schedules } from '../../../../db/schema/schedules.js';
import { scheduleAssignments } from '../../../../db/schema/schedule-assignments.js';
import { institutions } from '../../../../db/schema/institutions.js';
import { runAnalytics } from '../../../../db/schema/run-analytics.js';
import { withAuth } from '../../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';
import { ROLES } from '../../../../lib/constants.js';

async function handler(req, res) {
  try {
    const { id: cycleId } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    let schedule;
    if (req.user.role === ROLES.ADMIN) {
      [schedule] = await db
        .select()
        .from(schedules)
        .where(eq(schedules.cycleId, cycleId))
        .orderBy(desc(schedules.version))
        .limit(1);
    } else {
      [schedule] = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.cycleId, cycleId), eq(schedules.status, 'published')))
        .orderBy(desc(schedules.version))
        .limit(1);
    }

    if (!schedule) {
      return res.status(200).json({ data: null });
    }

    const assignments = await db
      .select({
        id: scheduleAssignments.id,
        memberId: institutions.abbreviation,
        memberName: institutions.name,
        piId: scheduleAssignments.piId,
        institutionId: scheduleAssignments.institutionId,
        assignedDate: scheduleAssignments.assignedDate,
        shift: scheduleAssignments.shift,
        shareIndex: scheduleAssignments.shareIndex,
        blockIndex: scheduleAssignments.blockIndex,
        isManualOverride: scheduleAssignments.isManualOverride,
        choiceRank: scheduleAssignments.choiceRank,
        assignmentReason: scheduleAssignments.assignmentReason,
        hours: scheduleAssignments.hours,
        fractionalHours: scheduleAssignments.fractionalHours,
        isShared: scheduleAssignments.isShared,
        sharedWithPiId: scheduleAssignments.sharedWithPiId,
      })
      .from(scheduleAssignments)
      .innerJoin(institutions, eq(scheduleAssignments.institutionId, institutions.id))
      .where(eq(scheduleAssignments.scheduleId, schedule.id))
      .orderBy(scheduleAssignments.assignedDate, scheduleAssignments.shift);

    const piIdToAbbr = {};
    assignments.forEach((a) => {
      if (a.piId && a.memberId) piIdToAbbr[a.piId] = a.memberId;
    });

    const mappedAssignments = assignments.map((a) => ({
      ...a,
      assignmentReason: a.isManualOverride ? 'manual_override' : (a.assignmentReason || 'auto_assigned'),
      hours: parseFloat(a.hours) || (a.shift === 'NS' ? 12 : 6),
      fractionalHours: a.fractionalHours != null ? parseFloat(a.fractionalHours) : null,
      isShared: Boolean(a.isShared),
      sharedWith: a.sharedWithPiId ? (piIdToAbbr[a.sharedWithPiId] || null) : null,
      coAssignments: a.sharedWithPiId ? [{ memberId: piIdToAbbr[a.sharedWithPiId] || null, piId: a.sharedWithPiId }] : [],
    }));

    const [analytics] = await db
      .select()
      .from(runAnalytics)
      .where(eq(runAnalytics.scheduleId, schedule.id))
      .limit(1);

    const filteredAssignments = req.user.role === ROLES.PI
      ? mappedAssignments.filter((a) => a.piId === req.user.userId)
      : mappedAssignments;

    return res.status(200).json({
      data: {
        scheduleId: schedule.id,
        cycleId: schedule.cycleId,
        version: schedule.version,
        status: schedule.status,
        generatedAt: schedule.generatedAt,
        publishedAt: schedule.publishedAt,
        assignments: filteredAssignments,
        analytics: req.user.role === ROLES.ADMIN
          ? ({
            ...analytics,
            fairnessStdDeviation: analytics?.fairnessStdDeviation != null ? parseFloat(analytics.fairnessStdDeviation) : null,
            totalFirstChoicePct: analytics?.totalFirstChoicePct != null ? parseFloat(analytics.totalFirstChoicePct) : null,
            totalSecondChoicePct: analytics?.totalSecondChoicePct != null ? parseFloat(analytics.totalSecondChoicePct) : null,
            totalFallbackPct: analytics?.totalFallbackPct != null ? parseFloat(analytics.totalFallbackPct) : null,
            compositeScore: analytics?.compositeScore != null ? parseFloat(analytics.compositeScore) : null,
          })
          : null,
      },
    });
  } catch (err) {
    console.error('Get schedule error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('GET', withAuth(handler));
