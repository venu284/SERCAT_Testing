import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useMasterShares = vi.fn();
const usePreferences = vi.fn();
const useSchedule = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('./useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('./useApiData', () => ({
  useMasterShares: () => useMasterShares(),
  usePreferences: (cycleId) => usePreferences(cycleId),
  useSchedule: (...args) => useSchedule(...args),
}));

import { useMemberDashboardContext } from './useMemberDashboardContext';

describe('useMemberDashboardContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));

    useAuth.mockReset();
    useActiveCycle.mockReset();
    useMasterShares.mockReset();
    usePreferences.mockReset();
    useSchedule.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives entitlement, deadline fallback, submission state, and member assignments from live payloads', () => {
    useAuth.mockReturnValue({
      user: {
        id: 'pi-1',
        name: 'Dr. Ada Lovelace',
        institutionId: 'inst-1',
        institutionName: 'User Institution Name',
        institutionAbbreviation: 'USER',
      },
    });

    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-2026-spring',
        startDate: '2026-03-20',
        endDate: '2026-04-20',
      },
      activeCycleId: 'cycle-2026-spring',
      isLoading: false,
      error: null,
    });

    useMasterShares.mockReturnValue({
      data: [
        {
          id: 'share-1',
          piId: 'pi-1',
          institutionId: 'inst-1',
          institutionAbbreviation: 'SERCAT',
          institutionName: 'SERCAT University',
          wholeShares: 2,
          fractionalShares: 0.25,
        },
        {
          id: 'share-2',
          piId: 'pi-2',
          institutionId: 'inst-2',
          institutionAbbreviation: 'OTHER',
          institutionName: 'Other Institution',
          wholeShares: 1,
          fractionalShares: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    usePreferences.mockReturnValue({
      data: {
        submittedAt: null,
        submissions: [
          { piId: 'pi-1', submittedAt: '2026-03-01T12:00:00Z' },
        ],
      },
      isLoading: false,
      error: null,
    });

    useSchedule.mockReturnValue({
      data: {
        status: 'published',
        publishedAt: '2026-03-05T15:30:00Z',
        generatedAt: '2026-03-04T10:00:00Z',
        assignments: [
          { id: 'a-1', piId: 'pi-1', assignedDate: '2026-03-21', shift: 'DS1' },
          { id: 'a-2', piId: 'pi-1', assignedDate: '2026-03-22', shift: 'NS' },
          { id: 'a-3', piId: 'pi-2', assignedDate: '2026-03-23', shift: 'DS2' },
        ],
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useMemberDashboardContext());

    expect(usePreferences).toHaveBeenCalledWith('cycle-2026-spring');
    expect(useSchedule).toHaveBeenCalledWith('cycle-2026-spring', { staleTime: 0 });

    expect(result.current.member).toEqual({
      id: 'SERCAT',
      name: 'SERCAT University',
      shares: 2.25,
      status: 'ACTIVE',
      _piUserId: 'pi-1',
      _institutionUuid: 'inst-1',
    });
    expect(result.current.entitlement).toEqual({
      memberId: 'SERCAT',
      totalShares: 2.25,
      wholeShares: 2,
      fractionalHours: 6,
      nightShifts: 2,
    });
    expect(result.current.preferenceDeadline).toBe('2026-03-13');
    expect(result.current.daysUntilPreferenceDeadline).toBe(3);
    expect(result.current.isPreferenceSubmitted).toBe(true);
    expect(result.current.isPreferenceSubmitted).toBe(
      Boolean(
        usePreferences.mock.results[0].value.data.submissions.find((entry) => entry.piId === 'pi-1')?.submittedAt,
      ),
    );
    expect(result.current.schedulePublication).toEqual({
      status: 'published',
      publishedAt: '2026-03-05T15:30:00Z',
      draftedAt: '2026-03-04T10:00:00Z',
    });
    expect(result.current.currentMemberAssignments).toEqual([
      { id: 'a-1', piId: 'pi-1', assignedDate: '2026-03-21', shift: 'DS1' },
      { id: 'a-2', piId: 'pi-1', assignedDate: '2026-03-22', shift: 'NS' },
    ]);
    expect(result.current.memberShiftCounts).toEqual({
      DS1: 1,
      DS2: 0,
      NS: 1,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns a safe empty member state when the signed-in PI has no share row yet', () => {
    useAuth.mockReturnValue({
      user: {
        id: 'pi-missing',
        name: 'Dr. Grace Hopper',
        institutionId: 'inst-missing',
        institutionName: 'Grace Lab',
        institutionAbbreviation: 'GLAB',
      },
    });

    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-2026-fall',
        startDate: '2026-09-15',
        endDate: '2026-10-15',
        preferenceDeadline: '2026-09-01',
      },
      activeCycleId: 'cycle-2026-fall',
      isLoading: true,
      error: null,
    });

    useMasterShares.mockReturnValue({
      data: [
        {
          id: 'share-9',
          piId: 'pi-9',
          institutionId: 'inst-9',
          institutionAbbreviation: 'OTHER',
          institutionName: 'Other Institution',
          wholeShares: 1,
          fractionalShares: 0.5,
        },
      ],
      isLoading: false,
      error: null,
    });

    usePreferences.mockReturnValue({
      data: {
        submittedAt: null,
        submissions: [],
      },
      isLoading: false,
      error: null,
    });

    useSchedule.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('schedule offline'),
    });

    const { result } = renderHook(() => useMemberDashboardContext());

    expect(result.current.member).toBeNull();
    expect(result.current.entitlement).toEqual({
      wholeShares: 0,
      fractionalHours: 0,
    });
    expect(result.current.preferenceDeadline).toBe('2026-09-01');
    expect(result.current.daysUntilPreferenceDeadline).toBe(175);
    expect(result.current.isPreferenceSubmitted).toBe(false);
    expect(result.current.schedulePublication).toEqual({
      status: '',
      publishedAt: '',
      draftedAt: '',
    });
    expect(result.current.currentMemberAssignments).toEqual([]);
    expect(result.current.memberShiftCounts).toEqual({
      DS1: 0,
      DS2: 0,
      NS: 0,
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toEqual(expect.any(Error));
    expect(result.current.error.message).toBe('schedule offline');
  });

  it('normalizes timezone-bearing preference deadlines to date-only strings for countdown math', () => {
    useAuth.mockReturnValue({
      user: {
        id: 'pi-1',
        name: 'Dr. Ada Lovelace',
        institutionId: 'inst-1',
      },
    });

    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-2026-spring',
        startDate: '2026-03-20',
        preferenceDeadline: '2026-03-13T23:30:00Z',
      },
      activeCycleId: 'cycle-2026-spring',
      isLoading: false,
      error: null,
    });

    useMasterShares.mockReturnValue({
      data: [
        {
          id: 'share-1',
          piId: 'pi-1',
          institutionId: 'inst-1',
          institutionAbbreviation: 'SERCAT',
          institutionName: 'SERCAT University',
          wholeShares: 1,
          fractionalShares: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    usePreferences.mockReturnValue({
      data: {
        submittedAt: null,
        submissions: [],
      },
      isLoading: false,
      error: null,
    });

    useSchedule.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useMemberDashboardContext());

    expect(result.current.preferenceDeadline).toBe('2026-03-13');
    expect(result.current.daysUntilPreferenceDeadline).toBe(3);
  });
});
