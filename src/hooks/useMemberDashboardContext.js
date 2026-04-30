import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCycle } from './useActiveCycle';
import { useMasterShares, usePreferences, useSchedule } from './useApiData';
import { buildMember } from '../lib/normalizers';
import { computeEntitlements } from '../lib/entitlements';
import { addDays, daysBetweenSigned, localTodayDateStr } from '../lib/dates';
import { extractRows } from '../lib/api';

function normalizePreferenceDeadline(cycle) {
  if (!cycle) return '';
  if (typeof cycle.preferenceDeadline === 'string' && cycle.preferenceDeadline) {
    return cycle.preferenceDeadline.includes('T')
      ? cycle.preferenceDeadline.split('T')[0]
      : cycle.preferenceDeadline;
  }
  if (!cycle.startDate) return '';
  return addDays(cycle.startDate, -7);
}

export function useMemberDashboardContext() {
  const { user } = useAuth();
  const cycleQuery = useActiveCycle();
  const sharesQuery = useMasterShares();
  const preferencesQuery = usePreferences(cycleQuery.activeCycleId);
  const scheduleQuery = useSchedule(cycleQuery.activeCycleId);

  const shareRows = useMemo(() => extractRows(sharesQuery.data), [sharesQuery.data]);

  const member = useMemo(() => {
    const activeShare = shareRows.find((row) => row?.piId === user?.id)
      || shareRows.find((row) => row?.institutionId === user?.institutionId)
      || null;

    return buildMember(user, activeShare);
  }, [shareRows, user]);

  const entitlement = useMemo(() => {
    if (!member) {
      return { wholeShares: 0, fractionalHours: 0 };
    }

    return computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 };
  }, [member]);

  const preferenceDeadline = normalizePreferenceDeadline(cycleQuery.activeCycle);
  const todayDate = localTodayDateStr();
  const daysUntilPreferenceDeadline = preferenceDeadline
    ? daysBetweenSigned(todayDate, preferenceDeadline)
    : 0;

  const preferencePayload = preferencesQuery.data || {};
  const submissionRows = Array.isArray(preferencePayload.submissions) ? preferencePayload.submissions : [];
  const isPreferenceSubmitted = Boolean(
    member && (
      preferencePayload.submittedAt
        || submissionRows.some((entry) => entry?.piId === member._piUserId && entry?.submittedAt)
    ),
  );

  const schedulePayload = scheduleQuery.data || null;
  const scheduleAssignments = Array.isArray(schedulePayload?.assignments) ? schedulePayload.assignments : [];
  const currentMemberAssignments = scheduleAssignments.filter(
    (assignment) => member && assignment?.piId === member._piUserId,
  );
  const memberShiftCounts = currentMemberAssignments.reduce(
    (counts, assignment) => {
      const shift = assignment?.shift;
      if (shift && Object.prototype.hasOwnProperty.call(counts, shift)) {
        counts[shift] += 1;
      }
      return counts;
    },
    { DS1: 0, DS2: 0, NS: 0 },
  );

  return {
    member,
    entitlement,
    preferenceDeadline,
    daysUntilPreferenceDeadline,
    isPreferenceSubmitted,
    schedulePublication: {
      status: schedulePayload?.status || '',
      publishedAt: schedulePayload?.publishedAt || '',
      draftedAt: schedulePayload?.generatedAt || '',
    },
    currentMemberAssignments,
    memberShiftCounts,
    isLoading: Boolean(
      cycleQuery.isLoading
        || sharesQuery.isLoading
        || preferencesQuery.isLoading
        || scheduleQuery.isLoading,
    ),
    error: cycleQuery.error || sharesQuery.error || preferencesQuery.error || scheduleQuery.error || null,
  };
}
