function round(value, precision = 4) {
  return Number(Number(value || 0).toFixed(precision));
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function isFirstChoice(assignment) {
  return assignment.choiceRank === 1
    || ['choice1', 'choice1_no_conflict'].includes(assignment.assignmentReason);
}

function isSecondChoice(assignment) {
  return assignment.choiceRank === 2 || assignment.assignmentReason === 'choice2';
}

function isAutoAssigned(assignment) {
  return ['auto_assigned', 'fractional_packed'].includes(assignment.assignmentReason);
}

export function calculateSatisfaction(assignments, config) {
  const grouped = new Map();

  (assignments || []).forEach((assignment) => {
    const key = assignment.institutionId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        institutionId: assignment.institutionId,
        memberId: assignment.memberId || assignment.institutionId,
        scores: [],
        breakdown: { DS1: [], DS2: [], NS: [] },
      });
    }

    const score = isFirstChoice(assignment)
      ? config.satisfactionScores.firstChoice
      : isSecondChoice(assignment)
        ? config.satisfactionScores.secondChoice
        : isAutoAssigned(assignment)
          ? config.satisfactionScores.autoAssigned
          : config.satisfactionScores.fallback;

    const bucket = grouped.get(key);
    bucket.scores.push(score);
    bucket.breakdown[assignment.shift]?.push({
      assignmentReason: assignment.assignmentReason,
      score,
      choiceRank: assignment.choiceRank ?? null,
    });
  });

  return Array.from(grouped.values()).map((bucket) => {
    const total = bucket.scores.reduce((sum, value) => sum + value, 0);
    const average = bucket.scores.length > 0 ? total / bucket.scores.length : 0;
    return {
      institutionId: bucket.institutionId,
      memberId: bucket.memberId,
      score: round(total),
      averageSatisfaction: round(average),
      breakdown: bucket.breakdown,
    };
  });
}

export function calculateFairnessMetrics(satisfaction) {
  const averages = satisfaction.map((entry) => entry.averageSatisfaction);
  const overallStdDev = round(standardDeviation(averages));

  const shiftBreakdown = ['DS1', 'DS2', 'NS'].reduce((acc, shift) => {
    const shiftScores = satisfaction.flatMap((entry) => (entry.breakdown?.[shift] || []).map((item) => item.score));
    const avg = shiftScores.length > 0
      ? shiftScores.reduce((sum, value) => sum + value, 0) / shiftScores.length
      : 0;
    acc[shift] = {
      averageSatisfaction: round(avg),
      assignmentCount: shiftScores.length,
    };
    return acc;
  }, {});

  return {
    overallStdDev,
    institutionBreakdown: satisfaction.map((entry) => ({
      institutionId: entry.institutionId,
      memberId: entry.memberId,
      avgSatisfaction: entry.averageSatisfaction,
      firstChoicePct: round(
        (entry.breakdown?.DS1 || [])
          .concat(entry.breakdown?.DS2 || [])
          .concat(entry.breakdown?.NS || [])
          .filter((item) => ['choice1', 'choice1_no_conflict'].includes(item.assignmentReason)).length
        / Math.max(
          1,
          (entry.breakdown?.DS1 || []).length + (entry.breakdown?.DS2 || []).length + (entry.breakdown?.NS || []).length,
        ),
      ),
    })),
    shiftBreakdown,
  };
}

export function calculateRunQuality(assignments, satisfaction, fairnessMetrics, config) {
  const total = assignments.length || 1;
  const firstChoicePct = assignments.filter(isFirstChoice).length / total;
  const secondChoicePct = assignments.filter(isSecondChoice).length / total;
  const fallbackPct = assignments.filter((entry) => !isFirstChoice(entry) && !isSecondChoice(entry)).length / total;
  const cycleSatisfaction = satisfaction.length > 0
    ? satisfaction.reduce((sum, entry) => sum + entry.averageSatisfaction, 0) / satisfaction.length
    : 0;
  const normalizedStdDev = Math.min(1, fairnessMetrics.overallStdDev);
  const compositeScore = (
    (config.qualityWeights.satisfaction * cycleSatisfaction) +
    (config.qualityWeights.fairness * (1 - normalizedStdDev)) +
    (config.qualityWeights.fallbackPenalty * (1 - fallbackPct))
  );

  return {
    firstChoicePct: round(firstChoicePct),
    secondChoicePct: round(secondChoicePct),
    fallbackPct: round(fallbackPct),
    compositeScore: round(compositeScore),
  };
}

export function calculateDeficitUpdates(assignments, config) {
  const grouped = new Map();

  (assignments || []).forEach((assignment) => {
    const key = `${assignment.institutionId}:${assignment.shift}`;
    let delta = 0;

    if (isFirstChoice(assignment) && assignment.wonConflict) {
      delta = config.conflictWinnerDeficit;
    } else if (isSecondChoice(assignment)) {
      delta = 0;
    } else if (!isFirstChoice(assignment) && !isSecondChoice(assignment)) {
      delta = config.fallbackDeficit;
    }

    grouped.set(key, (grouped.get(key) || 0) + delta);
  });

  return Array.from(grouped.entries()).map(([key, newDeficitScore]) => {
    const [institutionId, shift] = key.split(':');
    return {
      institutionId,
      shift,
      newDeficitScore: round(newDeficitScore),
    };
  });
}
