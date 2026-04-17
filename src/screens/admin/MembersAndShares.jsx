import React, { useMemo, useState } from 'react';
import { COLORS, CONCEPT_THEME } from '../../lib/theme';
import {
  useDeactivateUser,
  useMasterShares,
  useResendInvite,
  useUpdateShare,
  useUpdateUser,
  useUploadShares,
  useUsers,
} from '../../hooks/useApiData';

function extractRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

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
  const memberLabel = modalState.member?.institutionName || modalState.member?.abbreviation || 'member';
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
  const memberLabel = modalState.member?.institutionName || modalState.member?.abbreviation || 'member';
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

function buildMembers(usersPayload, sharesPayload) {
  const users = extractRows(usersPayload);
  const shares = extractRows(sharesPayload);
  const piUsers = users.filter((user) => user.role === 'pi');

  return piUsers.map((user) => {
    const share = shares.find((row) => row.piId === user.id);
    const totalShares = share
      ? Number(share.wholeShares || 0) + Number(share.fractionalShares || 0)
      : 0;

    let status = 'DEACTIVATED';
    if (user.isActive && user.isActivated) status = 'ACTIVE';
    else if (user.isActive && !user.isActivated) status = 'INVITED';

    return {
      userId: user.id,
      shareId: share?.id || null,
      abbreviation: user.institutionAbbreviation || share?.institutionAbbreviation || '',
      institutionName: user.institutionName || share?.institutionName || '',
      institutionId: user.institutionId || share?.institutionId || null,
      piName: user.name || share?.piName || '',
      piEmail: user.email || share?.piEmail || '',
      totalShares,
      wholeShares: share ? Number(share.wholeShares || 0) : 0,
      fractionalShares: share ? Number(share.fractionalShares || 0) : 0,
      status,
      isActive: Boolean(user.isActive),
      isActivated: Boolean(user.isActivated),
      createdAt: user.createdAt,
      activatedAt: user.isActivated ? user.lastLoginAt : null,
    };
  });
}

