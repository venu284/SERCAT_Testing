import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useMockApp = vi.fn();
const useUsers = vi.fn();
const useMasterShares = vi.fn();
const useInstitutions = vi.fn();
const useCreateUser = vi.fn();
const useUpdateUser = vi.fn();
const useDeactivateUser = vi.fn();
const useResendInvite = vi.fn();
const useUpdateShare = vi.fn();
const useUploadShares = vi.fn();

vi.mock('../../lib/mock-state', () => ({
  useMockApp: () => useMockApp(),
}));

vi.mock('../../hooks/useApiData', () => ({
  useUsers: (params) => useUsers(params),
  useMasterShares: () => useMasterShares(),
  useInstitutions: () => useInstitutions(),
  useCreateUser: () => useCreateUser(),
  useUpdateUser: () => useUpdateUser(),
  useDeactivateUser: () => useDeactivateUser(),
  useResendInvite: () => useResendInvite(),
  useUpdateShare: () => useUpdateShare(),
  useUploadShares: () => useUploadShares(),
}));

import MembersAndShares from './MembersAndShares';

function buildMockState() {
  return {
    pendingRegistrationCount: 0,
    pendingRegistrationRequests: [],
    registrationApprovalDrafts: {},
    registrationActionErrors: {},
    setRegistrationApprovalDraft: vi.fn(),
    approveRegistrationRequest: vi.fn(),
    rejectRegistrationRequest: vi.fn(),
    memberDirectory: {},
    resolvedRegistrationRequests: [],
    memberStatusFilter: 'all',
    setMemberStatusFilter: vi.fn(),
    filteredMembersForAdmin: [
      {
        id: 'UGA',
        name: 'University of Georgia',
        piName: 'Dr. Old',
        piEmail: 'old@uga.edu',
        shares: 2.5,
        status: 'ACTIVE',
      },
    ],
    updateMember: vi.fn(),
    newMemberForm: { id: '', name: '', shares: '', piName: '', piEmail: '' },
    setNewMemberForm: vi.fn(),
    addMember: vi.fn(() => ({ ok: true, piName: 'Dr. Old', piEmail: 'old@uga.edu', inviteToken: 'token' })),
    testAccounts: { admin: { username: 'admin', password: 'pw' } },
    memberLoginAccounts: [],
    piAccessAccounts: [],
    resendMemberInvite: vi.fn(() => ({ ok: true, piName: 'Dr. Old', piEmail: 'old@uga.edu', inviteToken: 'token' })),
    cancelMemberInvite: vi.fn(() => ({ ok: true })),
    deactivateMember: vi.fn(() => ({ ok: true })),
    changeMemberPi: vi.fn(() => ({ ok: true, inviteToken: 'token', piEmail: 'new@uga.edu' })),
    reinviteMember: vi.fn(() => ({ ok: true, inviteToken: 'token', piEmail: 'new@uga.edu' })),
  };
}

function buildMutation() {
  return { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false };
}

describe('MembersAndShares', () => {
  beforeEach(() => {
    useMockApp.mockReset();
    useUsers.mockReset();
    useMasterShares.mockReset();
    useInstitutions.mockReset();
    useCreateUser.mockReset();
    useUpdateUser.mockReset();
    useDeactivateUser.mockReset();
    useResendInvite.mockReset();
    useUpdateShare.mockReset();
    useUploadShares.mockReset();

    useMockApp.mockReturnValue(buildMockState());
    useUsers.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false, error: null });
    useMasterShares.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
    useInstitutions.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false, error: null });
    useCreateUser.mockReturnValue(buildMutation());
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
});
