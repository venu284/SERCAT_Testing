import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCycles = vi.fn();

vi.mock('./useApiData', () => ({
  useCycles: () => useCycles(),
}));

import { useActiveCycle } from './useActiveCycle';

describe('useActiveCycle', () => {
  beforeEach(() => {
    useCycles.mockReset();
  });

  it('selects the first non-archived cycle from the paginated cycles payload', () => {
    useCycles.mockReturnValue({
      data: [
        { id: 'cycle-archived', status: 'archived', name: 'Archived Cycle' },
        { id: 'cycle-live', status: 'collecting', name: 'Live Cycle' },
        { id: 'cycle-next', status: 'setup', name: 'Next Cycle' },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toEqual({
      id: 'cycle-live',
      status: 'collecting',
      name: 'Live Cycle',
    });
    expect(result.current.activeCycleId).toBe('cycle-live');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to the first cycle when every cycle is archived-like or missing status', () => {
    useCycles.mockReturnValue({
      data: [
        { id: 'cycle-old', status: 'archived', name: 'Old Cycle' },
        { id: 'cycle-older', name: 'Older Cycle' },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toEqual({
      id: 'cycle-old',
      status: 'archived',
      name: 'Old Cycle',
    });
    expect(result.current.activeCycleId).toBe('cycle-old');
  });

  it('returns a safe null state when the cycles query has no rows yet', () => {
    useCycles.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toBeNull();
    expect(result.current.activeCycleId).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});
