import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useMockApp = vi.fn();
const useSwapRequests = vi.fn();
const useResolveSwapRequest = vi.fn();

vi.mock('../../lib/mock-state', () => ({
  useMockApp: () => useMockApp(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useSwapRequests: () => useSwapRequests(),
  useResolveSwapRequest: () => useResolveSwapRequest(),
}));

import ShiftChangeAdmin from './ShiftChangeAdmin';

function buildMutation() {
  return { mutate: vi.fn(), isPending: false };
}

describe('ShiftChangeAdmin', () => {
  beforeEach(() => {
    useMockApp.mockReset();
    useSwapRequests.mockReset();
    useResolveSwapRequest.mockReset();

    useMockApp.mockReturnValue({
      sortedShiftRequests: [],
      adminShiftDrafts: {},
      adminShiftActionErrors: {},
      updateShiftDraft: vi.fn(),
      resolveShiftChange: vi.fn(),
    });

    useSwapRequests.mockReturnValue({
      data: {
        data: [
          {
            id: 'swap-1',
            status: 'pending',
            createdAt: '2026-04-12T12:00:00Z',
            institutionAbbreviation: 'UGA',
            requesterName: 'Dr. PI',
            adminNotes: '',
            preferredDates: ['2026-04-22'],
            targetAssignment: {
              assignedDate: '2026-04-20',
              shift: 'DS1',
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    useResolveSwapRequest.mockReturnValue(buildMutation());
  });

  it('uses swap hooks instead of useMockApp and resolves approved requests with API status values', () => {
    const resolveMutation = buildMutation();
    useResolveSwapRequest.mockReturnValue(resolveMutation);

    render(<ShiftChangeAdmin />);

    expect(useSwapRequests).toHaveBeenCalled();
    expect(useResolveSwapRequest).toHaveBeenCalled();
    expect(useMockApp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue('2026-04-22'), { target: { value: '2026-04-23' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'NS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(resolveMutation.mutate).toHaveBeenCalledWith(
      {
        id: 'swap-1',
        status: 'approved',
        adminNotes: '',
        reassignedDate: '2026-04-23',
        reassignedShift: 'NS',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });
});
