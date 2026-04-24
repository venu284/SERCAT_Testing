import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

function ErrorIcon() {
  return (
    <div
      className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4"
      style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}30` }}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.error} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    </div>
  );
}

export default function ResetPasswordScreen({ cycle }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const token = searchParams.get('token')?.trim() || '';
  const missingToken = !token;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await setNewPassword(token, password, confirmPassword);
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err?.code === 'INVALID_TOKEN') {
        setError('This reset link has expired or already been used. Please request a new one.');
      } else {
        setError(err?.message || 'Unable to reset your password.');
      }
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
            {missingToken ? (
              <div className="text-center">
                <ErrorIcon />
                <p className="mt-6 text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.error }}>Reset Error</p>
                <h1 className="concept-font-display mt-3 text-4xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Invalid Reset Link</h1>
                <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                  This password reset link is missing the token needed to continue. Request a new reset link to try again.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="mt-8 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                  style={{ background: CONCEPT_THEME.navy }}
                >
                  Request New Reset Link
                </button>
              </div>
            ) : success ? (
              <div className="text-center">
                <SuccessIcon />
                <p className="mt-6 text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.emerald }}>Security Updated</p>
                <h1 className="concept-font-display mt-3 text-4xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Password Updated</h1>
                <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                  Your password has been reset successfully. You can now sign in with your new password.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="mt-8 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                  style={{ background: CONCEPT_THEME.navy }}
                >
                  Sign In Now
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
                  <p className="text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.accentText }}>Set New Password</p>
                  <h1 className="concept-font-display mt-3 text-4xl font-bold leading-tight" style={{ color: CONCEPT_THEME.navy }}>
                    Choose a new password
                  </h1>
                  <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                    Enter your new password below to regain access to your SERCAT account.
                  </p>
                  {cycle?.id ? (
                    <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.subtle }}>
                      Current cycle: {cycle.id}
                    </p>
                  ) : null}
                </div>

                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="reset-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                      New Password
                    </label>
                    <input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                      placeholder="Enter a new password"
                    />
                    <p className="mt-2 text-xs leading-5" style={{ color: CONCEPT_THEME.subtle }}>
                      At least 8 characters, including uppercase, lowercase, number, and special character.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="reset-confirm-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                      Confirm Password
                    </label>
                    <input
                      id="reset-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                      placeholder="Re-enter your new password"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
                      <div>{error}</div>
                      {error.includes('expired or already been used') ? (
                        <button
                          type="button"
                          onClick={() => navigate('/forgot-password')}
                          className="mt-3 font-semibold"
                          style={{ color: CONCEPT_THEME.sky }}
                        >
                          Request New Reset Link
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ background: CONCEPT_THEME.navy }}
                  >
                    Reset Password
                  </button>
                </form>

                <div className="mt-6 text-sm" style={{ color: CONCEPT_THEME.muted }}>
                  Back to{' '}
                  <button type="button" onClick={() => navigate('/login')} className="font-semibold" style={{ color: CONCEPT_THEME.sky }}>
                    Sign In
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
