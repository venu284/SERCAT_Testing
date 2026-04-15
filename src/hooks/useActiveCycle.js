import { useMemo } from 'react';
import { useCycles } from './useApiData';
import { selectActiveCycle } from './activeCycleSelection';

function extractCycles(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

export function useActiveCycle() {
  const cyclesQuery = useCycles();

  const cycles = useMemo(() => extractCycles(cyclesQuery.data), [cyclesQuery.data]);

  const activeCycle = useMemo(() => {
    return selectActiveCycle(cycles);
  }, [cycles]);

  return {
    activeCycle,
    activeCycleId: activeCycle?.id ?? null,
    isLoading: cyclesQuery.isLoading,
    error: cyclesQuery.error ?? null,
  };
}
