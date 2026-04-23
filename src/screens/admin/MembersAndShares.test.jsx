import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useUsers = vi.fn();
const useMasterShares = vi.fn();
const useUpdateUser = vi.fn();
const useDeactivateUser = vi.fn();
const useResendInvite = vi.fn();
const useUpdateShare = vi.fn();
const useUploadShares = vi.fn();

vi.mock('../../hooks/useApiData', () => ({
  useUsers: (params) => useUsers(params),
  useMasterShares: () => useMasterShares(),
  useUpdateUser: () => useUpdateUser(),
  useDeactivateUser: () => useDeactivateUser(),
  useResendInvite: () => useResendInvite(),
  useUpdateShare: () => useUpdateShare(),
  useUploadShares: () => useUploadShares(),
}));

import MembersAndShares from './MembersAndShares';

function buildMutation() {
  return { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false };
}

describe('MembersAndShares', () => {
  beforeEach(() => {
    useUsers.mockReset();
    useMasterShares.mockReset();
    useUpdateUser.mockReset();
    useDeactivateUser.mockReset();
    useResendInvite.mockReset();
    useUpdateShare.mockReset();
    useUploadShares.mockReset();

    useUsers.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false, error: null });
    useMasterShares.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
    useUpdateUser.mockReturnValue(buildMutation());
    useDeactivateUser.mockReturnValue(buildMutation());
    useResendInvite.mockReturnValue(buildMutation());
    useUpdateShare.mockReturnValue(buildMutation());
    useUploadShares.mockReturnValue(buildMutation());
  });

  it('loads members from API hooks and removes prototype-only sections', () => {
    render(<MembersAndShares />);

    expect(useUsers).toHaveBeenCalledWith({ all: true });
    expect(useMasterShares).toHaveBeenCalled();
    expect(screen.queryByText('Legacy Registration Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('Testing Accounts')).not.toBeInTheDocument();
  });

  it('creates a new member through the upload endpoint with a single-row batch', async () => {
    const user = userEvent.setup();
    const uploadMutation = buildMutation();
    uploadMutation.mutateAsync.mockResolvedValue({
      data: {
        inviteTokens: [{ email: 'new-pi@example.edu', name: 'Dr. New', token: 'invite-token-123' }],
      },
    });
    useUploadShares.mockReturnValue(uploadMutation);

    render(<MembersAndShares />);

    await user.type(screen.getByPlaceholderText('Abbreviation'), 'UGA');
    await user.type(screen.getByPlaceholderText('Institution name'), 'University of Georgia');
    await user.type(screen.getByPlaceholderText('Shares'), '2.5');
    await user.type(screen.getByPlaceholderText('PI name'), 'Dr. New');
    await user.type(screen.getByPlaceholderText('PI email'), 'new-pi@example.edu');
    await user.click(screen.getByRole('button', { name: 'Create Invite' }));

    expect(uploadMutation.mutateAsync).toHaveBeenCalledWith({
      rows: [{
        institutionName: 'University of Georgia',
        abbreviation: 'UGA',
        piName: 'Dr. New',
        piEmail: 'new-pi@example.edu',
        wholeShares: 2,
        fractionalShares: 0.5,
      }],
    });
    expect(await screen.findByText('Invitation created')).toBeInTheDocument();
    expect(screen.getByText('invite-token-123')).toBeInTheDocument();
  });
});
