import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useSchedule = vi.fn();
const useSwapRequests = vi.fn();
const useAvailableDates = vi.fn();
const useCreateSwapRequest = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useSchedule: (cycleId) => useSchedule(cycleId),
  useSwapRequests: () => useSwapRequests(),
  useAvailableDates: (cycleId) => useAvailableDates(cycleId),
  useCreateSwapRequest: () => useCreateSwapRequest(),
}));

import ShiftChanges from './ShiftChanges';

function buildMutation() {
  return { mutate: vi.fn(), isPending: false };
}

describe('ShiftChanges', () => {
  beforeEach(() => {
    useAuth.mockReset();
    useActiveCycle.mockReset();
    useSchedule.mockReset();
    useSwapRequests.mockReset();
    useAvailableDates.mockReset();
    useCreateSwapRequest.mockReset();

    useAuth.mockReturnValue({
      user: { id: 'pi-1', institutionId: 'inst-1', institutionAbbreviation: 'UGA' },
    });
    useActiveCycle.mockReturnValue({
      activeCycle: { id: 'cycle-1', startDate: '2026-04-20', endDate: '2026-04-22' },
      activeCycleId: 'cycle-1',
      isLoading: false,
      error: null,
    });
    useSchedule.mockReturnValue({
      data: {
        scheduleId: 'schedule-1',
        assignments: [
          { id: 'assign-1', piId: 'pi-1', assignedDate: '2026-04-20', shift: 'DS1' },
        ],
      },
      isLoading: false,
      error: null,
    });
    useSwapRequests.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });
    useAvailableDates.mockReturnValue({
      data: [
        { date: '2026-04-20', isAvailable: true, ds1Available: false, ds2Available: true, nsAvailable: true },
        { date: '2026-04-21', isAvailable: true, ds1Available: true, ds2Available: false, nsAvailable: true },
        { date: '2026-04-22', isAvailable: true, ds1Available: true, ds2Available: true, nsAvailable: true },
      ],
      isLoading: false,
      error: null,
    });
    useCreateSwapRequest.mockReturnValue(buildMutation());
  });

  it('uses real hooks and submits swap requests through the mutation', () => {
    const createMutation = buildMutation();
    useCreateSwapRequest.mockReturnValue(createMutation);

    render(<ShiftChanges />);

    expect(useAuth).toHaveBeenCalled();
    expect(useActiveCycle).toHaveBeenCalled();
    expect(useSchedule).toHaveBeenCalledWith('cycle-1');
    expect(useSwapRequests).toHaveBeenCalled();
    expect(useAvailableDates).toHaveBeenCalledWith('cycle-1');

    fireEvent.click(screen.getByRole('button', { name: /Mon, Apr 20/i }));
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: '2026-04-22' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'NS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    expect(createMutation.mutate).toHaveBeenCalledWith(
      {
        scheduleId: 'schedule-1',
        targetAssignmentId: 'assign-1',
        preferredDates: ['2026-04-22'],
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });
});
