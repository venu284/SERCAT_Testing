import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.fn();
const useActiveCycle = vi.fn();
const useMasterShares = vi.fn();
const useUsers = vi.fn();
const usePreferenceStatus = vi.fn();
const usePreferences = vi.fn();
const useSchedule = vi.fn();
const useSwapRequests = vi.fn();
const useComments = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('./useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('./useApiData', () => ({
  useMasterShares: (...args) => useMasterShares(...args),
  useUsers: (...args) => useUsers(...args),
  usePreferenceStatus: (...args) => usePreferenceStatus(...args),
  usePreferences: (...args) => usePreferences(...args),
  useSchedule: (...args) => useSchedule(...args),
  useSwapRequests: (...args) => useSwapRequests(...args),
  useComments: (...args) => useComments(...args),
}));

import { COLORS, MEMBER_BG } from '../lib/theme';
import { useAppShell } from './useAppShell';

describe('useAppShell', () => {
  beforeEach(() => {
    useAuth.mockReset();
    useActiveCycle.mockReset();
    useMasterShares.mockReset();
    useUsers.mockReset();
    usePreferenceStatus.mockReset();
    usePreferences.mockReset();
    useSchedule.mockReset();
    useSwapRequests.mockReset();
    useComments.mockReset();
  });

  it('builds the admin shell from real query payloads and registers colors for dynamic members', () => {
    useAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        role: 'admin',
        email: 'admin@sercat.org',
      },
      loading: false,
      logout: vi.fn(),
    });
    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-1',
        name: 'Spring 2026',
        startDate: '2026-04-20',
        endDate: '2026-05-20',
        preferenceDeadline: '2026-04-13T00:00:00Z',
        status: 'collecting',
      },
      activeCycleId: 'cycle-1',
      isLoading: false,
    });
    useMasterShares.mockReturnValue({
      data: [
        {
          id: 'share-1',
          institutionId: 'inst-1',
          institutionName: 'New Lab',
          institutionAbbreviation: 'NEWLAB',
          piId: 'pi-1',
          piName: 'Dr. Grace Hopper',
          piEmail: 'grace@newlab.edu',
          wholeShares: '1',
          fractionalShares: '0.5',
        },
        {
          id: 'share-2',
          institutionId: 'inst-2',
          institutionName: 'UGA',
          institutionAbbreviation: 'UGA',
          piId: 'pi-2',
          piName: 'Dr. Ada Lovelace',
          piEmail: 'ada@uga.edu',
          wholeShares: '1',
          fractionalShares: '0',
        },
      ],
      isLoading: false,
    });
    useUsers.mockReturnValue({
      data: {
        data: [
          { id: 'pi-1', institutionId: 'inst-1', isActive: true, isActivated: false, name: 'Dr. Grace Hopper', email: 'grace@newlab.edu' },
          { id: 'pi-2', institutionId: 'inst-2', isActive: true, isActivated: true, name: 'Dr. Ada Lovelace', email: 'ada@uga.edu' },
        ],
        pagination: { page: 1, totalPages: 1 },
      },
      isLoading: false,
    });
    usePreferenceStatus.mockReturnValue({
      data: {
        status: [
          { piId: 'pi-1', hasSubmitted: false },
          { piId: 'pi-2', hasSubmitted: true },
        ],
      },
      isLoading: false,
    });
    usePreferences.mockReturnValue({ data: null, isLoading: false });
    useSchedule.mockReturnValue({
      data: {
        scheduleId: 'schedule-1',
        status: 'published',
        assignments: [{ id: 'assign-1', piId: 'pi-2' }],
      },
      isLoading: false,
    });
    useSwapRequests.mockReturnValue({
      data: [
        { id: 'swap-1', requesterId: 'pi-2', status: 'pending' },
      ],
      isLoading: false,
    });
    useComments.mockReturnValue({
      data: [
        { id: 'comment-1', piId: 'pi-2', status: 'replied' },
      ],
      isLoading: false,
    });

    const { result } = renderHook(() => useAppShell());

    act(() => {
      result.current.setCurrentView('UGA');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.cycle).toEqual({
      id: 'Spring 2026',
      startDate: '2026-04-20',
      endDate: '2026-05-20',
      preferenceDeadline: '2026-04-13',
      _dbId: 'cycle-1',
      _status: 'collecting',
    });
    expect(result.current.members).toHaveLength(2);
    expect(result.current.pendingRegistrationCount).toBe(1);
    expect(result.current.activeMember?.id).toBe('UGA');
    expect(useSchedule).toHaveBeenCalledWith('cycle-1', {
      enabled: true,
      staleTime: 0,
      refetchInterval: 30000,
    });
    expect(result.current.memberTabBadges).toMatchObject({
      availability: 'Live',
      preferences: 'Done',
      schedule: 'Published',
      shiftChanges: '1',
      comments: '1',
    });
    expect(COLORS.NEWLAB).toBeTruthy();
    expect(MEMBER_BG.NEWLAB).toBeTruthy();
  });

  it('derives the PI preference badge from the PI-safe preferences endpoint instead of admin-only status rows', () => {
    useAuth.mockReturnValue({
      user: {
        id: 'pi-1',
        role: 'pi',
        email: 'grace@newlab.edu',
        institutionId: 'inst-1',
        institutionAbbreviation: 'NEWLAB',
      },
      loading: false,
      logout: vi.fn(),
    });
    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-1',
        name: 'Spring 2026',
        startDate: '2026-04-20',
        endDate: '2026-05-20',
        preferenceDeadline: '2026-04-13',
        status: 'collecting',
      },
      activeCycleId: 'cycle-1',
      isLoading: false,
    });
    useMasterShares.mockReturnValue({
      data: [
        {
          id: 'share-1',
          institutionId: 'inst-1',
          institutionName: 'New Lab',
          institutionAbbreviation: 'NEWLAB',
          piId: 'pi-1',
          piName: 'Dr. Grace Hopper',
          piEmail: 'grace@newlab.edu',
          wholeShares: '1',
          fractionalShares: '0',
        },
      ],
      isLoading: false,
    });
    useUsers.mockReturnValue({
      data: {
        data: [
          { id: 'pi-1', institutionId: 'inst-1', isActive: true, isActivated: true, name: 'Dr. Grace Hopper', email: 'grace@newlab.edu' },
        ],
        pagination: { page: 1, totalPages: 1 },
      },
      isLoading: false,
    });
    usePreferenceStatus.mockReturnValue({
      data: { status: [] },
      isLoading: false,
    });
    usePreferences.mockReturnValue({
      data: {
        preferences: [],
        fractionalPreferences: [],
        submittedAt: '2026-04-10T12:00:00Z',
        submissions: [{ piId: 'pi-1', submittedAt: '2026-04-10T12:00:00Z' }],
      },
      isLoading: false,
    });
    useSchedule.mockReturnValue({
      data: {
        scheduleId: 'schedule-1',
        status: 'draft',
        assignments: [],
      },
      isLoading: false,
    });
    useSwapRequests.mockReturnValue({ data: [], isLoading: false });
    useComments.mockReturnValue({ data: [], isLoading: false });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.activeMember?.id).toBe('NEWLAB');
    expect(result.current.memberTabBadges.preferences).toBe('Done');
    expect(usePreferenceStatus).toHaveBeenCalledWith(null, { enabled: false });
    expect(usePreferences).toHaveBeenCalledWith('cycle-1', { enabled: true });
    expect(useSchedule).toHaveBeenCalledWith('cycle-1', {
      enabled: true,
      staleTime: 0,
      refetchInterval: 30000,
    });
  });
});
