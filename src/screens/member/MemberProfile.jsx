import React, { useEffect, useMemo, useState } from 'react';
import { CONCEPT_THEME } from '../../lib/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useMasterShares } from '../../hooks/useApiData';
import { api, extractRows } from '../../lib/api';

const EMPTY_FORM = { piName: '', piPhone: '', piRole: '' };

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function StatusCard({ title, detail }) {
  return (
    <div
      className="rounded-2xl px-6 py-5 concept-font-body concept-anim-fade"
      style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}
    >
      <h2 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>{title}</h2>
      <p className="mt-2 text-base" style={{ color: CONCEPT_THEME.muted }}>{detail}</p>
    </div>
  );
}

export default function MemberProfile() {
  const { user, loading: authLoading } = useAuth();
  const sharesQuery = useMasterShares();
  const [profileIdentity, setProfileIdentity] = useState({ name: '', email: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeSending, setEmailChangeSending] = useState(false);
  const [emailChangeMsg, setEmailChangeMsg] = useState({ type: '', text: '' });
  const isAdminSession = user?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    setProfileIdentity({
      name: user.name || '',
      email: user.email || '',
    });
  }, [user]);

  const activeMember = useMemo(() => {
    if (!user) return null;

    const shares = extractRows(sharesQuery.data);
    const myShare = shares.find((share) => share.piId === user.id);

    if (!myShare && !isAdminSession) {
      return null;
    }

    return {
      id: myShare?.institutionAbbreviation || user.institutionAbbreviation || 'PI',
      name: myShare?.institutionName || user.institutionName || profileIdentity.name || 'Member',
      shares: Number(myShare?.wholeShares || 0) + Number(myShare?.fractionalShares || 0),
      status: user.isActive === false ? 'DEACTIVATED' : 'ACTIVE',
      piName: profileIdentity.name || '',
      piEmail: profileIdentity.email || '',
      piPhone: user.phone || '',
      piRole: user.roleTitle || '',
      _userId: user.id,
    };
  }, [isAdminSession, profileIdentity.email, profileIdentity.name, sharesQuery.data, user]);

  useEffect(() => {
    if (!activeMember) return;
    setForm({
      piName: activeMember.piName || '',
      piPhone: activeMember.piPhone || '',
      piRole: activeMember.piRole || '',
    });
    setError('');
    setSuccess('');
  }, [activeMember]);

  if (authLoading || sharesQuery.isLoading) {
    return (
      <StatusCard
        title="Loading member profile..."
        detail="Fetching your institution record and PI contact details."
      />
    );
  }

  if (sharesQuery.error) {
    return (
      <StatusCard
        title="Unable to load member profile"
        detail={sharesQuery.error?.message || 'Please try again in a moment.'}
      />
    );
  }

  if (!activeMember) {
    return (
      <StatusCard
        title="Member profile unavailable"
        detail="Your member record is not available yet."
      />
    );
  }

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.put(`/users/${activeMember._userId}`, {
        name: form.piName,
        phone: form.piPhone || null,
        roleTitle: form.piRole || null,
      });
      const updated = response?.data || {};
      const nextName = updated.name || form.piName;
      const nextPhone = updated.phone ?? form.piPhone;
      const nextRole = updated.roleTitle ?? form.piRole;

      setProfileIdentity((prev) => ({ ...prev, name: nextName }));
      setForm({
        piName: nextName,
        piPhone: nextPhone || '',
        piRole: nextRole || '',
      });
      setError('');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Unable to save profile changes.');
      setSuccess('');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      piName: activeMember.piName || '',
      piPhone: activeMember.piPhone || '',
      piRole: activeMember.piRole || '',
    });
    setError('');
    setSuccess('');
  };

  const handleEmailChangeRequest = async (event) => {
    event.preventDefault();
    setEmailChangeSending(true);
    setEmailChangeMsg({ type: '', text: '' });
    try {
      await api.post(`/users/${activeMember._userId}/request-email-change`, { email: newEmail });
      setEmailChangeMsg({ type: 'success', text: `Verification link sent to ${newEmail}. Check your inbox.` });
      setNewEmail('');
      setEmailChangeOpen(false);
    } catch (err) {
      setEmailChangeMsg({ type: 'error', text: err.message || 'Unable to send verification email.' });
    } finally {
      setEmailChangeSending(false);
    }
  };

  return (
    <div className="space-y-4 concept-font-body concept-anim-fade">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="concept-font-display text-xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Profile</h3>
            <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>
              Review your institution details and keep your PI contact information up to date.
            </p>
          </div>
          {isAdminSession ? (
            <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky }}>
              Admin preview
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Institution', value: activeMember.name || activeMember.id },
            { label: 'Member ID', value: activeMember.id },
            { label: 'Shares', value: activeMember.shares?.toFixed?.(2) || String(activeMember.shares || 0) },
            { label: 'Status', value: formatStatus(activeMember.status) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl px-4 py-3" style={{ background: CONCEPT_THEME.sand }}>
              <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>{item.label}</div>
              <div className="mt-2 text-base font-semibold" style={{ color: CONCEPT_THEME.text }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <form className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }} onSubmit={handleSave}>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { id: 'piName', label: 'PI Name', type: 'text', placeholder: 'Dr. Jane Smith' },
            { id: 'piPhone', label: 'Phone (Optional)', type: 'text', placeholder: '(555) 555-5555' },
            { id: 'piRole', label: 'Role', type: 'text', placeholder: 'Principal Investigator' },
          ].map((field) => (
            <label key={field.id} className="block">
              <span className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>{field.label}</span>
              <input
                type={field.type}
                value={form[field.id]}
                onChange={(event) => setForm((prev) => ({ ...prev, [field.id]: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                placeholder={field.placeholder}
              />
            </label>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
            {success}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: CONCEPT_THEME.navy, color: 'white' }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>Email Address</div>
            <div className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>{profileIdentity.email}</div>
          </div>
          {!emailChangeOpen ? (
            <button
              type="button"
              onClick={() => { setEmailChangeOpen(true); setEmailChangeMsg({ type: '', text: '' }); }}
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            >
              Change Email
            </button>
          ) : null}
        </div>

        {emailChangeMsg.text && !emailChangeOpen ? (
          <div
            className="mt-3 rounded-xl border px-3 py-2 text-sm"
            style={
              emailChangeMsg.type === 'success'
                ? { background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }
                : { background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }
            }
          >
            {emailChangeMsg.text}
          </div>
        ) : null}

        {emailChangeOpen ? (
          <form
            onSubmit={handleEmailChangeRequest}
            className="mt-4 border-t pt-4"
            style={{ borderColor: CONCEPT_THEME.borderLight }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>New Email Address</span>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                placeholder="new@institution.edu"
                required
              />
            </label>

            {emailChangeMsg.type === 'error' ? (
              <div className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
                {emailChangeMsg.text}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{ background: CONCEPT_THEME.navy, color: 'white' }}
                disabled={emailChangeSending}
              >
                {emailChangeSending ? 'Sending...' : 'Send Verification Email'}
              </button>
              <button
                type="button"
                onClick={() => { setEmailChangeOpen(false); setNewEmail(''); setEmailChangeMsg({ type: '', text: '' }); }}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
                disabled={emailChangeSending}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
