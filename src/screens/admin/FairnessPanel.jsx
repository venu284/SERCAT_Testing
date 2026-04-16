import React, { useMemo } from 'react';
import FairnessDashboard from '../../components/FairnessDashboard';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useSchedule } from '../../hooks/useApiData';
import { CONCEPT_THEME } from '../../lib/theme';

function StatusCard({ title, detail }) {
  return (
    <div
      className="rounded-2xl px-6 py-5 concept-font-body concept-anim-fade"
      style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}
    >
      <h2 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>{title}</h2>
      <p className="mt-2 text-base" style={{ color: CONCEPT_THEME.muted }}>{detail}</p>
    </div>
  );
}

function buildResults(schedule) {
  if (!schedule) {
    return { results: null, queue: [] };
  }

  const detected = schedule.analytics?.detectedPatterns || {};
  const stdDev = schedule.analytics?.fairnessStdDeviation != null
    ? Number(schedule.analytics.fairnessStdDeviation)
    : 0;
  const mean = detected.deviationMean != null ? parseFloat(detected.deviationMean) : 0;
  const queue = detected.updatedPriorityQueue || [];

  return {
    results: {
      assignments: schedule.assignments || [],
      fairness: {
        memberSatisfaction: schedule.analytics?.piSatisfactionScores || [],
        updatedPriorityQueue: queue,
        workingQueueFinal: detected.workingQueueFinal || [],
        deviation: { mean, stdDev },
      },
      metadata: detected.metadata || {
        totalRounds: 0,
        totalConflicts: 0,
        totalProximity: 0,
        totalAuto: 0,
        totalBackfill: 0,
      },
      engineLog: detected.engineLog || schedule.analytics?.engineLog || [],
      errors: detected.errors || [],
      warnings: detected.warnings || [],
      analytics: schedule.analytics || null,
    },
    queue,
  };
}

export default function FairnessPanel() {
  const { activeCycleId, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const scheduleQuery = useSchedule(activeCycleId);
  const { results, queue } = useMemo(() => buildResults(scheduleQuery.data), [scheduleQuery.data]);

  if (cycleLoading || scheduleQuery.isLoading) {
    return (
      <StatusCard
        title="Loading fairness data..."
        detail="Fetching the active cycle and latest schedule analytics."
      />
    );
  }

  if (cycleError || scheduleQuery.error) {
    return (
      <StatusCard
        title="Unable to load fairness data"
        detail={(cycleError || scheduleQuery.error)?.message || 'Please try again in a moment.'}
      />
    );
  }

  if (!activeCycleId) {
    return (
      <StatusCard
        title="Fairness dashboard unavailable"
        detail="No active cycle is available yet."
      />
    );
  }

  if (!results) {
    return (
      <StatusCard
        title="Fairness dashboard unavailable"
        detail="Run the engine to populate this screen."
      />
    );
  }

  return <FairnessDashboard results={results} initialQueue={queue} />;
}
