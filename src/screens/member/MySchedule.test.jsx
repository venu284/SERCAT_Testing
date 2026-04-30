import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useSchedule = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useSchedule: (...args) => useSchedule(...args),
}));

import MySchedule from './MySchedule';

function buildActiveCycle(overrides = {}) {
  return {
    activeCycle: {
      id: 'cycle-1',
      name: 'Spring 2026',
      startDate: '2026-04-20',
      endDate: '2026-04-24',
      ...overrides.activeCycle,
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildSchedule(overrides = {}) {
  return {
    data: {
      scheduleId: 'schedule-1',
      status: 'published',
      assignments: [
        { id: 'assign-past', assignedDate: '2026-04-20', shift: 'DS1' },
        { id: 'assign-today', assignedDate: '2026-04-21', shift: 'NS' },
        { id: 'assign-tomorrow', assignedDate: '2026-04-22', shift: 'DS2' },
      ],
      ...overrides.data,
    },
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function renderScreen() {
  return render(<MySchedule />);
}

describe('MySchedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T12:00:00'));

    useAuth.mockReset();
    useActiveCycle.mockReset();
    useSchedule.mockReset();

    useAuth.mockReturnValue({
      user: { id: 'pi-1', institutionId: 'inst-1', institutionAbbreviation: 'UGA' },
    });
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useSchedule.mockReturnValue(buildSchedule());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the active cycle schedule with immediate freshness and renders published assignments', () => {
    renderScreen();

    expect(useSchedule).toHaveBeenCalledWith('cycle-1', { staleTime: 0 });
    expect(screen.getByRole('heading', { name: 'My Schedule' })).toBeInTheDocument();
    expect(screen.getByText('Apr 20, 2026 - Apr 24, 2026 | Cycle Spring 2026')).toBeInTheDocument();

    expect(screen.getByText('Total Shifts').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Morning').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Afternoon').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Night').parentElement).toHaveTextContent('1');

    expect(screen.getByRole('heading', { name: 'Upcoming (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed (1)' })).toBeInTheDocument();
    expect(screen.getByText('Next Shift')).toBeInTheDocument();
    expect(screen.getAllByText('Tue, Apr 21')).toHaveLength(2);
    expect(screen.getByText('Mon, Apr 20')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('hides assignments and disables export until the schedule is published', () => {
    useSchedule.mockReturnValue(buildSchedule({
      data: {
        status: 'draft',
        assignments: [{ id: 'draft-assignment', assignedDate: '2026-04-21', shift: 'DS1' }],
      },
    }));

    renderScreen();

    expect(screen.getByText('Schedule has not been published yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: /Upcoming/ })).not.toBeInTheDocument();
  });

  it('shows the empty published state when the API returns no assignments for the member', () => {
    useSchedule.mockReturnValue(buildSchedule({
      data: {
        status: 'published',
        assignments: [],
      },
    }));

    renderScreen();

    expect(screen.getByText('No shifts assigned to your account for this cycle yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming (0)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed (0)' })).toBeInTheDocument();
  });

  it('shows the PDF placeholder message when export is clicked', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));

    expect(screen.getByText('PDF export will be available soon.')).toBeInTheDocument();
  });

  it('renders loading, error, and signed-out guard states', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null, isLoading: true }));
    useSchedule.mockReturnValue(buildSchedule({ data: null, isLoading: false }));
    const { rerender } = renderScreen();

    expect(screen.getByRole('heading', { name: 'Loading schedule...' })).toBeInTheDocument();

    useActiveCycle.mockReturnValue(buildActiveCycle({ error: new Error('cycle offline') }));
    useSchedule.mockReturnValue(buildSchedule());
    rerender(<MySchedule />);

    expect(screen.getByRole('heading', { name: 'Unable to load schedule' })).toBeInTheDocument();
    expect(screen.getByText('cycle offline')).toBeInTheDocument();

    useActiveCycle.mockReturnValue(buildActiveCycle());
    useAuth.mockReturnValue({ user: null });
    rerender(<MySchedule />);

    expect(screen.getByRole('heading', { name: 'Schedule unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Not signed in.')).toBeInTheDocument();
  });
});
