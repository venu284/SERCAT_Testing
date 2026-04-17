import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useMockApp = vi.fn();
const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useMasterShares = vi.fn();
const usePreferences = vi.fn();
const useAvailableDates = vi.fn();
const useSubmitPreferences = vi.fn();

vi.mock('../../lib/mock-state', () => ({
  useMockApp: () => useMockApp(),
}));

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

function buildMockState() {
  return {
    activeMember: {
      id: 'SERCAT',
      name: 'SERCAT',
      shares: 1.5,
      status: 'ACTIVE',
    },
    cycle: {
      id: 'Spring 2026',
      startDate: '2026-04-20',
      endDate: '2026-04-22',
      preferenceDeadline: '2026-04-13',
      blockedDates: [],
      blockedSlots: [],
    },
    preferences: {},
    updatePreference: vi.fn(),
  };
}

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
    isError: false,
    error: null,
    ...overrides,
  };
}

describe('PreferenceForm', () => {
  beforeEach(() => {
    useMockApp.mockReset();
    useAuth.mockReset();
    useActiveCycle.mockReset();
    useMasterShares.mockReset();
    usePreferences.mockReset();
    useAvailableDates.mockReset();
    useSubmitPreferences.mockReset();

    useMockApp.mockReturnValue(buildMockState());
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
    expect(useMockApp).not.toHaveBeenCalled();
  });

  it('shows a clear empty state when there is no active cycle', () => {
    useActiveCycle.mockReturnValue(buildActiveCycle({ activeCycle: null, activeCycleId: null }));

    render(<PreferenceForm />);

    expect(screen.getByText('No active cycle. Check back when a new cycle is created.')).toBeInTheDocument();
    expect(useMockApp).not.toHaveBeenCalled();
  });

  it('shows a clear empty state when no share matches the signed-in PI', () => {
    useMasterShares.mockReturnValue(buildSharesQuery({ data: [] }));

    render(<PreferenceForm />);

    expect(screen.getByText('No active share found for your account.')).toBeInTheDocument();
    expect(useMockApp).not.toHaveBeenCalled();
  });

  it('blocks per-shift unavailable dates and debounces whole-share preference saves with optimistic UI updates', async () => {
    vi.useFakeTimers();
    const submitMutation = buildSubmitMutation();
    useSubmitPreferences.mockReturnValue(submitMutation);
    useDatesWithBlockedDs1();

    render(<PreferenceForm />);

    const blockedDate = screen.getByRole('button', { name: '20' });
    const openDate = screen.getByRole('button', { name: '21' });

    expect(blockedDate).toBeDisabled();

    fireEvent.click(openDate);

    expect(screen.getByText('Apr 21, 2026')).toBeInTheDocument();
    expect(submitMutation.mutate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(submitMutation.mutate).toHaveBeenCalledWith({
      cycleId: 'cycle-1',
      preferences: [
        {
          shareIndex: 1,
          shift: 'DS1',
          choice1Date: '2026-04-21',
          choice2Date: null,
        },
      ],
      fractionalPreferences: [],
    });
  });

  it('posts fractional preference rows when the first incomplete step is a fractional block', async () => {
    vi.useFakeTimers();
    const submitMutation = buildSubmitMutation();
    useSubmitPreferences.mockReturnValue(submitMutation);
    usePreferences.mockReturnValue(buildPreferencesQuery({
      data: {
        data: {
          preferences: [
            { shareIndex: 1, shift: 'DS1', choice1Date: '2026-04-20', choice2Date: '2026-04-21', piId: 'pi-1' },
            { shareIndex: 1, shift: 'DS2', choice1Date: '2026-04-20', choice2Date: '2026-04-21', piId: 'pi-1' },
            { shareIndex: 1, shift: 'NS', choice1Date: '2026-04-20', choice2Date: '2026-04-21', piId: 'pi-1' },
          ],
          fractionalPreferences: [],
          submittedAt: null,
          submissions: [],
        },
      },
    }));

    render(<PreferenceForm />);

    expect(screen.getByText('Fractional Block 1 - 6h')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '22' }));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(submitMutation.mutate).toHaveBeenCalledWith({
      cycleId: 'cycle-1',
      preferences: [
        { shareIndex: 1, shift: 'DS1', choice1Date: '2026-04-20', choice2Date: '2026-04-21' },
        { shareIndex: 1, shift: 'DS2', choice1Date: '2026-04-20', choice2Date: '2026-04-21' },
        { shareIndex: 1, shift: 'NS', choice1Date: '2026-04-20', choice2Date: '2026-04-21' },
      ],
      fractionalPreferences: [
        {
          blockIndex: 1,
          fractionalHours: 6,
          choice1Date: '2026-04-22',
          choice2Date: null,
        },
      ],
    });
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
