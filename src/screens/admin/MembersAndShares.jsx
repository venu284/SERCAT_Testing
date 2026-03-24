import React from 'react';
import { COLORS, CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

function StatusBadge({ status }) {
  const badgeByStatus = {
    ACTIVE: {
      label: 'Active',
      background: CONCEPT_THEME.emeraldLight,
      color: CONCEPT_THEME.emerald,
    },
    INVITED: {
      label: 'Pending Activation',
      background: CONCEPT_THEME.amberLight,
      color: CONCEPT_THEME.amberOnAmber,
    },
    DEACTIVATED: {
      label: 'Deactivated',
      background: '#f3f4f6',
      color: '#6b7280',
    },
  };

  const badge = badgeByStatus[status] || badgeByStatus.DEACTIVATED;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em]"
      style={{ background: badge.background, color: badge.color }}
    >
      {badge.label}
    </span>
  );
}

function ActionButtons({ member, onDeactivate, onChangePi, onResendInvite, onCancelInvite, onReinvite }) {
  if (member.status === 'ACTIVE') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChangePi(member.id)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: `${CONCEPT_THEME.sky}16`, color: CONCEPT_THEME.sky }}
        >
          Change PI
        </button>
        <button
          type="button"
          onClick={() => onDeactivate(member.id)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: '#fef2f2', color: '#b91c1c' }}
        >
          Deactivate
        </button>
      </div>
    );
  }

  if (member.status === 'INVITED') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onResendInvite(member.id)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: `${CONCEPT_THEME.amber}14`, color: CONCEPT_THEME.amberText }}
        >
          Re-send Invite
        </button>
        <button
          type="button"
          onClick={() => onCancelInvite(member.id)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: '#f3f4f6', color: '#6b7280' }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onReinvite(member.id)}
      className="rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ background: `${CONCEPT_THEME.navy}12`, color: CONCEPT_THEME.navy }}
    >
      Re-invite
    </button>
  );
}