export default function MembersAndShares() {
  const usersQuery = useUsers({ all: true });
  const sharesQuery = useMasterShares();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const resendInvite = useResendInvite();
  const updateShare = useUpdateShare();
  const uploadShares = useUploadShares();

  const [notice, setNotice] = useState(null);
  const [memberFormError, setMemberFormError] = useState('');
  const [modalState, setModalState] = useState(null);
  const [memberStatusFilter, setMemberStatusFilter] = useState('all');
  const [newMemberForm, setNewMemberForm] = useState({
    abbreviation: '',
    name: '',
    shares: '',
    piName: '',
    piEmail: '',
  });

  const members = useMemo(
    () => buildMembers(usersQuery.data, sharesQuery.data),
    [usersQuery.data, sharesQuery.data],
  );

  const filteredMembers = useMemo(() => {
    if (memberStatusFilter === 'all') return members;
    if (memberStatusFilter === 'active') return members.filter((member) => member.status === 'ACTIVE');
    if (memberStatusFilter === 'invited') return members.filter((member) => member.status === 'INVITED');
    if (memberStatusFilter === 'deactivated') return members.filter((member) => member.status === 'DEACTIVATED');
    return members;
  }, [memberStatusFilter, members]);

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

  const handleShareChange = async (member, newValue) => {
    if (!member.shareId) return;
    const parsed = parseFloat(newValue);
    if (Number.isNaN(parsed) || parsed < 0) return;

    const wholeShares = Math.floor(parsed);
    const fractionalShares = parsed - wholeShares;

    try {
      await updateShare.mutateAsync({ id: member.shareId, wholeShares, fractionalShares });
    } catch (err) {
      showNotice('error', 'Update failed', err.message || 'Could not update shares.');
    }
  };

  const handleResendInvite = async (member) => {
    setNotice(null);
    try {
      const res = await resendInvite.mutateAsync(member.userId);
      const data = res?.data || {};
      showNotice(
        'success',
        'Invitation refreshed',
        `Invitation refreshed for ${member.piName || member.abbreviation}.`,
        { inviteToken: data.activationToken, email: data.email },
      );
    } catch (err) {
      showNotice('error', 'Unable to refresh invite', err.message || 'Unable to refresh invite.');
    }
  };

  const handleDeactivate = async () => {
    if (!modalState?.member) return;
    try {
      await deactivateUser.mutateAsync(modalState.member.userId);
      closeModal();
      showNotice(
        'success',
        'Member deactivated',
        `${modalState.member.piName || modalState.member.abbreviation} has been deactivated.`,
      );
    } catch (err) {
      setModalState((prev) => (
        prev ? { ...prev, error: err.message || 'Unable to deactivate.' } : prev
      ));
    }
  };

  const handleCancelInvite = async () => {
    if (!modalState?.member) return;
    try {
      await deactivateUser.mutateAsync(modalState.member.userId);
      closeModal();
      showNotice(
        'success',
        'Invitation cancelled',
        `Pending invite cancelled for ${modalState.member.piName || modalState.member.abbreviation}.`,
      );
    } catch (err) {
      setModalState((prev) => (
        prev ? { ...prev, error: err.message || 'Unable to cancel invite.' } : prev
      ));
    }
  };

  const handleChangePi = async () => {
    if (!modalState?.member) return;
    const piName = modalState.piName?.trim();
    const piEmail = modalState.piEmail?.trim();

    if (!piName || !piEmail) {
      setModalState((prev) => (
        prev ? { ...prev, error: 'PI name and email are required.' } : prev
      ));
      return;
    }

    try {
      const res = await updateUser.mutateAsync({
        id: modalState.member.userId,
        name: piName,
        email: piEmail,
        resetActivation: true,
      });
      const data = res?.data || {};
      closeModal();
      showNotice(
        'success',
        'PI change saved',
        `PI change saved for ${modalState.member.abbreviation}.`,
        { inviteToken: data.activationToken, email: piEmail },
      );
    } catch (err) {
      setModalState((prev) => (
        prev ? { ...prev, error: err.message || 'Unable to save PI change.' } : prev
      ));
    }
  };

  const handleReinvite = async () => {
    if (!modalState?.member) return;
    const piName = modalState.piName?.trim();
    const piEmail = modalState.piEmail?.trim();

    if (!piName || !piEmail) {
      setModalState((prev) => (
        prev ? { ...prev, error: 'PI name and email are required.' } : prev
      ));
      return;
    }

    try {
      const res = await updateUser.mutateAsync({
        id: modalState.member.userId,
        name: piName,
        email: piEmail,
        isActive: true,
        resetActivation: true,
      });
      const data = res?.data || {};
      closeModal();
      showNotice(
        'success',
        'Invitation created',
        `Invitation created for ${piName}.`,
        { inviteToken: data.activationToken, email: piEmail },
      );
    } catch (err) {
      setModalState((prev) => (
        prev ? { ...prev, error: err.message || 'Unable to create invite.' } : prev
      ));
    }
  };

  const handleModalSubmit = () => {
    if (!modalState) return;
    if (modalState.type === 'changePi') return handleChangePi();
    if (modalState.type === 'reinvite') return handleReinvite();
    if (modalState.type === 'deactivate') return handleDeactivate();
    if (modalState.type === 'cancelInvite') return handleCancelInvite();
    return null;
  };

  const handleAddMember = async () => {
    setNotice(null);
    setMemberFormError('');

    const { abbreviation, name, shares, piName, piEmail } = newMemberForm;
    if (!abbreviation?.trim() || !name?.trim() || !piName?.trim() || !piEmail?.trim()) {
      setMemberFormError('All fields are required.');
      return;
    }

    const parsedShares = parseFloat(shares);
    if (Number.isNaN(parsedShares) || parsedShares <= 0) {
      setMemberFormError('Shares must be a positive number.');
      return;
    }

    const wholeShares = Math.floor(parsedShares);
    const fractionalShares = parsedShares - wholeShares;

    try {
      const res = await uploadShares.mutateAsync({
        rows: [{
          institutionName: name.trim(),
          abbreviation: abbreviation.trim(),
          piName: piName.trim(),
          piEmail: piEmail.trim(),
          wholeShares,
          fractionalShares,
        }],
      });

      const invite = res?.data?.inviteTokens?.[0] || null;
      setNewMemberForm({
        abbreviation: '',
        name: '',
        shares: '',
        piName: '',
        piEmail: '',
      });

      showNotice(
        'success',
        'Invitation created',
        `Invitation created for ${piName.trim()}.`,
        {
          inviteToken: invite?.token || null,
          email: invite?.email || piEmail.trim(),
        },
      );
    } catch (err) {
      setMemberFormError(err.message || 'Unable to create invite.');
    }
  };

  if (usersQuery.isLoading || sharesQuery.isLoading) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
        Loading members and shares...
      </div>
    );
  }

  if (usersQuery.isError || sharesQuery.isError) {
    return (
      <div
        className="rounded-2xl border px-4 py-4 text-sm"
        style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}
      >
        Failed to load data. Please try refreshing the page.
      </div>
    );
  }

  return (
    <div className="space-y-4 concept-font-body">
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
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
                    No members match the selected filter.
                  </td>
                </tr>
              ) : null}

              {filteredMembers.map((member) => (
                <tr key={member.userId} className="border-b align-top" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <td className="px-2 py-3 font-bold" style={{ color: COLORS[member.abbreviation] || CONCEPT_THEME.navy }}>{member.abbreviation || '-'}</td>
                  <td className="px-2 py-3">
                    <div className="font-semibold" style={{ color: CONCEPT_THEME.text }}>{member.institutionName || '-'}</div>
                    {member.createdAt ? (
                      <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                        Invited {new Date(member.createdAt).toLocaleDateString()}
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
                      value={member.totalShares}
                      onChange={(event) => handleShareChange(member, event.target.value)}
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
            placeholder="Abbreviation"
            value={newMemberForm.abbreviation}
            onChange={(event) => setNewMemberField('abbreviation', event.target.value)}
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
