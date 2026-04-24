import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CONCEPT_THEME } from '../../lib/theme';

function SuccessIcon() {
  return (
    <div
      className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4"
      style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}30` }}
    >
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.emerald} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
  );
}

export default function ForgotPasswordScreen({ cycle }) {
  const navigate = useNavigate();
  const { requestReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email address.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await requestReset(normalizedEmail);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Unable to send a reset link right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="app-screen px-4 py-6 sm:px-6 sm:py-10 concept-font-body"
      style={{ background: `radial-gradient(circle at top, #ffffff 0%, ${CONCEPT_THEME.cream} 56%, ${CONCEPT_THEME.sand} 100%)` }}
    >
      <div className="app-screen-content mx-auto flex w-full max-w-2xl items-center justify-center concept-anim-fade">
        <div
          className="w-full overflow-hidden rounded-[32px] border bg-white px-5 py-10 shadow-[0_30px_90px_rgba(27,46,74,0.12)] sm:px-8 lg:px-10"
          style={{ borderColor: CONCEPT_THEME.borderLight }}
        >
          <div className="mx-auto w-full max-w-md">
            {sent ? (
              <div className="text-center">
                <SuccessIcon />
                <p className="mt-6 text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.emerald }}>Account Recovery</p>
                <h1 className="concept-font-display mt-3 text-4xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Check Your Email</h1>
                <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                  If that email is registered with SERCAT, a password reset link has been sent. Check your inbox and spam folder.
                </p>

                <div
                  className="mt-6 rounded-[28px] border px-5 py-5 text-left"
                  style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                    Reset Window
                  </div>
                  <div className="mt-2 text-sm leading-6" style={{ color: CONCEPT_THEME.navy }}>
                    The reset link expires in 1 hour.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="mt-8 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                  style={{ background: CONCEPT_THEME.navy }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.navy }}>
                    <span className="concept-font-display text-lg font-bold">SERCAT</span>
                    <span className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: CONCEPT_THEME.accentOnAccent }}>
                      Password Reset
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.accentText }}>Account Recovery</p>
                  <h1 className="concept-font-display mt-3 text-4xl font-bold leading-tight" style={{ color: CONCEPT_THEME.navy }}>
                    Reset your password
                  </h1>
                  <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                    Enter the email address associated with your SERCAT account and we&apos;ll send you a secure reset link.
                  </p>
                  {cycle?.id ? (
                    <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.subtle }}>
                      Current cycle: {cycle.id}
                    </p>
                  ) : null}
                </div>

                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                      Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                      placeholder="pi@institution.edu"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ background: CONCEPT_THEME.navy }}
                  >
                    Send Reset Link
                  </button>
                </form>

                <div className="mt-6 text-sm" style={{ color: CONCEPT_THEME.muted }}>
                  Remembered it?{' '}
                  <button type="button" onClick={() => navigate('/login')} className="font-semibold" style={{ color: CONCEPT_THEME.sky }}>
                    Back to Sign In
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
