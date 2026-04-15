import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
const useActiveCycle = vi.fn();
const useMemberDashboardContext = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useMemberDashboardContext', () => ({
  useMemberDashboardContext: () => useMemberDashboardContext(),
}));

import MemberDashboard from './MemberDashboard';

function buildActiveCycle(overrides = {}) {
  return {
    activeCycle: {
      id: 'cycle-2026-spring',
      startDate: '2026-04-20',
      endDate: '2026-05-20',
      ...overrides.activeCycle,
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildDashboardContext(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <MemberDashboard />
    </MemoryRouter>,
  );
}

describe('MemberDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useActiveCycle.mockReset();
    useMemberDashboardContext.mockReset();
  });

  it('renders the production-backed member dashboard values without useMockApp', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMemberDashboardContext.mockReturnValue(buildDashboardContext());

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Preferences already submitted' })).toBeInTheDocument();
    expect(screen.getByText('Deadline: Apr 13, 2026')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('12.00 hours')).toBeInTheDocument();
    expect(screen.getByText('Assigned now: 2 total (1 DS1, 0 DS2, 1 NS).')).toBeInTheDocument();
  });

  it('shows a stable loading card instead of returning null', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null, isLoading: true }));
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
      member: null,
      entitlement: {
        wholeShares: 0,
        fractionalHours: 0,
      },
      preferenceDeadline: '',
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
    }));

    const { container } = renderScreen();

    expect(screen.getByText('Loading member dashboard...')).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it('shows a safe empty state when there is no active cycle', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null }));
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
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
    }));

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Member dashboard unavailable' })).toBeInTheDocument();
    expect(screen.getByText('No active cycle is available yet.')).toBeInTheDocument();
  });

  it('shows the member-missing empty state when an active cycle exists but member data is unavailable', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
      member: null,
      entitlement: {
        wholeShares: 0,
        fractionalHours: 0,
      },
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
    }));

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Member dashboard unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Your member record is not available yet.')).toBeInTheDocument();
  });

  it('shows the explicit error card when either hook returns an error', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ error: new Error('cycle offline') }));
    useMemberDashboardContext.mockReturnValue(buildDashboardContext());

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Unable to load member dashboard' })).toBeInTheDocument();
    expect(screen.getByText('cycle offline')).toBeInTheDocument();
  });

  it('routes submitted and published members to the schedule screen from the CTA', async () => {
    const user = userEvent.setup();

    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
      isPreferenceSubmitted: true,
      schedulePublication: {
        status: 'published',
        publishedAt: '2026-04-14T12:00:00Z',
      },
    }));

    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Open My Schedule' }));

    expect(mockNavigate).toHaveBeenCalledWith('/member/schedule');
  });

  it('routes submitted but unpublished members back to preferences from the CTA', async () => {
    const user = userEvent.setup();

    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
      isPreferenceSubmitted: true,
      schedulePublication: {
        status: 'draft',
        publishedAt: '',
      },
    }));

    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Review Preferences' }));

    expect(mockNavigate).toHaveBeenCalledWith('/member/preferences');
  });

  it('routes unsubmitted members to preferences from the CTA', async () => {
    const user = userEvent.setup();

    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
      isPreferenceSubmitted: false,
      daysUntilPreferenceDeadline: 2,
      schedulePublication: {
        status: '',
        publishedAt: '',
      },
    }));

    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Start Now ->' }));

    expect(mockNavigate).toHaveBeenCalledWith('/member/preferences');
  });

  it('renders cycle timeline dates from activeCycle start and end dates', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({
      activeCycle: {
        startDate: '2026-07-01',
        endDate: '2026-08-15',
      },
    }));
    useMemberDashboardContext.mockReturnValue(buildDashboardContext());

    renderScreen();

    expect(screen.getByText('Jul 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('Aug 15, 2026')).toBeInTheDocument();
  });

  it('maps whole-share and fractional-share allocation badges from the entitlement values', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMemberDashboardContext.mockReturnValue(buildDashboardContext({
      entitlement: {
        wholeShares: 2,
        fractionalHours: 6,
      },
    }));

    renderScreen();

    expect(screen.getByText('Whole Share 1')).toBeInTheDocument();
    expect(screen.getByText('Whole Share 2')).toBeInTheDocument();
    expect(screen.getByText('Fractional Share (6.00 hours)')).toBeInTheDocument();

    const wholeShareOneCard = screen.getByText('Whole Share 1').parentElement;
    const wholeShareTwoCard = screen.getByText('Whole Share 2').parentElement;
    const fractionalShareCard = screen.getByText('Fractional Share (6.00 hours)').parentElement;

    expect(wholeShareOneCard).toHaveTextContent('Morning');
    expect(wholeShareOneCard).toHaveTextContent('Afternoon');
    expect(wholeShareOneCard).toHaveTextContent('Night');

    expect(wholeShareTwoCard).toHaveTextContent('Morning');
    expect(wholeShareTwoCard).toHaveTextContent('Afternoon');
    expect(wholeShareTwoCard).toHaveTextContent('Night');

    expect(fractionalShareCard).toHaveTextContent('Morning');
    expect(fractionalShareCard).toHaveTextContent('Afternoon');
    expect(fractionalShareCard).not.toHaveTextContent('Night');
  });
});
