import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useActiveCycle = vi.fn();
const useMemberDashboardContext = vi.fn();

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useMemberDashboardContext', () => ({
  useMemberDashboardContext: () => useMemberDashboardContext(),
}));

import MySchedule from './MySchedule';

function buildDashboardContext(overrides = {}) {
  return {
    member: {
      id: 'SERCAT',
      name: 'SERCAT University',
      shares: 1,
    },
    currentMemberAssignments: [],
    memberShiftCounts: {
      DS1: 0,
      DS2: 0,
      NS: 0,
    },
    schedulePublication: {
      status: '',
      publishedAt: '',
      draftedAt: '',
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

describe('MySchedule', () => {
  beforeEach(() => {
    useActiveCycle.mockReset();
    useMemberDashboardContext.mockReset();

    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-1',
        name: 'Spring 2026',
        startDate: '2026-04-20',
        endDate: '2026-05-20',
      },
      isLoading: false,
      error: null,
    });
    useMemberDashboardContext.mockReturnValue(buildDashboardContext());
  });

  it('shows an unpublished state when the member schedule API has no published schedule yet', () => {
    render(<MySchedule />);

    expect(screen.getByText('Schedule has not been published yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
  });
});
