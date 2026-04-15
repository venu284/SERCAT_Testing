import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useActiveCycle = vi.fn();
const useMemberDashboardContext = vi.fn();

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useMemberDashboardContext', () => ({
  useMemberDashboardContext: () => useMemberDashboardContext(),
}));

import MemberDashboard from './MemberDashboard';

function renderScreen() {
  return render(
    <MemoryRouter>
      <MemberDashboard />
    </MemoryRouter>,
  );
}

describe('MemberDashboard', () => {
  beforeEach(() => {
    useActiveCycle.mockReset();
    useMemberDashboardContext.mockReset();
  });

  it('renders the production-backed member dashboard values without useMockApp', () => {
    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-2026-spring',
        startDate: '2026-04-20',
        endDate: '2026-05-20',
      },
      isLoading: false,
      error: null,
    });

    useMemberDashboardContext.mockReturnValue({
      member: {
        id: 'SERCAT',
        name: 'SERCAT University',
        shares: 1.5,
      },
      entitlement: {
        wholeShares: 1,
        fractionalHours: 12,
      },
      preferenceDeadline: '2026-04-13',
      daysUntilPreferenceDeadline: 0,
      isPreferenceSubmitted: true,
      schedulePublication: {
        status: 'published',
        publishedAt: '2026-04-14T12:00:00Z',
      },
      currentMemberAssignments: [
        { id: 'assign-1', shift: 'DS1' },
        { id: 'assign-2', shift: 'NS' },
      ],
      memberShiftCounts: {
        DS1: 1,
        DS2: 0,
        NS: 1,
      },
      isLoading: false,
      error: null,
    });

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Preferences already submitted' })).toBeInTheDocument();
    expect(screen.getByText('Deadline: Apr 13, 2026')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('12.00 hours')).toBeInTheDocument();
    expect(screen.getByText('Assigned now: 2 total (1 DS1, 0 DS2, 1 NS).')).toBeInTheDocument();
  });

  it('shows a stable loading card instead of returning null', () => {
    useActiveCycle.mockReturnValue({
      activeCycle: null,
      isLoading: true,
      error: null,
    });

    useMemberDashboardContext.mockReturnValue({
      member: null,
      entitlement: {
        wholeShares: 0,
        fractionalHours: 0,
      },
      preferenceDeadline: '',
      daysUntilPreferenceDeadline: 0,
      isPreferenceSubmitted: false,
      schedulePublication: {
        status: '',
        publishedAt: '',
      },
      currentMemberAssignments: [],
      memberShiftCounts: {
        DS1: 0,
        DS2: 0,
        NS: 0,
      },
      isLoading: false,
      error: null,
    });

    const { container } = renderScreen();

    expect(screen.getByText('Loading member dashboard...')).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it('shows a safe empty state when there is no active cycle', () => {
    useActiveCycle.mockReturnValue({
      activeCycle: null,
      isLoading: false,
      error: null,
    });

    useMemberDashboardContext.mockReturnValue({
      member: {
        id: 'SERCAT',
        name: 'SERCAT University',
        shares: 1.5,
      },
      entitlement: {
        wholeShares: 1,
        fractionalHours: 12,
      },
      preferenceDeadline: '',
      daysUntilPreferenceDeadline: 0,
      isPreferenceSubmitted: false,
      schedulePublication: {
        status: '',
        publishedAt: '',
      },
      currentMemberAssignments: [],
      memberShiftCounts: {
        DS1: 0,
        DS2: 0,
        NS: 0,
      },
      isLoading: false,
      error: null,
    });

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Member dashboard unavailable' })).toBeInTheDocument();
    expect(screen.getByText('No active cycle is available yet.')).toBeInTheDocument();
  });
});
