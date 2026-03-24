import React, { useMemo } from 'react';
import { normalizeEmail } from '../../lib/auth';
import { CONCEPT_THEME } from '../../lib/theme';

export default function LoginScreen({
  loginForm,
  setLoginForm,
  loginError,
  handleSignIn,
  handleResetDemoData,
  onShowActivate,
  members = [],
  cycle,
}) {
  const invitedMember = useMemo(() => {
    const loginKey = normalizeEmail(loginForm.username);
    if (!loginKey) return null;
    return members.find((member) => normalizeEmail(member.piEmail) === loginKey && member.status === 'INVITED') || null;
  }, [loginForm.username, members]);

  return (
    <div
      className="app-screen px-4 py-6 sm:px-6 sm:py-10 concept-font-body"
      style={{ background: `radial-gradient(circle at top, #ffffff 0%, ${CONCEPT_THEME.cream} 52%, #f3efe7 100%)` }}
    >
      <div className="app-screen-content mx-auto flex w-full max-w-2xl items-center justify-center concept-anim-fade">
        <div
          className="w-full overflow-hidden rounded-[32px] border bg-white px-5 py-10 shadow-[0_30px_90px_rgba(27,46,74,0.12)] sm:px-8 lg:px-10"
          style={{ borderColor: CONCEPT_THEME.borderLight }}
        >
          <div className="mx-auto w-full max-w-md">
            <div>
              <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.navy }}>
                <span className="concept-font-display text-lg font-bold">SERCAT</span>
                <span className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: CONCEPT_THEME.amberOnAmber }}>Cycle {cycle?.id || '2026-1'}</span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.amberText }}>Member Sign In</p>
              <h1 className="concept-font-display mt-3 text-4xl font-bold leading-tight" style={{ color: CONCEPT_THEME.navy }}>Welcome back</h1>
              <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                Sign in with your institutional email and password to continue to the SERCAT portal.
              </p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                  Email Address
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginForm.username}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                  className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: CONCEPT_THEME.sand,
                    borderColor: CONCEPT_THEME.border,
                    color: CONCEPT_THEME.text,
                  }}
                  placeholder="pi@institution.edu"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                    Password
                  </label>
                  <a
                    href="mailto:admin@ser-cat.org?subject=SERCAT%20Password%20Help"
                    className="text-xs font-semibold"
                    style={{ color: CONCEPT_THEME.sky }}
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: CONCEPT_THEME.sand,
                    borderColor: CONCEPT_THEME.border,
                    color: CONCEPT_THEME.text,
                  }}
                  placeholder="Enter your password"
                />
              </div>

              {invitedMember ? (
                <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.amberLight, borderColor: `${CONCEPT_THEME.amber}44`, color: CONCEPT_THEME.navy }}>
                  {invitedMember.name} is still pending activation. Use the activation link from your invite email before signing in.
                </div>
              ) : null}

              {loginError ? (
                <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: '#fff1f1', borderColor: '#fecaca', color: '#b91c1c' }}>
                  {loginError}
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                style={{ background: CONCEPT_THEME.navy }}
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 rounded-[28px] border px-5 py-5" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
              <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: CONCEPT_THEME.navyMuted }}>Need access?</div>
              <p className="mt-2 text-sm leading-6" style={{ color: CONCEPT_THEME.navy }}>
                SERCAT accounts are created by the administrator. Contact{' '}
                <a className="font-semibold" href="mailto:admin@ser-cat.org" style={{ color: CONCEPT_THEME.amberText }}>
                  admin@ser-cat.org
                </a>{' '}
                to request an account.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-start gap-3">
              <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
                Received an invitation?
              </div>
              <button
                type="button"
                onClick={onShowActivate}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
                style={{ background: `${CONCEPT_THEME.navy}10`, color: CONCEPT_THEME.navy }}
              >
                Activate your account
              </button>
            </div>

            <div className="mt-8 border-t pt-5" style={{ borderColor: CONCEPT_THEME.borderLight }}>
              <button
                type="button"
                onClick={handleResetDemoData}
                className="w-full rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-[0.22em]"
                style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}
              >
                Reset Demo Data
              </button>
              <p className="mt-2 text-center text-[11px] leading-5" style={{ color: CONCEPT_THEME.muted }}>
                Restores the local prototype baseline so invite, activation, and member access can be tested from a clean state.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
