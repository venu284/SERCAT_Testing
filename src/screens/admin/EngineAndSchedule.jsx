import React, { useCallback, useMemo, useState } from 'react';
import CalendarResults from '../../components/CalendarResults';
import { ASSIGNMENT_REASON_LABELS } from '../../lib/constants';
import { COLORS, CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import {
  useAvailableDates,
  useCycleShares,
  useGenerateSchedule,
  usePreferenceStatus,
  usePreferences,
  usePublishSchedule,
  useSchedule,
  useUnpublishSchedule,
  useUsers,
} from '../../hooks/useApiData';
import { extractRows } from '../../lib/api';

function buildMemberDirectory(sharesData, usersData) {
  const dir = {};
  const shares = extractRows(sharesData);
  const users = extractRows(usersData);
  const userMap = {};
  users.forEach((user) => {
    userMap[user.id] = user;
  });

  shares.forEach((share) => {
    const abbr = share.institutionAbbreviation || share.abbreviation || share.institutionId;
    if (!abbr) return;
    const user = userMap[share.piId] || {};
    if (!dir[abbr]) {
      dir[abbr] = {
        id: abbr,
        name: share.institutionName || abbr,
        piName: user.name || share.piName || '',
        piEmail: user.email || share.piEmail || '',
        shares: Number(share.wholeShares || 0) + Number(share.fractionalShares || 0),
        status: share.isActive === false ? 'DEACTIVATED' : 'ACTIVE',
      };
    }
  });

  return dir;
}

function buildMembers(sharesData) {
  const shares = extractRows(sharesData);
  const map = {};

  shares.forEach((share) => {
    const abbr = share.institutionAbbreviation || share.abbreviation || share.institutionId;
    if (!abbr) return;
    if (!map[abbr]) {
      map[abbr] = {
        id: abbr,
        name: share.institutionName || abbr,
        shares: Number(share.wholeShares || 0) + Number(share.fractionalShares || 0),
        status: share.isActive === false ? 'DEACTIVATED' : 'ACTIVE',
      };
    }
  });

  return Object.values(map);
}

function buildOriginalChoiceMarks(preferencesPayload, sharesData) {
  const wholePreferences = Array.isArray(preferencesPayload?.preferences) ? preferencesPayload.preferences : [];
  const fractionalPreferences = Array.isArray(preferencesPayload?.fractionalPreferences) ? preferencesPayload.fractionalPreferences : [];
  const shares = extractRows(sharesData);
  const piToMemberId = Object.fromEntries(
    shares
      .map((share) => [share.piId, share.institutionAbbreviation || share.abbreviation || share.institutionId])
      .filter((entry) => entry[0] && entry[1]),
  );

  const marks = {};
  wholePreferences.forEach((preference) => {
    const memberId = piToMemberId[preference.piId];
    if (!memberId) return;
    if (preference.choice1Date) {
      const key = `${preference.choice1Date}:${preference.shift}`;
      if (!marks[key]) marks[key] = [];
      marks[key].push(`${memberId} S${preference.shareIndex || 0} 1st`);
    }
    if (preference.choice2Date) {
      const key = `${preference.choice2Date}:${preference.shift}`;
      if (!marks[key]) marks[key] = [];
      marks[key].push(`${memberId} S${preference.shareIndex || 0} 2nd`);
    }
  });

  fractionalPreferences.forEach((preference, index) => {
    const memberId = piToMemberId[preference.piId];
    if (!memberId) return;
    const blockIndex = preference.blockIndex || index + 1;
    const shift = (blockIndex - 1) % 2 === 0 ? 'DS1' : 'DS2';
    if (preference.choice1Date) {
      const key = `${preference.choice1Date}:${shift}`;
      if (!marks[key]) marks[key] = [];
      marks[key].push(`${memberId} F${blockIndex} 1st`);
    }
    if (preference.choice2Date) {
      const key = `${preference.choice2Date}:${shift}`;
      if (!marks[key]) marks[key] = [];
      marks[key].push(`${memberId} F${blockIndex} 2nd`);
    }
  });

  return marks;
}

export default function EngineAndSchedule() {
  const { activeCycle, activeCycleId, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const scheduleQuery = useSchedule(activeCycleId);
  const generateMutation = useGenerateSchedule();
  const publishMutation = usePublishSchedule();
  const unpublishMutation = useUnpublishSchedule();
  const prefStatusQuery = usePreferenceStatus(activeCycleId);
  const cycleSharesQuery = useCycleShares(activeCycleId);
  const usersQuery = useUsers({ all: true });
  const prefsQuery = usePreferences(activeCycleId);
  const datesQuery = useAvailableDates(activeCycleId);
  const [engineProgress, setEngineProgress] = useState({ running: false, value: 0, message: '' });

  const members = useMemo(() => buildMembers(cycleSharesQuery.data), [cycleSharesQuery.data]);
  const activeMembers = useMemo(() => members.filter((member) => member.status === 'ACTIVE'), [members]);
  const memberDirectory = useMemo(
    () => buildMemberDirectory(cycleSharesQuery.data, usersQuery.data),
    [cycleSharesQuery.data, usersQuery.data],
  );

  const results = useMemo(() => {
    const schedule = scheduleQuery.data;
    if (!schedule || !Array.isArray(schedule.assignments)) return null;

    const detected = schedule.analytics?.detectedPatterns || {};
    const stdDev = schedule.analytics?.fairnessStdDeviation != null
      ? Number(schedule.analytics.fairnessStdDeviation)
      : 0;
    const mean = detected.deviationMean != null ? parseFloat(detected.deviationMean) : 0;

    return {
      assignments: schedule.assignments,
      fairness: {
        memberSatisfaction: schedule.analytics?.piSatisfactionScores || [],
        updatedPriorityQueue: detected.updatedPriorityQueue || [],
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
      _scheduleId: schedule.scheduleId,
    };
  }, [scheduleQuery.data]);

  const schedulePublication = useMemo(() => ({
    status: scheduleQuery.data?.status || 'draft',
    draftedAt: scheduleQuery.data?.generatedAt || '',
    publishedAt: scheduleQuery.data?.publishedAt || '',
  }), [scheduleQuery.data]);

  const cycle = useMemo(() => {
    if (!activeCycle) {
      return { id: '', startDate: '', endDate: '', preferenceDeadline: '', blockedDates: [], blockedSlots: [] };
    }

    const blockedDates = [];
    const blockedSlots = [];
    extractRows(datesQuery.data).forEach((entry) => {
      if (!entry.isAvailable) {
        blockedDates.push(entry.date);
      } else {
        if (entry.ds1Available === false) blockedSlots.push(`${entry.date}:DS1`);
        if (entry.ds2Available === false) blockedSlots.push(`${entry.date}:DS2`);
        if (entry.nsAvailable === false) blockedSlots.push(`${entry.date}:NS`);
      }
    });

    let preferenceDeadline = activeCycle.preferenceDeadline || '';
    if (preferenceDeadline && preferenceDeadline.includes('T')) {
      preferenceDeadline = preferenceDeadline.split('T')[0];
    }

    return {
      id: activeCycle.name || activeCycle.id,
      startDate: activeCycle.startDate || '',
      endDate: activeCycle.endDate || '',
      preferenceDeadline,
      blockedDates: blockedDates.sort(),
      blockedSlots: blockedSlots.sort(),
    };
  }, [activeCycle, datesQuery.data]);

  const originalChoiceMarks = useMemo(
    () => buildOriginalChoiceMarks(prefsQuery.data, cycleSharesQuery.data),
    [prefsQuery.data, cycleSharesQuery.data],
  );

  const submittedCount = useMemo(() => (
    prefStatusQuery.data?.summary?.submitted ?? 0
  ), [prefStatusQuery.data]);

  const runEngine = useCallback(async () => {
    if (!activeCycleId) return;
    setEngineProgress({ running: true, value: 20, message: 'Sending to server...' });
    try {
      setEngineProgress({ running: true, value: 50, message: 'Generating schedule...' });
      await generateMutation.mutateAsync(activeCycleId);
      setEngineProgress({ running: true, value: 90, message: 'Loading results...' });
      await scheduleQuery.refetch();
      setEngineProgress({ running: false, value: 100, message: 'Draft ready for review.' });
    } catch (err) {
      setEngineProgress({ running: false, value: 0, message: `Error: ${err.message}` });
    }
  }, [activeCycleId, generateMutation, scheduleQuery]);

  const publishSchedule = useCallback(async () => {
    if (!results?._scheduleId) return;
    try {
      await publishMutation.mutateAsync(results._scheduleId);
      await scheduleQuery.refetch();
    } catch (err) {
      console.error('Publish failed:', err);
    }
  }, [publishMutation, results, scheduleQuery]);

  const markScheduleDraft = useCallback(async () => {
    if (!results?._scheduleId) return;
    try {
      await unpublishMutation.mutateAsync(results._scheduleId);
      await scheduleQuery.refetch();
    } catch (err) {
      console.error('Unpublish failed:', err);
    }
  }, [results, scheduleQuery, unpublishMutation]);

  const isLoading = cycleLoading
    || scheduleQuery.isLoading
    || prefStatusQuery.isLoading
    || cycleSharesQuery.isLoading
    || usersQuery.isLoading
    || prefsQuery.isLoading
    || datesQuery.isLoading;
  const error = cycleError
    || scheduleQuery.error
    || prefStatusQuery.error
    || cycleSharesQuery.error
    || usersQuery.error
    || prefsQuery.error
    || datesQuery.error;

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <p className="text-sm" style={{ color: CONCEPT_THEME.muted }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <p className="text-sm" style={{ color: CONCEPT_THEME.error }}>
          {error.message || 'Unable to load engine data.'}
        </p>
      </div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <p className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No active cycle. Create a cycle in Run Cycles first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-lg font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>Schedule Generator</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={runEngine}
            disabled={engineProgress.running || activeMembers.length === 0}
            className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed"
            style={{
              background: (engineProgress.running || activeMembers.length === 0) ? CONCEPT_THEME.sandDark : CONCEPT_THEME.navy,
              color: (engineProgress.running || activeMembers.length === 0) ? CONCEPT_THEME.muted : 'white',
            }}
          >
            Generate Schedule ({submittedCount}/{activeMembers.length} submitted)
          </button>
          {results && schedulePublication.status === 'draft' && (
            <button
              onClick={publishSchedule}
              disabled={publishMutation.isPending}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }}
            >
              {publishMutation.isPending ? 'Publishing...' : 'Publish Schedule'}
            </button>
          )}
          {results && schedulePublication.status === 'published' && (
            <button
              onClick={markScheduleDraft}
              disabled={unpublishMutation.isPending}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}
            >
              {unpublishMutation.isPending ? 'Reverting...' : 'Move Back To Draft'}
            </button>
          )}
          <span
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              background: schedulePublication.status === 'published' ? CONCEPT_THEME.emeraldLight : CONCEPT_THEME.amberLight,
              color: schedulePublication.status === 'published' ? CONCEPT_THEME.emerald : CONCEPT_THEME.accentOnAccent,
            }}
          >
            {schedulePublication.status === 'published' ? 'Published' : 'Draft Review'}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: CONCEPT_THEME.sand }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${engineProgress.value}%`, background: CONCEPT_THEME.navy }} />
        </div>
        <div className="mt-1.5 text-xs" style={{ color: CONCEPT_THEME.muted }}>{engineProgress.message}</div>
      </div>

      <CalendarResults
        results={results}
        cycle={cycle}
        members={members}
        memberDirectory={memberDirectory}
        originalChoiceMarks={originalChoiceMarks}
        showShiftLegend={false}
      />

      {results && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h3 className="concept-font-display text-base font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>Generated Assignment Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
                  <th className="px-2 py-1 text-left">Member</th>
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">Shift</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Share</th>
                </tr>
              </thead>
              <tbody>
                {results.assignments.map((assignment, idx) => (
                  <tr key={`${assignment.memberId}-${assignment.assignedDate}-${assignment.shift}-${idx}`} className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                    <td className="px-2 py-1.5" style={{ color: COLORS[assignment.memberId] }}>{assignment.memberId}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{assignment.assignedDate}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{assignment.shift}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{ASSIGNMENT_REASON_LABELS[assignment.assignmentReason] || assignment.assignmentReason}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{assignment.shareIndex || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
