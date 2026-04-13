import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { mapSharesToMembers, mapCycleToMock, mapPreferencesToMock } from '../lib/data-mappers';

export function useServerSync({
  isAuthenticated,
  setMembers,
  setCycle,
  setPreferences,
  setQueue,
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

  const activeCycle = useMemo(() => (
    cyclesQuery.data
      ? cyclesQuery.data.find((c) => c.status !== 'archived') || cyclesQuery.data[0] || null
      : null
  ), [cyclesQuery.data]);

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

  const isLoading = sharesQuery.isLoading || usersQuery.isLoading || cyclesQuery.isLoading;
  const dataReady = Boolean(sharesQuery.data && usersQuery.data);
  const error = sharesQuery.error || usersQuery.error || cyclesQuery.error;

  const refetchAll = () => {
    sharesQuery.refetch();
    usersQuery.refetch();
    cyclesQuery.refetch();
    datesQuery.refetch();
    prefsQuery.refetch();
  };

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
  };
}
