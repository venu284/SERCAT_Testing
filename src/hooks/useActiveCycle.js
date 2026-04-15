import { useMemo } from 'react';
import { useCycles } from './useApiData';

export function extractCycles(payload) {
  return Array.isArray(payload) ? payload : [];
}

export function useActiveCycle() {
  const cyclesQuery = useCycles();

  const cycles = useMemo(() => extractCycles(cyclesQuery.data), [cyclesQuery.data]);

  const activeCycle = useMemo(() => {
    return cycles.find((cycle) => cycle?.status && cycle.status !== 'archived') || cycles[0] || null;
  }, [cycles]);

  return {
    activeCycle,
    activeCycleId: activeCycle?.id ?? null,
    isLoading: cyclesQuery.isLoading,
    error: cyclesQuery.error ?? null,
  };
}
