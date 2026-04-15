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

  it('selects cycles by status priority instead of the first non-archived row', () => {
    useCycles.mockReturnValue({
      data: {
        data: [
          { id: 'cycle-setup', status: 'setup', name: 'Setup Cycle' },
          { id: 'cycle-archived', status: 'archived', name: 'Archived Cycle' },
          { id: 'cycle-live', status: 'collecting', name: 'Live Cycle' },
          { id: 'cycle-published', status: 'published', name: 'Published Cycle' },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 4,
          totalPages: 1,
        },
      },
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

  it('prefers scheduling over published and setup when collecting is absent', () => {
    useCycles.mockReturnValue({
      data: {
        data: [
          { id: 'cycle-published', status: 'published', name: 'Published Cycle' },
          { id: 'cycle-setup', status: 'setup', name: 'Setup Cycle' },
          { id: 'cycle-scheduling', status: 'scheduling', name: 'Scheduling Cycle' },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toEqual({
      id: 'cycle-scheduling',
      status: 'scheduling',
      name: 'Scheduling Cycle',
    });
    expect(result.current.activeCycleId).toBe('cycle-scheduling');
  });

  it('returns null when every cycle is archived or has an invalid status', () => {
    useCycles.mockReturnValue({
      data: {
        data: [
          { id: 'cycle-old', status: 'archived', name: 'Old Cycle' },
          { id: 'cycle-invalid', status: 'draft', name: 'Draft Cycle' },
          { id: 'cycle-missing', name: 'Missing Status Cycle' },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toBeNull();
    expect(result.current.activeCycleId).toBeNull();
  });

  it('returns a safe null state when the cycles query has no rows yet', () => {
    useCycles.mockReturnValue({
      data: {
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
      },
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useActiveCycle());

    expect(result.current.activeCycle).toBeNull();
    expect(result.current.activeCycleId).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
});
