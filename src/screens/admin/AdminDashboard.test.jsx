import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
const useActiveCycle = vi.fn();
const useUsers = vi.fn();
const usePreferenceStatus = vi.fn();
const useSchedule = vi.fn();

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

vi.mock('../../hooks/useApiData', () => ({
  useUsers: (params) => useUsers(params),
  usePreferenceStatus: (cycleId) => usePreferenceStatus(cycleId),
  useSchedule: (cycleId) => useSchedule(cycleId),
}));

import AdminDashboard from './AdminDashboard';

function buildActiveCycle(overrides = {}) {
  return {
    activeCycle: {
      id: 'cycle-2026-spring',
      name: 'Spring 2026',
      startDate: '2026-04-20',
      endDate: '2026-05-20',
      preferenceDeadline: '2026-04-13T12:00:00Z',
      ...overrides.activeCycle,
    },
    activeCycleId: 'cycle-2026-spring',
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildUsersQuery(overrides = {}) {
  return {
    data: {
      data: [
        { id: 'pi-1', role: 'pi', isActive: true, isActivated: true },
        { id: 'pi-2', role: 'pi', isActive: true, isActivated: true },
        { id: 'pi-3', role: 'pi', isActive: true, isActivated: false },
        { id: 'staff-1', role: 'staff', isActive: true, isActivated: true },
      ],
      total: 4,
      page: 1,
      limit: 50,
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildPreferenceStatusQuery(overrides = {}) {
  return {
    data: {
      summary: {
        total: 2,
        submitted: 1,
        pending: 1,
      },
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildScheduleQuery(overrides = {}) {
  return {
    data: {
      id: 'schedule-1',
      status: 'published',
      publishedAt: '2026-04-14T12:00:00Z',
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>,
  );
}

function expectTextContent(text) {
  expect(screen.getByText((_, node) => node?.textContent === text)).toBeInTheDocument();
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useActiveCycle.mockReset();
    useUsers.mockReset();
    usePreferenceStatus.mockReset();
    useSchedule.mockReset();
  });

  it('renders production-backed summary cards and removes the local snapshot controls', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useUsers.mockReturnValue(buildUsersQuery());
    usePreferenceStatus.mockReturnValue(buildPreferenceStatusQuery());
    useSchedule.mockReturnValue(buildScheduleQuery());

    renderScreen();

    expect(screen.queryByText('Admin workspace')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load Local' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Local' })).not.toBeInTheDocument();
    expect(screen.getByText('Schedule Is Published')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expectTextContent('Cycle Spring 2026 | Preference deadline: Apr 13, 2026');
    expect(useUsers).toHaveBeenCalledWith({ limit: 1000 });
    expect(usePreferenceStatus).toHaveBeenCalledWith('cycle-2026-spring');
    expect(useSchedule).toHaveBeenCalledWith('cycle-2026-spring');
  });

  it('shows a stable loading card while the live queries resolve', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null, activeCycleId: null, isLoading: true }));
    useUsers.mockReturnValue(buildUsersQuery({ data: { data: [], total: 0, page: 1, limit: 50 }, isLoading: true }));
    usePreferenceStatus.mockReturnValue(buildPreferenceStatusQuery({ data: null, isLoading: true }));
    useSchedule.mockReturnValue(buildScheduleQuery({ data: null, isLoading: true }));

    const { container } = renderScreen();

    expect(screen.getByText('Loading admin dashboard...')).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it('shows a safe empty state when there is no active cycle', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null, activeCycleId: null }));
    useUsers.mockReturnValue(buildUsersQuery());
    usePreferenceStatus.mockReturnValue(buildPreferenceStatusQuery({ data: null }));
    useSchedule.mockReturnValue(buildScheduleQuery({ data: null }));

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Admin dashboard unavailable' })).toBeInTheDocument();
    expect(screen.getByText('No active cycle is available yet.')).toBeInTheDocument();
  });

  it('preserves zero summary values from preference status instead of falling back to member counts', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useUsers.mockReturnValue(buildUsersQuery());
    usePreferenceStatus.mockReturnValue(buildPreferenceStatusQuery({
      data: {
        summary: {
          total: 0,
          submitted: 0,
          pending: 0,
        },
      },
    }));
    useSchedule.mockReturnValue(buildScheduleQuery({ data: { id: 'schedule-1', status: 'draft', publishedAt: '' } }));

    renderScreen();

    expectTextContent('Active Members0in cycle');
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('keeps the stored calendar date when preferenceDeadline includes a timezone', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({
      activeCycle: {
        preferenceDeadline: '2026-04-13T00:30:00+14:00',
      },
    }));
    useUsers.mockReturnValue(buildUsersQuery());
    usePreferenceStatus.mockReturnValue(buildPreferenceStatusQuery());
    useSchedule.mockReturnValue(buildScheduleQuery());

    renderScreen();

    expectTextContent('Cycle  | Preference deadline: Apr 13, 2026');
  });

  it('shows the explicit error card when any live query fails', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useUsers.mockReturnValue(buildUsersQuery({ error: new Error('users offline') }));
    usePreferenceStatus.mockReturnValue(buildPreferenceStatusQuery());
    useSchedule.mockReturnValue(buildScheduleQuery());

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Unable to load admin dashboard' })).toBeInTheDocument();
    expect(screen.getByText('users offline')).toBeInTheDocument();
  });
});
