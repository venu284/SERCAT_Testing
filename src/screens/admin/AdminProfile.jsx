import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONCEPT_THEME } from '../../lib/theme';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

const EMPTY_FORM = { name: '', phone: '', roleTitle: '' };

export default function AdminProfile() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeSending, setEmailChangeSending] = useState(false);
  const [emailChangeMsg, setEmailChangeMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      roleTitle: user.roleTitle || '',
    });
  }, [user]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, {
        name: form.name,
        phone: form.phone || null,
        roleTitle: form.roleTitle || null,
      });
      await refreshUser();
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
      name: user?.name || '',
      phone: user?.phone || '',
      roleTitle: user?.roleTitle || '',
    });
    setError('');
    setSuccess('');
  };

  const handleEmailChangeRequest = async (event) => {
    event.preventDefault();
    setEmailChangeSending(true);
    setEmailChangeMsg({ type: '', text: '' });
    try {
      await api.post(`/users/${user.id}/request-email-change`, { email: newEmail });
      setEmailChangeMsg({ type: 'success', text: `Verification link sent to ${newEmail}. Check your inbox.` });
      setNewEmail('');
      setEmailChangeOpen(false);
    } catch (err) {
      setEmailChangeMsg({ type: 'error', text: err.message || 'Unable to send verification email.' });
    } finally {
      setEmailChangeSending(false);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-2xl px-6 py-5" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <h2 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Loading profile...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-4 concept-font-body concept-anim-fade">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="concept-font-display text-xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Admin Profile</h3>
            <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>
              Manage your administrator account details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition-all"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Name', value: user?.name || '—' },
            { label: 'Email', value: user?.email || '—' },
            { label: 'Role', value: 'Administrator' },
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
            { id: 'name', label: 'Name', type: 'text', placeholder: 'Dr. Jane Smith' },
            { id: 'phone', label: 'Phone (Optional)', type: 'text', placeholder: '(555) 555-5555' },
            { id: 'roleTitle', label: 'Role Title (Optional)', type: 'text', placeholder: 'System Administrator' },
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
            <div className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>{user?.email}</div>
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
                placeholder="admin@institution.edu"
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
