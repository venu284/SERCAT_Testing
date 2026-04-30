import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { schedules } from '../../db/schema/schedules.js';
import { scheduleAssignments } from '../../db/schema/schedule-assignments.js';
import { runAnalytics } from '../../db/schema/run-analytics.js';

export async function persistEngineResults(engineOutput, inputMeta, adminUserId) {
  const {
    assignments,
    fairness,
    fairnessMetrics,
    metadata,
    engineLog,
    errors,
    warnings,
    analytics,
    satisfaction,
    runQuality,
    deficitUpdates,
  } = engineOutput;
  const { _cycleId, _abbrToPiId, _abbrToInstitutionId } = inputMeta;

  const [lastSchedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.cycleId, _cycleId))
    .orderBy(desc(schedules.version))
    .limit(1);

  const nextVersion = (lastSchedule?.version || 0) + 1;

  const totalAssignments = assignments.length;
  const firstChoicePct = runQuality?.firstChoicePct ?? (totalAssignments > 0
    ? assignments.filter((a) => ['choice1', 'choice1_no_conflict'].includes(a.assignmentReason)).length / totalAssignments
    : 0);
  const secondChoicePct = runQuality?.secondChoicePct ?? (totalAssignments > 0
    ? assignments.filter((a) => a.assignmentReason === 'choice2').length / totalAssignments
    : 0);
  const fallbackPct = runQuality?.fallbackPct ?? (1 - firstChoicePct - secondChoicePct);

  return await db.transaction(async (tx) => {
    const [schedule] = await tx.insert(schedules).values({
      cycleId: _cycleId,
      version: nextVersion,
      status: 'draft',
      generatedBy: adminUserId,
    }).returning();

    const assignmentRows = assignments
      .filter((a) => _abbrToPiId[a.memberId] && _abbrToInstitutionId[a.memberId])
      .map((a) => {
        let choiceRank = null;
        if (a.choiceRank != null) choiceRank = a.choiceRank;
        else if (['choice1', 'choice1_no_conflict'].includes(a.assignmentReason)) choiceRank = 1;
        else if (a.assignmentReason === 'choice2') choiceRank = 2;

        return {
          scheduleId: schedule.id,
          piId: _abbrToPiId[a.memberId],
          institutionId: _abbrToInstitutionId[a.memberId],
          shareIndex: a.shareIndex || 0,
          blockIndex: a.blockIndex || null,
          assignedDate: a.assignedDate,
          shift: a.shift,
          isManualOverride: false,
          choiceRank,
          assignmentReason: a.assignmentReason || 'auto_assigned',
          hours: String(a.hours ?? (a.shift === 'NS' ? 12 : 6)),
          fractionalHours: a.fractionalHours != null ? String(a.fractionalHours) : null,
          isShared: Boolean(a.isShared),
          sharedWithPiId: a.sharedWith ? (_abbrToPiId[a.sharedWith] || null) : null,
        };
      });

    if (assignmentRows.length > 0) {
      await tx.insert(scheduleAssignments).values(assignmentRows);
    }

    await tx.insert(runAnalytics).values({
      scheduleId: schedule.id,
      totalFirstChoicePct: String((firstChoicePct * 100).toFixed(2)),
      totalSecondChoicePct: String((secondChoicePct * 100).toFixed(2)),
      totalFallbackPct: String((fallbackPct * 100).toFixed(2)),
      compositeScore: runQuality?.compositeScore != null ? String(Number(runQuality.compositeScore).toFixed(4)) : null,
      fairnessStdDeviation: fairnessMetrics?.overallStdDev != null
        ? String(Number(fairnessMetrics.overallStdDev).toFixed(4))
        : (fairness?.deviation?.stdDev != null ? String(Number(fairness.deviation.stdDev).toFixed(4)) : null),
      manualAdjustmentsCount: 0,
      piSatisfactionScores: satisfaction || fairness?.memberSatisfaction || null,
      engineLog: engineLog || [],
      inputSnapshot: analytics?.inputSnapshot || inputMeta || null,
      detectedPatterns: {
        metadata: metadata || {},
        errors: errors || [],
        warnings: warnings || [],
        updatedPriorityQueue: fairness?.updatedPriorityQueue || [],
        workingQueueFinal: fairness?.workingQueueFinal || [],
        deviationMean: fairness?.deviation?.mean ?? 0,
        fairnessMetrics: fairnessMetrics || null,
        runQuality: runQuality || null,
        analytics: analytics || null,
        deficitUpdates: deficitUpdates || [],
      },
    });

    return {
      scheduleId: schedule.id,
      scheduleVersion: nextVersion,
    };
  });
}
