import React, { useEffect, useState } from 'react';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

const EMPTY_FORM = { piName: '', piEmail: '', piPhone: '', piRole: '' };

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function MemberProfile() {
  const { activeMember, saveMemberProfile, isAdminSession } = useMockApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!activeMember) return;
    setForm({
      piName: activeMember.piName || '',
      piEmail: activeMember.piEmail || '',
      piPhone: activeMember.piPhone || '',
      piRole: activeMember.piRole || '',
    });
    setError('');
    setSuccess('');
  }, [activeMember]);

  if (!activeMember) return null;

  const handleSave = (event) => {
    event.preventDefault();
    const result = saveMemberProfile(activeMember.id, form);
    if (!result?.ok) {
      setError(result?.error || 'Unable to save profile changes.');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('Profile updated successfully.');
  };

  const handleCancel = () => {
    setForm({
      piName: activeMember.piName || '',
      piEmail: activeMember.piEmail || '',
      piPhone: activeMember.piPhone || '',
      piRole: activeMember.piRole || '',
    });
    setError('');
    setSuccess('');
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
            { id: 'piEmail', label: 'PI Email', type: 'email', placeholder: 'pi@institution.edu' },
            { id: 'piPhone', label: 'Phone', type: 'text', placeholder: '(555) 555-5555' },
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
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
