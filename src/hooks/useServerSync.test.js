import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_CYCLE } from '../data/cycle';

const { useQuery } = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config) => useQuery(config),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { useServerSync } from './useServerSync';

const EMPTY_QUERY = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

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

describe('useServerSync', () => {
  beforeEach(() => {
    useQuery.mockReset();
    useQuery.mockImplementation((config) => {
      const [key] = config.queryKey;

      if (key === 'cycles') {
        return {
          data: [
            { id: 'cycle-old', status: 'archived', name: 'Old Cycle' },
            { id: 'cycle-invalid', status: 'draft', name: 'Draft Cycle' },
          ],
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      }

      return { ...EMPTY_QUERY, refetch: vi.fn() };
    });
  });

  it('clears cycle-derived legacy state when cycles resolve without an active cycle', () => {
    const setMembers = vi.fn();
    const setCycle = vi.fn();
    const setPreferences = vi.fn();
    const setQueue = vi.fn();
    const setResults = vi.fn();
    const setSchedulePublication = vi.fn();
    const membersRef = { current: [{ id: 'stale-member' }] };

    const { result } = renderHook(() => useServerSync({
      isAuthenticated: true,
      setMembers,
      setCycle,
      setPreferences,
      setQueue,
      setResults,
      setSchedulePublication,
      membersRef,
    }));

    expect(result.current.activeCycleId).toBeNull();
    expect(setCycle).toHaveBeenCalledWith(EMPTY_LEGACY_CYCLE);
    expect(setPreferences).toHaveBeenCalledWith({});
    expect(setResults).toHaveBeenCalledWith(null);
    expect(setSchedulePublication).toHaveBeenCalledWith({
      status: 'draft',
      draftedAt: '',
      publishedAt: '',
    });
  });
});
