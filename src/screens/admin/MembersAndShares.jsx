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
      color: CONCEPT_THEME.accentOnAccent,
    },
    DEACTIVATED: {
      label: 'Deactivated',
      background: CONCEPT_THEME.sand,
      color: CONCEPT_THEME.muted,
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
          onClick={() => onChangePi(member)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: `${CONCEPT_THEME.sky}16`, color: CONCEPT_THEME.sky }}
        >
          Change PI
        </button>
        <button
          type="button"
          onClick={() => onDeactivate(member)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}
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
          onClick={() => onResendInvite(member)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: `${CONCEPT_THEME.amber}14`, color: CONCEPT_THEME.accentText }}
        >
          Re-send Invite
        </button>
        <button
          type="button"
          onClick={() => onCancelInvite(member)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onReinvite(member)}
      className="rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ background: `${CONCEPT_THEME.navy}12`, color: CONCEPT_THEME.navy }}
    >
      Re-invite
    </button>
  );
}

function NoticeBanner({ notice, onDismiss }) {
  if (!notice) return null;

  const tones = {
    success: {
      background: CONCEPT_THEME.emeraldLight,
      borderColor: `${CONCEPT_THEME.emerald}33`,
      color: CONCEPT_THEME.emerald,
    },
    error: {
      background: CONCEPT_THEME.errorLight,
      borderColor: `${CONCEPT_THEME.error}33`,
      color: CONCEPT_THEME.error,
    },
    info: {
      background: CONCEPT_THEME.skyLight,
      borderColor: `${CONCEPT_THEME.sky}33`,
      color: CONCEPT_THEME.sky,
    },
  };
  const tone = tones[notice.tone] || tones.info;

  return (
    <div className="rounded-2xl border px-4 py-4 shadow-sm" style={{ background: tone.background, borderColor: tone.borderColor }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold" style={{ color: tone.color }}>{notice.title}</div>
          <div className="mt-1 text-sm" style={{ color: CONCEPT_THEME.text }}>{notice.message}</div>
          {notice.inviteToken ? (
            <div className="mt-3 rounded-xl border px-3 py-2" style={{ background: 'rgba(255,255,255,0.72)', borderColor: tone.borderColor }}>
              <div className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: tone.color }}>Activation Token</div>
              <div className="mt-1 font-mono text-sm" style={{ color: CONCEPT_THEME.text }}>{notice.inviteToken}</div>
              {notice.email ? (
                <div className="mt-2 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                  In production, an email would be sent to {notice.email}.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,0.72)', color: tone.color }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ModalFrame({ title, children, onClose, actions }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,42,74,0.42)] p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl border bg-white p-5 shadow-2xl"
        style={{ borderColor: CONCEPT_THEME.borderLight }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>{title}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">{children}</div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

function PiDetailsModal({ modalState, onClose, onChange, onSubmit }) {
  if (!modalState) return null;
  const memberLabel = modalState.member?.name || modalState.member?.id || 'member';
  const isChange = modalState.type === 'changePi';

  return (
    <ModalFrame
      title={isChange ? `Change PI for ${memberLabel}` : `Re-invite ${memberLabel}`}
      onClose={onClose}
      actions={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: CONCEPT_THEME.navy, color: 'white' }}
          >
            {isChange ? 'Save PI Change' : 'Create Invite'}
          </button>
        </>
      )}
    >
      <p className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
        {isChange
          ? 'Update the PI contact details, then generate a fresh activation invite for the new PI.'
          : 'Enter the PI contact details to generate a fresh activation invite for this institution.'}
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>PI Name</span>
        <input
          type="text"
          value={modalState.piName || ''}
          onChange={(event) => onChange('piName', event.target.value)}
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
          placeholder="Principal investigator name"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>PI Email</span>
        <input
          type="email"
          value={modalState.piEmail || ''}
          onChange={(event) => onChange('piEmail', event.target.value)}
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
          placeholder="pi@institution.edu"
        />
      </label>

      {modalState.error ? (
        <div className="rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
          {modalState.error}
        </div>
      ) : null}
    </ModalFrame>
  );
}

function ConfirmActionModal({ modalState, onClose, onSubmit }) {
  if (!modalState) return null;
  const memberLabel = modalState.member?.name || modalState.member?.id || 'member';
  const isDeactivate = modalState.type === 'deactivate';
  const title = isDeactivate ? `Deactivate ${memberLabel}?` : `Cancel invite for ${memberLabel}?`;
  const description = isDeactivate
    ? 'This will disable member sign-in until the institution is re-invited.'
    : 'This will remove the pending invite and mark the institution as deactivated.';

  return (
    <ModalFrame
      title={title}
      onClose={onClose}
      actions={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
          >
            Keep Current State
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: isDeactivate ? CONCEPT_THEME.error : CONCEPT_THEME.text, color: 'white' }}
          >
            {isDeactivate ? 'Deactivate Member' : 'Cancel Invite'}
          </button>
        </>
      )}
    >
      <p className="text-sm" style={{ color: CONCEPT_THEME.muted }}>{description}</p>
      {modalState.error ? (
        <div className="rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
          {modalState.error}
        </div>
      ) : null}
    </ModalFrame>
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
    resendMemberInvite,
    cancelMemberInvite,
    deactivateMember,
    changeMemberPi,
    reinviteMember,
  } = useMockApp();

  const [notice, setNotice] = React.useState(null);
  const [memberFormError, setMemberFormError] = React.useState('');
  const [modalState, setModalState] = React.useState(null);

  const showLegacyRequests = pendingRegistrationCount > 0 || resolvedRegistrationRequests.length > 0;

  const setNewMemberField = (field, value) => {
    setNewMemberForm((prev) => ({ ...prev, [field]: value }));
    if (memberFormError) setMemberFormError('');
  };

  const showNotice = (tone, title, message, extra = {}) => {
    setNotice({ tone, title, message, ...extra });
  };

  const openPiModal = (type, member) => {
    setNotice(null);
    setModalState({
      type,
      member,
      piName: member.piName || '',
      piEmail: member.piEmail || '',
      error: '',
    });
  };

  const openConfirmModal = (type, member) => {
    setNotice(null);
    setModalState({
      type,
      member,
      error: '',
    });
  };

  const closeModal = () => {
    setModalState(null);
  };

  const updateModalField = (field, value) => {
    setModalState((prev) => (
      prev
        ? {
          ...prev,
          [field]: value,
          error: '',
        }
        : prev
    ));
  };

  const handleResendInvite = (member) => {
    setNotice(null);
    const result = resendMemberInvite(member.id);
    if (!result?.ok) {
      showNotice('error', 'Unable to refresh invite', result?.error || 'Unable to refresh invite.');
      return;
    }
    showNotice(
      'success',
      'Invitation refreshed',
      `Invitation refreshed for ${result.piName || member.piName || member.id}.`,
      { inviteToken: result.inviteToken, email: result.piEmail },
    );
  };

  const handleModalSubmit = () => {
    if (!modalState?.member) return;

    const memberLabel = modalState.member.name || modalState.member.id;
    let result;
    let nextNotice = null;

    if (modalState.type === 'changePi') {
      result = changeMemberPi(modalState.member.id, {
        piName: modalState.piName,
        piEmail: modalState.piEmail,
      });
      if (result?.ok) {
        nextNotice = {
          tone: 'success',
          title: 'PI change saved',
          message: `PI change saved for ${memberLabel}.`,
          inviteToken: result.inviteToken,
          email: result.piEmail,
        };
      }
    } else if (modalState.type === 'reinvite') {
      result = reinviteMember(modalState.member.id, {
        piName: modalState.piName,
        piEmail: modalState.piEmail,
      });
      if (result?.ok) {
        nextNotice = {
          tone: 'success',
          title: 'Invitation created',
          message: `Invitation created for ${result.piName || memberLabel}.`,
          inviteToken: result.inviteToken,
          email: result.piEmail,
        };
      }
    } else if (modalState.type === 'cancelInvite') {
      result = cancelMemberInvite(modalState.member.id);
      if (result?.ok) {
        nextNotice = {
          tone: 'success',
          title: 'Invitation cancelled',
          message: `Pending invite cancelled for ${memberLabel}.`,
        };
      }
    } else if (modalState.type === 'deactivate') {
      result = deactivateMember(modalState.member.id);
      if (result?.ok) {
        nextNotice = {
          tone: 'success',
          title: 'Member deactivated',
          message: `${memberLabel} has been deactivated.`,
        };
      }
    }

    if (!result?.ok) {
      setModalState((prev) => (
        prev
          ? {
            ...prev,
            error: result?.error || 'Unable to complete this action.',
          }
          : prev
      ));
      return;
    }

    closeModal();
    setNotice(nextNotice);
  };

  const handleAddMember = () => {
    setNotice(null);
    const result = addMember();
    if (!result?.ok) {
      setMemberFormError(result?.error || 'Unable to create invite.');
      return;
    }

    setMemberFormError('');
    showNotice(
      'success',
      'Invitation created',
      `Invitation created for ${result.piName}.`,
      { inviteToken: result.inviteToken, email: result.piEmail },
    );
  };

  return (
    <div className="space-y-4 concept-font-body">
      {showLegacyRequests ? (
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Legacy Registration Requests</h3>
              <p className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                Historical self-registration requests remain available here for reference and cleanup.
              </p>
            </div>
            <span
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em]"
              style={{
                background: pendingRegistrationCount > 0 ? CONCEPT_THEME.amberLight : CONCEPT_THEME.sand,
                color: pendingRegistrationCount > 0 ? CONCEPT_THEME.accentOnAccent : CONCEPT_THEME.muted,
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
                      <div className="mt-2 rounded-xl border px-3 py-2 text-xs" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
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
                        style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border px-4 py-4 text-sm" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
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
                    <div key={request.id} className="rounded-2xl border px-4 py-3 text-xs" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.borderLight }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" style={{ color: CONCEPT_THEME.navy }}>{institutionDisplayName} ({request.institutionMemberId})</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
                          style={{
                            background: request.status === 'Approved' ? CONCEPT_THEME.emeraldLight : CONCEPT_THEME.errorLight,
                            color: request.status === 'Approved' ? CONCEPT_THEME.emerald : CONCEPT_THEME.error,
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

      {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Members & Shares</h3>
            <p className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
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
                      onDeactivate={(nextMember) => openConfirmModal('deactivate', nextMember)}
                      onChangePi={(nextMember) => openPiModal('changePi', nextMember)}
                      onResendInvite={handleResendInvite}
                      onCancelInvite={(nextMember) => openConfirmModal('cancelInvite', nextMember)}
                      onReinvite={(nextMember) => openPiModal('reinvite', nextMember)}
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
          <p className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
            Creating a member now generates an invite instead of an immediately active account.
          </p>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-[140px_1.2fr_120px_1fr_1fr_auto]">
          <input
            placeholder="Member ID"
            value={newMemberForm.id}
            onChange={(event) => setNewMemberField('id', event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            placeholder="Institution name"
            value={newMemberForm.name}
            onChange={(event) => setNewMemberField('name', event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Shares"
            value={newMemberForm.shares}
            onChange={(event) => setNewMemberField('shares', event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            placeholder="PI name"
            value={newMemberForm.piName}
            onChange={(event) => setNewMemberField('piName', event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <input
            type="email"
            placeholder="PI email"
            value={newMemberForm.piEmail}
            onChange={(event) => setNewMemberField('piEmail', event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}
          />
          <button
            type="button"
            onClick={handleAddMember}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
            style={{ background: CONCEPT_THEME.navy }}
          >
            Create Invite
          </button>
        </div>

        {memberFormError ? (
          <div className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
            {memberFormError}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display mb-4 text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Testing Accounts</h3>
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

      {modalState?.type === 'changePi' || modalState?.type === 'reinvite' ? (
        <PiDetailsModal
          modalState={modalState}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={handleModalSubmit}
        />
      ) : null}

      {modalState?.type === 'cancelInvite' || modalState?.type === 'deactivate' ? (
        <ConfirmActionModal
          modalState={modalState}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
        />
      ) : null}
    </div>
  );
}
