import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useActiveCycle = vi.fn();
const useAvailableDates = vi.fn();
const useCycleShares = vi.fn();
const useGenerateSchedule = vi.fn();
const useMasterShares = vi.fn();
const usePreferenceStatus = vi.fn();
const usePreferences = vi.fn();
const usePublishSchedule = vi.fn();
const useSchedule = vi.fn();
const useSnapshotShares = vi.fn();
const useUnpublishSchedule = vi.fn();
const useUsers = vi.fn();

vi.mock('../../hooks/useActiveCycle', () => ({
  useActiveCycle: () => useActiveCycle(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useAvailableDates: (cycleId) => useAvailableDates(cycleId),
  useCycleShares: (cycleId) => useCycleShares(cycleId),
  useGenerateSchedule: () => useGenerateSchedule(),
  useMasterShares: () => useMasterShares(),
  usePreferenceStatus: (cycleId) => usePreferenceStatus(cycleId),
  usePreferences: (cycleId, options) => usePreferences(cycleId, options),
  usePublishSchedule: () => usePublishSchedule(),
  useSchedule: (cycleId) => useSchedule(cycleId),
  useSnapshotShares: () => useSnapshotShares(),
  useUnpublishSchedule: () => useUnpublishSchedule(),
  useUsers: (params) => useUsers(params),
}));

vi.mock('../../components/CalendarResults', () => ({
  default: () => null,
}));

import EngineAndSchedule from './EngineAndSchedule';

function buildMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue({ data: {} }),
    isPending: false,
    ...overrides,
  };
}

function buildQuery(data, overrides = {}) {
  return {
    data,
    isLoading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({ data }),
    ...overrides,
  };
}

describe('EngineAndSchedule', () => {
  beforeEach(() => {
    useActiveCycle.mockReset();
    useAvailableDates.mockReset();
    useCycleShares.mockReset();
    useGenerateSchedule.mockReset();
    useMasterShares.mockReset();
    usePreferenceStatus.mockReset();
    usePreferences.mockReset();
    usePublishSchedule.mockReset();
    useSchedule.mockReset();
    useSnapshotShares.mockReset();
    useUnpublishSchedule.mockReset();
    useUsers.mockReset();

    useActiveCycle.mockReturnValue({
      activeCycle: {
        id: 'cycle-1',
        name: 'Spring 2026',
        startDate: '2026-04-20',
        endDate: '2026-04-30',
        preferenceDeadline: '2026-04-13T00:00:00Z',
      },
      activeCycleId: 'cycle-1',
      isLoading: false,
      error: null,
    });
    useAvailableDates.mockReturnValue(buildQuery({ data: [] }));
    useCycleShares.mockReturnValue(buildQuery({ data: [] }));
    useMasterShares.mockReturnValue(buildQuery({
      data: [
        {
          id: 'share-1',
          institutionId: 'inst-1',
          institutionName: 'University of Georgia',
          institutionAbbreviation: 'UGA',
          piId: 'pi-1',
          wholeShares: 1,
          fractionalShares: 0,
        },
      ],
    }));
    useUsers.mockReturnValue(buildQuery({
      data: [
        { id: 'pi-1', name: 'Dr. One', email: 'pi1@example.org', role: 'pi', isActive: true, isActivated: true },
      ],
    }));
    usePreferenceStatus.mockReturnValue(buildQuery({
      summary: { total: 1, submitted: 1, pending: 0 },
      status: [{ piId: 'pi-1', hasSubmitted: true }],
    }));
    usePreferences.mockReturnValue(buildQuery({
      preferences: [
        {
          piId: 'pi-1',
          shareIndex: 1,
          shift: 'DS1',
          choice1Date: '2026-04-20',
          choice2Date: '2026-04-21',
        },
      ],
      fractionalPreferences: [],
      submissions: [{ piId: 'pi-1', submittedAt: '2026-04-12T12:00:00Z' }],
    }));
    useSchedule.mockReturnValue(buildQuery(null));
    useGenerateSchedule.mockReturnValue(buildMutation());
    useSnapshotShares.mockReturnValue(buildMutation());
    usePublishSchedule.mockReturnValue(buildMutation());
    useUnpublishSchedule.mockReturnValue(buildMutation());
  });

  it('uses master shares to keep generation available before the cycle share snapshot exists', async () => {
    const user = userEvent.setup();
    const snapshotMutation = buildMutation();
    const generateMutation = buildMutation();
    useSnapshotShares.mockReturnValue(snapshotMutation);
    useGenerateSchedule.mockReturnValue(generateMutation);

    render(<EngineAndSchedule />);

    const button = screen.getByRole('button', { name: 'Generate Schedule (1/1 submitted)' });
    expect(button).toBeEnabled();

    await user.click(button);

    expect(snapshotMutation.mutateAsync).toHaveBeenCalledWith('cycle-1');
    expect(generateMutation.mutateAsync).toHaveBeenCalledWith('cycle-1');
  });
});
