import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { INITIAL_CYCLE } from '../data/cycle';
import { api } from '../lib/api';
import { mapSharesToMembers, mapCycleToMock, mapPreferencesToMock } from '../lib/data-mappers';
import { selectActiveCycle } from './activeCycleSelection';

const EMPTY_LEGACY_CYCLE = {
  ...INITIAL_CYCLE,
  id: '',
  startDate: '',
  endDate: '',
  preferenceDeadline: '',
  blockedDates: [],
  blockedSlots: [],
  _dbId: null,
  _status: '',
};

const DEFAULT_SCHEDULE_PUBLICATION = {
  status: 'draft',
  draftedAt: '',
  publishedAt: '',
};

export function useServerSync({
  isAuthenticated,
  setMembers,
  setCycle,
  setPreferences,
  setQueue,
  setResults,
  setSchedulePublication,
  membersRef,
}) {
  const sharesQuery = useQuery({
    queryKey: ['master-shares'],
    queryFn: () => api.get('/shares').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data?.data || []),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const cyclesQuery = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.get('/cycles').then((r) => r.data?.data || []),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const activeCycle = useMemo(() => selectActiveCycle(cyclesQuery.data), [cyclesQuery.data]);

  const activeCycleId = activeCycle?.id || null;

  const datesQuery = useQuery({
    queryKey: ['available-dates', activeCycleId],
    queryFn: () => api.get(`/cycles/${activeCycleId}/dates`).then((r) => r.data),
    enabled: Boolean(activeCycleId),
    staleTime: 60_000,
  });

  const prefsQuery = useQuery({
    queryKey: ['preferences', activeCycleId],
    queryFn: () => api.get(`/cycles/${activeCycleId}/preferences`).then((r) => r.data),
    enabled: Boolean(activeCycleId),
    staleTime: 30_000,
  });

  const scheduleQuery = useQuery({
    queryKey: ['schedule', activeCycleId],
    queryFn: () => api.get(`/cycles/${activeCycleId}/schedules`).then((r) => r.data),
    enabled: Boolean(activeCycleId),
    staleTime: 30_000,
  });

  const commentsQuery = useQuery({
    queryKey: ['comments'],
    queryFn: () => api.get('/comments').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const swapRequestsQuery = useQuery({
    queryKey: ['swap-requests'],
    queryFn: () => api.get('/swap-requests').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const mappedMembers = useMemo(() => {
    if (!sharesQuery.data || !usersQuery.data) return null;
    return mapSharesToMembers(sharesQuery.data, usersQuery.data);
  }, [sharesQuery.data, usersQuery.data]);

  useEffect(() => {
    if (!mappedMembers) return;

    setMembers(mappedMembers);
    setQueue((prev) => mappedMembers.map((member) => {
      const existing = Array.isArray(prev) ? prev.find((entry) => entry.memberId === member.id) : null;
      return existing || {
        memberId: member.id,
        deficitScore: 0,
        cycleWins: 0,
        roundWins: 0,
      };
    }));
  }, [mappedMembers, setMembers, setQueue]);

  useEffect(() => {
    if (cyclesQuery.data === undefined || activeCycle) return;

    setCycle(EMPTY_LEGACY_CYCLE);
    setPreferences({});
    setResults(null);
    setSchedulePublication(DEFAULT_SCHEDULE_PUBLICATION);
  }, [
    cyclesQuery.data,
    activeCycle,
    setCycle,
    setPreferences,
    setResults,
    setSchedulePublication,
  ]);

  useEffect(() => {
    if (!activeCycle) return;

    const mappedCycle = mapCycleToMock(activeCycle, datesQuery.data || []);
    if (mappedCycle) {
      setCycle((prev) => ({
        ...prev,
        ...mappedCycle,
        blockedSlots: prev.blockedSlots || [],
      }));
    }
  }, [activeCycle, datesQuery.data, setCycle]);

  useEffect(() => {
    if (prefsQuery.data === undefined) return;

    const effectiveMembers = mappedMembers ?? membersRef.current;
    if (!Array.isArray(effectiveMembers) || effectiveMembers.length === 0) {
      setPreferences({});
      return;
    }

    const mapped = mapPreferencesToMock(prefsQuery.data, effectiveMembers);
    setPreferences(mapped);
  }, [prefsQuery.data, setPreferences, membersRef, mappedMembers]);

  useEffect(() => {
    if (scheduleQuery.data === undefined) return;

    const sched = scheduleQuery.data;
    if (!sched || !Array.isArray(sched.assignments)) {
      setResults(null);
      setSchedulePublication(DEFAULT_SCHEDULE_PUBLICATION);
      return;
    }

    const detected = sched.analytics?.detectedPatterns || {};
    const stdDev = sched.analytics?.fairnessStdDeviation != null
      ? Number(sched.analytics.fairnessStdDeviation)
      : 0;
    const mean = detected.deviationMean != null ? parseFloat(detected.deviationMean) : 0;

    setResults({
      assignments: sched.assignments,
      fairness: {
        memberSatisfaction: sched.analytics?.piSatisfactionScores || [],
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
      engineLog: detected.engineLog || [],
      errors: detected.errors || [],
      warnings: detected.warnings || [],
      analytics: sched.analytics || null,
      _scheduleId: sched.scheduleId,
    });

    setSchedulePublication({
      status: sched.status || 'draft',
      draftedAt: sched.generatedAt || '',
      publishedAt: sched.publishedAt || '',
    });
  }, [scheduleQuery.data, setResults, setSchedulePublication]);

  const isLoading = sharesQuery.isLoading || usersQuery.isLoading || cyclesQuery.isLoading;
  const dataReady = Boolean(sharesQuery.data && usersQuery.data);
  const error = sharesQuery.error
    || usersQuery.error
    || cyclesQuery.error
    || datesQuery.error
    || prefsQuery.error
    || scheduleQuery.error
    || commentsQuery.error
    || swapRequestsQuery.error;

  const refetchAll = () => Promise.all([
    sharesQuery.refetch(),
    usersQuery.refetch(),
    cyclesQuery.refetch(),
    datesQuery.refetch(),
    prefsQuery.refetch(),
    scheduleQuery.refetch(),
    commentsQuery.refetch(),
    swapRequestsQuery.refetch(),
  ]);

  return {
    dataReady,
    isLoading,
    error,
    refetchAll,
    activeCycleId,
    sharesQuery,
    usersQuery,
    cyclesQuery,
    datesQuery,
    prefsQuery,
    scheduleQuery,
    commentsQuery,
    swapRequestsQuery,
  };
}