export default function MembersAndShares() {
  const {
    pendingRegistrationCount,
    pendingRegistrationRequests,
    registrationApprovalDrafts,
    registrationActionErrors,
    setRegistrationApprovalDraft,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    memberDirectory,
    resolvedRegistrationRequests,
    memberStatusFilter,
    setMemberStatusFilter,
    filteredMembersForAdmin,
    updateMember,
    newMemberForm,
    setNewMemberForm,
    addMember,
    testAccounts,
    memberLoginAccounts,
    piAccessAccounts,
    submittedPreferenceNotes,
    resendMemberInvite,
    cancelMemberInvite,
    deactivateMember,
    changeMemberPi,
    reinviteMember,
  } = useMockApp();

  const showLegacyRequests = pendingRegistrationCount > 0 || resolvedRegistrationRequests.length > 0;

  return (
    <div className="space-y-4 concept-font-body">
      {showLegacyRequests ? (
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Legacy Registration Requests</h3>
              <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
                Historical self-registration requests remain available here for reference and cleanup.
              </p>
            </div>
            <span
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em]"
              style={{
                background: pendingRegistrationCount > 0 ? CONCEPT_THEME.amberLight : '#f3f4f6',
                color: pendingRegistrationCount > 0 ? CONCEPT_THEME.amberOnAmber : '#6b7280',
              }}
            >
              Pending: {pendingRegistrationCount}
            </span>
          </div>

          {pendingRegistrationCount > 0 ? (
            <div className="space-y-3">
              {pendingRegistrationRequests.map((request) => {
                const draft = registrationApprovalDrafts[request.id] || {};
                const actionError = registrationActionErrors[request.id];
                const institutionDisplayName = request.institutionLabel || memberDirectory[request.institutionMemberId]?.name || request.institutionMemberId;
                return (
                  <div key={request.id} className="rounded-2xl border p-4" style={{ background: CONCEPT_THEME.amberLight, borderColor: `${CONCEPT_THEME.amber}25` }}>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div><span className="font-semibold" style={{ color: CONCEPT_THEME.navy }}>Institution:</span> {institutionDisplayName} ({request.institutionMemberId})</div>
                      <div><span className="font-semibold" style={{ color: CONCEPT_THEME.navy }}>Email:</span> {request.institutionalEmail}</div>
                      <div><span className="font-semibold" style={{ color: CONCEPT_THEME.navy }}>Requested Shares:</span> {request.requestedShares}</div>
                      <div><span className="font-semibold" style={{ color: CONCEPT_THEME.navy }}>Submitted:</span> {new Date(request.createdAt).toLocaleString()}</div>
                    </div>

                    <div className="mt-3 grid gap-2 lg:grid-cols-[180px_1fr]">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.approvedShares ?? request.requestedShares}
                        onChange={(event) => setRegistrationApprovalDraft(request.id, { approvedShares: event.target.value })}
                        className="rounded-xl border px-3 py-2 text-sm outline-none"
                        style={{ background: 'white', borderColor: CONCEPT_THEME.border }}
                        placeholder="Approved shares"
                      />
                      <input
                        type="text"
                        value={draft.adminNote || ''}
                        onChange={(event) => setRegistrationApprovalDraft(request.id, { adminNote: event.target.value })}
                        className="rounded-xl border px-3 py-2 text-sm outline-none"
                        style={{ background: 'white', borderColor: CONCEPT_THEME.border }}
                        placeholder="Admin note (optional)"
                      />
                    </div>

                    {actionError ? (
                      <div className="mt-2 rounded-xl border px-3 py-2 text-xs" style={{ background: '#fff1f1', borderColor: '#fecaca', color: '#b91c1c' }}>
                        {actionError}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => approveRegistrationRequest(request.id)}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectRegistrationRequest(request.id)}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{ background: '#fff1f1', color: '#b91c1c' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border px-4 py-4 text-sm" style={{ background: '#fafafa', borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
              No pending legacy registration requests.
            </div>
          )}

          {resolvedRegistrationRequests.length > 0 ? (
            <div className="mt-5 border-t pt-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
              <h4 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Recently Resolved</h4>
              <div className="mt-3 space-y-2">
                {resolvedRegistrationRequests.slice(0, 6).map((request) => {
                  const institutionDisplayName = request.institutionLabel || memberDirectory[request.institutionMemberId]?.name || request.institutionMemberId;
                  return (
                    <div key={request.id} className="rounded-2xl border px-4 py-3 text-xs" style={{ background: '#fafafa', borderColor: CONCEPT_THEME.borderLight }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" style={{ color: CONCEPT_THEME.navy }}>{institutionDisplayName} ({request.institutionMemberId})</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
                          style={{
                            background: request.status === 'Approved' ? CONCEPT_THEME.emeraldLight : '#fff1f1',
                            color: request.status === 'Approved' ? CONCEPT_THEME.emerald : '#b91c1c',
                          }}
                        >
                          {request.status}
                        </span>
                        <span style={{ color: CONCEPT_THEME.muted }}>{request.institutionalEmail}</span>
                      </div>
                      <div className="mt-1" style={{ color: CONCEPT_THEME.muted }}>
                        Shares: {request.requestedShares} | Resolved: {request.resolvedAt ? new Date(request.resolvedAt).toLocaleString() : 'N/A'}
                        {request.adminNote ? ` | Note: ${request.adminNote}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Members & Shares</h3>
            <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
              Manage institution records, PI invitations, and member status from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'invited', label: 'Invited' },
              { id: 'deactivated', label: 'Deactivated' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setMemberStatusFilter(filter.id)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={memberStatusFilter === filter.id
                  ? { background: CONCEPT_THEME.navy, color: 'white' }
                  : { background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
                <th className="px-2 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.16em]">ID</th>
                <th className="px-2 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.16em]">Institution</th>
                <th className="px-2 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.16em]">PI Name</th>
                <th className="px-2 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.16em]">PI Email</th>
                <th className="px-2 py-2 text-right text-[13px] font-semibold uppercase tracking-[0.16em]">Shares</th>
                <th className="px-2 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.16em]">Status</th>
                <th className="px-2 py-2 text-left text-[13px] font-semibold uppercase tracking-[0.16em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembersForAdmin.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
                    No members match the selected filter.
                  </td>
                </tr>
              ) : null}

              {filteredMembersForAdmin.map((member) => (
                <tr key={member.id} className="border-b align-top" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <td className="px-2 py-3 font-bold" style={{ color: COLORS[member.id] || CONCEPT_THEME.navy }}>{member.id}</td>
                  <td className="px-2 py-3">
                    <div className="font-semibold" style={{ color: CONCEPT_THEME.text }}>{member.name}</div>
                    {member.invitedAt ? (
                      <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                        Invited {new Date(member.invitedAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3" style={{ color: CONCEPT_THEME.text }}>{member.piName || '-'}</td>
                  <td className="px-2 py-3" style={{ color: CONCEPT_THEME.muted }}>{member.piEmail || '-'}</td>
                  <td className="px-2 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={member.shares}
                      onChange={(event) => updateMember(member.id, { shares: event.target.value })}
                      className="w-24 rounded-xl border px-2.5 py-2 text-right text-sm outline-none"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <StatusBadge status={member.status} />
                    {member.activatedAt ? (
                      <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                        Activated {new Date(member.activatedAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <ActionButtons
                      member={member}
                      onDeactivate={deactivateMember}
                      onChangePi={changeMemberPi}
                      onResendInvite={resendMemberInvite}
                      onCancelInvite={cancelMemberInvite}
                      onReinvite={reinviteMember}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="mb-4">
          <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Add New Member</h3>
          <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
            Creating a member now generates an invite instead of an immediately active account.
          </p>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-[140px_1.2fr_120px_1fr_1fr_auto]">
          <input
            placeholder="Member ID"
            value={newMemberForm.id}
            onChange={(event) => setNewMemberForm((prev) => ({ ...prev, id: event.target.value }))}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            placeholder="Institution name"
            value={newMemberForm.name}
            onChange={(event) => setNewMemberForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Shares"
            value={newMemberForm.shares}
            onChange={(event) => setNewMemberForm((prev) => ({ ...prev, shares: event.target.value }))}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            placeholder="PI name"
            value={newMemberForm.piName}
            onChange={(event) => setNewMemberForm((prev) => ({ ...prev, piName: event.target.value }))}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            type="email"
            placeholder="PI email"
            value={newMemberForm.piEmail}
            onChange={(event) => setNewMemberForm((prev) => ({ ...prev, piEmail: event.target.value }))}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <button
            type="button"
            onClick={addMember}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
            style={{ background: CONCEPT_THEME.navy }}
          >
            Create Invite
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-lg font-bold mb-4" style={{ color: CONCEPT_THEME.navy }}>Testing Accounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-[0.16em]">Role</th>
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-[0.16em]">Member</th>
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-[0.16em]">Username</th>
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-[0.16em]">Password</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                <td className="px-2 py-3 font-semibold" style={{ color: CONCEPT_THEME.navy }}>Admin</td>
                <td className="px-2 py-3">System</td>
                <td className="px-2 py-3 font-mono">{testAccounts.admin.username}</td>
                <td className="px-2 py-3 font-mono">{testAccounts.admin.password}</td>
              </tr>
              {memberLoginAccounts.map(({ member, account }) => (
                <tr key={member.id} className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <td className="px-2 py-3 font-semibold" style={{ color: CONCEPT_THEME.emerald }}>Legacy</td>
                  <td className="px-2 py-3" style={{ color: COLORS[member.id] || CONCEPT_THEME.navy }}>{member.id} - {member.name}</td>
                  <td className="px-2 py-3 font-mono">{account.username}</td>
                  <td className="px-2 py-3 font-mono">{account.password}</td>
                </tr>
              ))}
              {piAccessAccounts.map((account) => (
                <tr key={account.id} className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <td className="px-2 py-3 font-semibold" style={{ color: CONCEPT_THEME.sky }}>PI Access</td>
                  <td className="px-2 py-3" style={{ color: COLORS[account.memberId] || CONCEPT_THEME.navy }}>
                    {account.memberId} - {memberDirectory[account.memberId]?.name || account.memberId}
                  </td>
                  <td className="px-2 py-3 font-mono">{account.username}</td>
                  <td className="px-2 py-3 font-mono">{account.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-lg font-bold mb-4" style={{ color: CONCEPT_THEME.navy }}>Member Preference Notes</h3>
        <div className="space-y-2 text-xs">
          {submittedPreferenceNotes.length === 0 ? (
            <div className="rounded-2xl border px-4 py-4" style={{ background: '#fafafa', borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
              No member notes submitted yet.
            </div>
          ) : null}
          {submittedPreferenceNotes.map((entry) => (
            <div key={`${entry.memberId}-note`} className="rounded-2xl border p-3" style={{ borderColor: CONCEPT_THEME.borderLight }}>
              <div className="font-semibold" style={{ color: COLORS[entry.memberId] || CONCEPT_THEME.navy }}>
                {entry.memberId} - {entry.memberName}
              </div>
              <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                {entry.submitted ? 'Submitted with preferences' : 'Draft note (not submitted yet)'}
              </div>
              <div className="mt-2 whitespace-pre-wrap" style={{ color: CONCEPT_THEME.text }}>{entry.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
