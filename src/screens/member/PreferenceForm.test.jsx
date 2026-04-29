import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useMasterShares = vi.fn();
const usePreferences = vi.fn();
const useAvailableDates = vi.fn();
const useSubmitPreferences = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useMasterShares: () => useMasterShares(),
  usePreferences: (cycleId) => usePreferences(cycleId),
  useAvailableDates: (cycleId) => useAvailableDates(cycleId),
  useSubmitPreferences: () => useSubmitPreferences(),
}));

import PreferenceForm from './PreferenceForm';

function buildAuth(overrides = {}) {
  return {
    user: {
      id: 'pi-1',
      institutionId: 'inst-1',
      institutionAbbreviation: 'SERCAT',
      name: 'Dr. PI',
    },
    loading: false,
    ...overrides,
  };
}

function buildActiveCycle(overrides = {}) {
  return {
    activeCycle: {
      id: 'cycle-1',
      name: 'Spring 2026',
      startDate: '2026-04-20',
      endDate: '2026-04-22',
      preferenceDeadline: '2026-04-13T00:00:00Z',
    },
    activeCycleId: 'cycle-1',
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function buildSharesQuery(overrides = {}) {
  return {
    data: [{
      id: 'share-1',
      institutionId: 'inst-1',
      institutionAbbreviation: 'SERCAT',
      institutionName: 'SERCAT University',
      piId: 'pi-1',
      wholeShares: 1,
      fractionalShares: 0.5,
    }],
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function buildPreferencesQuery(overrides = {}) {
  return {
    data: {
      data: {
        preferences: [],
        fractionalPreferences: [],
        submittedAt: null,
        submissions: [],
      },
    },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function buildDatesQuery(overrides = {}) {
  return {
    data: {
      data: [
        { date: '2026-04-20', isAvailable: true, ds1Available: true, ds2Available: true, nsAvailable: true },
        { date: '2026-04-21', isAvailable: true, ds1Available: true, ds2Available: true, nsAvailable: true },
        { date: '2026-04-22', isAvailable: true, ds1Available: true, ds2Available: true, nsAvailable: true },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function buildSubmitMutation(overrides = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function buildCompletePreferenceRows(overrides = {}) {
  return {
    preferences: [
      { shareIndex: 1, shift: 'DS1', choice1Date: '2026-04-20', choice2Date: '2026-04-21', piId: 'pi-1' },
      { shareIndex: 1, shift: 'DS2', choice1Date: '2026-04-21', choice2Date: '2026-04-22', piId: 'pi-1' },
      { shareIndex: 1, shift: 'NS', choice1Date: '2026-04-20', choice2Date: '2026-04-22', piId: 'pi-1' },
    ],
    fractionalPreferences: [
      { blockIndex: 1, fractionalHours: 6, choice1Date: '2026-04-20', choice2Date: '2026-04-21', piId: 'pi-1' },
      { blockIndex: 2, fractionalHours: 6, choice1Date: '2026-04-21', choice2Date: '2026-04-22', piId: 'pi-1' },
    ],
    submittedAt: null,
    submissions: [],
    ...overrides,
  };
}

function buildCompletePreferencesData(overrides = {}) {
  return {
    data: {
      data: buildCompletePreferenceRows(overrides),
    },
  };
}

describe('PreferenceForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00-04:00'));

    useAuth.mockReset();
    useActiveCycle.mockReset();
    useMasterShares.mockReset();
    usePreferences.mockReset();
    useAvailableDates.mockReset();
    useSubmitPreferences.mockReset();

    useAuth.mockReturnValue(buildAuth());
    useActiveCycle.mockReturnValue(buildActiveCycle());
    useMasterShares.mockReturnValue(buildSharesQuery());
    usePreferences.mockReturnValue(buildPreferencesQuery());
    useAvailableDates.mockReturnValue(buildDatesQuery());
    useSubmitPreferences.mockReturnValue(buildSubmitMutation());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses real hooks and shows the loading state while preference data is loading', () => {
    useAuth.mockReturnValue(buildAuth({ loading: true }));

    render(<PreferenceForm />);

    expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
    expect(useAuth).toHaveBeenCalled();
  });

  it('shows a clear empty state when there is no active cycle', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null, activeCycleId: null }));

    render(<PreferenceForm />);

    expect(screen.getByText('No active cycle. Check back when a new cycle is created.')).toBeInTheDocument();
  });

  it('shows a clear empty state when no share matches the signed-in PI', () => {
    useMasterShares.mockReturnValue(buildSharesQuery({ data: [] }));

    render(<PreferenceForm />);

    expect(screen.getByText('No active share found for your account.')).toBeInTheDocument();
  });

  it('blocks per-shift unavailable dates after the session type is selected', async () => {
    vi.useFakeTimers();
    const submitMutation = buildSubmitMutation();
    useSubmitPreferences.mockReturnValue(submitMutation);
    useDatesWithBlockedDs1();

    render(<PreferenceForm />);

    // Select DS1 shift so blocked dates render as disabled
    fireEvent.click(screen.getByRole('button', { name: /Morning Shift/i }));

    const blockedDate = screen.getByRole('button', { name: '20' });
    const openDate = screen.getByRole('button', { name: '21' });

    expect(blockedDate).toBeDisabled();

    fireEvent.click(openDate);

    expect(screen.getByText('Apr 21, 2026')).toBeInTheDocument();
    expect(submitMutation.mutate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(submitMutation.mutate).not.toHaveBeenCalled();
  });

  it('switches from 1st choice to 2nd choice after a friendly delay', async () => {
    vi.useFakeTimers();

    render(<PreferenceForm />);

    // Select DS1 so date picking is enabled
    fireEvent.click(screen.getByRole('button', { name: /Morning Shift/i }));

    const firstChoice = screen.getByRole('button', { name: /1st Choice/i });
    const secondChoice = screen.getByRole('button', { name: /2nd Choice/i });

    fireEvent.click(screen.getByRole('button', { name: '21' }));

    expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
    expect(secondChoice).toHaveAttribute('aria-pressed', 'false');

    await act(async () => {
      vi.advanceTimersByTime(240);
    });

    expect(firstChoice).toHaveAttribute('aria-pressed', 'false');
    expect(secondChoice).toHaveAttribute('aria-pressed', 'true');
  });

  it('advances to the next step quickly after both choices are selected without refreshing or saving', async () => {
    vi.useFakeTimers();
    const submitMutation = buildSubmitMutation();
    useSubmitPreferences.mockReturnValue(submitMutation);

    render(<PreferenceForm />);

    // Step 1 is Share 1 - Day Slot 1 (prototype slot-key label)
    expect(screen.getByText('Share 1 - Day Slot 1')).toBeInTheDocument();

    // Select DS1 shift first
    fireEvent.click(screen.getByRole('button', { name: /Morning Shift/i }));

    fireEvent.click(screen.getByRole('button', { name: '21' }));
    await act(async () => {
      vi.advanceTimersByTime(240);
    });
    fireEvent.click(screen.getByRole('button', { name: '22' }));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('Share 1 - Day Slot 2')).toBeInTheDocument();
    expect(submitMutation.mutate).not.toHaveBeenCalled();
  });

  it('lets members choose which choice date is being picked and highlights the active choice', () => {
    render(<PreferenceForm />);

    // Select DS1 shift to enable date picking
    fireEvent.click(screen.getByRole('button', { name: /Morning Shift/i }));

    const firstChoice = screen.getByRole('button', { name: /1st Choice/i });
    const secondChoice = screen.getByRole('button', { name: /2nd Choice/i });

    expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
    expect(firstChoice).toHaveStyle({ background: '#2b7bb5', color: 'rgb(255, 255, 255)' });
    expect(secondChoice).toHaveAttribute('aria-pressed', 'false');
    expect(secondChoice).toHaveStyle({ background: 'white' });

    fireEvent.click(secondChoice);

    expect(firstChoice).toHaveAttribute('aria-pressed', 'false');
    expect(secondChoice).toHaveAttribute('aria-pressed', 'true');
    expect(secondChoice).toHaveStyle({ background: '#c8920a', color: 'rgb(255, 255, 255)' });

    fireEvent.click(screen.getByRole('button', { name: '21' }));

    expect(within(firstChoice).getByText('Not selected')).toBeInTheDocument();
    expect(within(secondChoice).getByText('Apr 21, 2026')).toBeInTheDocument();
    expect(within(secondChoice).getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '21' })).toHaveStyle({
      background: '#c8920a',
      color: 'rgb(255, 255, 255)',
    });
  });

  it('does not allow the same date for both choices in one step', async () => {
    vi.useFakeTimers();

    render(<PreferenceForm />);

    // Select DS1 shift first
    fireEvent.click(screen.getByRole('button', { name: /Morning Shift/i }));

    const firstChoice = screen.getByRole('button', { name: /1st Choice/i });
    const secondChoice = screen.getByRole('button', { name: /2nd Choice/i });

    fireEvent.click(screen.getByRole('button', { name: '21' }));

    await act(async () => {
      vi.advanceTimersByTime(240);
    });

    fireEvent.click(screen.getByRole('button', { name: '21' }));

    expect(within(firstChoice).getByText('Apr 21, 2026')).toBeInTheDocument();
    expect(within(secondChoice).getByText('Not selected')).toBeInTheDocument();
  });

  it('shows a disabled submit button on the final step until all choices are complete', async () => {
    vi.useFakeTimers();

    render(<PreferenceForm />);

    fireEvent.click(screen.getByRole('button', { name: /Step 5/i }));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const submitButton = screen.getByRole('button', { name: 'Submit Preferences' });
    expect(submitButton).toBeDisabled();
  });

  it('submits all completed whole-share and fractional preferences from the final submit button', () => {
    const submitMutation = buildSubmitMutation();
    useSubmitPreferences.mockReturnValue(submitMutation);
    usePreferences.mockReturnValue(buildPreferencesQuery(buildCompletePreferencesData()));

    render(<PreferenceForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit Preferences' }));

    expect(submitMutation.mutate).toHaveBeenCalledWith({
      cycleId: 'cycle-1',
      preferences: [
        { shareIndex: 1, shift: 'DS1', choice1Date: '2026-04-20', choice2Date: '2026-04-21' },
        { shareIndex: 1, shift: 'DS2', choice1Date: '2026-04-21', choice2Date: '2026-04-22' },
        { shareIndex: 1, shift: 'NS', choice1Date: '2026-04-20', choice2Date: '2026-04-22' },
      ],
      fractionalPreferences: [
        { blockIndex: 1, fractionalHours: 6, choice1Date: '2026-04-20', choice2Date: '2026-04-21' },
        { blockIndex: 2, fractionalHours: 6, choice1Date: '2026-04-21', choice2Date: '2026-04-22' },
      ],
    });
  });

  it('shows the submitted confirmation page and summary after a successful submit', () => {
    const submitMutation = buildSubmitMutation();
    let submitState = submitMutation;
    useSubmitPreferences.mockImplementation(() => submitState);
    usePreferences.mockReturnValue(buildPreferencesQuery(buildCompletePreferencesData()));

    const { rerender } = render(<PreferenceForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit Preferences' }));
    submitState = { ...submitMutation, isSuccess: true };
    rerender(<PreferenceForm />);

    expect(screen.getByRole('heading', { name: 'Preferences Submitted' })).toBeInTheDocument();
    expect(screen.getByText('Submission Summary')).toBeInTheDocument();
    // Step 1 is Day Slot 1 (DAY1 mapped from DS1 server data)
    const stepOneRow = screen.getByText('Step 1: Share 1 - Day Slot 1').parentElement;
    expect(stepOneRow).toBeInTheDocument();
    expect(within(stepOneRow).getByText(/1st: Apr 20, 2026/)).toBeInTheDocument();
    expect(within(stepOneRow).getByText(/2nd: Apr 21, 2026/)).toBeInTheDocument();
  });

  it('opens server-loaded submitted preferences in review mode', () => {
    usePreferences.mockReturnValue(buildPreferencesQuery(buildCompletePreferencesData({
      submittedAt: '2026-04-10T12:00:00Z',
    })));

    render(<PreferenceForm />);

    expect(screen.getByRole('heading', { name: 'Preferences Submitted' })).toBeInTheDocument();
    expect(screen.getByText('Submission Summary')).toBeInTheDocument();
  });

  it('lets members edit submitted choices on the preference deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00-04:00'));
    usePreferences.mockReturnValue(buildPreferencesQuery(buildCompletePreferencesData({
      submittedAt: '2026-04-10T12:00:00Z',
    })));

    render(<PreferenceForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Choices' }));

    expect(screen.getByText('Preference Selection Sheet')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Preferences Submitted' })).not.toBeInTheDocument();
  });

  it('blocks editing and submitting after the preference deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00-04:00'));
    usePreferences.mockReturnValue(buildPreferencesQuery(buildCompletePreferencesData({
      submittedAt: '2026-04-10T12:00:00Z',
    })));

    render(<PreferenceForm />);

    expect(screen.queryByRole('button', { name: 'Edit Choices' })).not.toBeInTheDocument();
    expect(screen.getByText(/The preference deadline has passed/i)).toBeInTheDocument();
  });

  it('requires session selection before date picking is enabled', () => {
    render(<PreferenceForm />);

    const firstChoice = screen.getByRole('button', { name: /1st Choice/i });
    expect(within(firstChoice).getByText('Choose session first')).toBeInTheDocument();
    expect(firstChoice).toBeDisabled();

    // Calendar dates not blocked by isDateBlockedForStep when no shift — clicking does nothing
    // Select DS1 to enable
    fireEvent.click(screen.getByRole('button', { name: /Morning Shift/i }));

    expect(within(firstChoice).getByText('Not selected')).toBeInTheDocument();
    expect(firstChoice).not.toBeDisabled();
  });

  it('clearing DAY1 shift to NS hides Day Slot 2 step (double-night)', async () => {
    vi.useFakeTimers();

    render(<PreferenceForm />);

    // Initially 5 steps (DAY1, DAY2, NS for share + 2 fractional)
    expect(screen.getAllByRole('button', { name: /Step \d+/i })).toHaveLength(5);

    // Select NS on DAY1 (double-night) → DAY2 disappears → 4 steps
    fireEvent.click(screen.getByRole('button', { name: /Night Shift/i }));

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getAllByRole('button', { name: /Step \d+/i })).toHaveLength(4);
  });
});

function useDatesWithBlockedDs1() {
  useAvailableDates.mockReturnValue(buildDatesQuery({
    data: {
      data: [
        { date: '2026-04-20', isAvailable: true, ds1Available: false, ds2Available: true, nsAvailable: true },
        { date: '2026-04-21', isAvailable: true, ds1Available: true, ds2Available: true, nsAvailable: true },
        { date: '2026-04-22', isAvailable: true, ds1Available: true, ds2Available: true, nsAvailable: true },
      ],
    },
  }));
}
