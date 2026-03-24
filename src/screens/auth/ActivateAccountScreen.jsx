import React, { useMemo } from 'react';
import { CONCEPT_THEME } from '../../lib/theme';

function BrandingPanel({ cycleId = '2026-1' }) {
  return (
    <div
      className="hidden lg:flex flex-col justify-between p-10 xl:p-12"
      style={{
        background: `linear-gradient(160deg, ${CONCEPT_THEME.navy} 0%, ${CONCEPT_THEME.navyLight} 58%, #3d5c82 100%)`,
        color: 'white',
      }}
    >
      <div>
        <div className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 12l10 5 10-5" />
              <path d="M2 17l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="concept-font-display text-xl font-bold tracking-tight">SERCAT</div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/80">Invite Activation</div>
          </div>
        </div>

        <div className="mt-14 max-w-md">
          <p className="text-sm uppercase tracking-[0.3em] text-white/75">Secure Access</p>
          <h1 className="concept-font-display mt-4 text-5xl leading-[1.04] font-bold">Complete your PI access.</h1>
          <p className="mt-5 text-base leading-7 text-white/82">
            Your institution administrator created the account. Activation only requires the invite token and your new password.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/10 px-5 py-5">
        <div className="text-xs uppercase tracking-[0.24em] text-white/75">Cycle Ready</div>
        <div className="mt-2 text-lg font-semibold text-white">Cycle {cycleId}</div>
        <div className="mt-2 text-sm leading-6 text-white/82">
          Once activated, you can sign in, review your dashboard, and submit scheduling preferences for the current run cycle.
        </div>
      </div>
    </div>
  );
}

function ReadOnlyInvitationCard({ member }) {
  return (
    <div className="rounded-[28px] border px-5 py-5" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
      <div className="grid gap-3 text-sm" style={{ color: CONCEPT_THEME.text }}>
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.amberOnAmber }}>ORG</span>
          <div>
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Institution</div>
            <div className="font-semibold">{member.name || member.id} ({member.id})</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky }}>PI</span>
          <div>
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Principal Investigator</div>
            <div className="font-semibold">{member.piName || member.id}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }}>ID</span>
          <div>
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Email</div>
            <div className="font-semibold">{member.piEmail}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: `${CONCEPT_THEME.navy}12`, color: CONCEPT_THEME.navy }}>ADM</span>
          <div>
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Access</div>
            <div className="font-semibold">Set by admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivateAccountScreen({
  authScreen,
  activateToken,
  setActivateToken,
  activateForm,
  setActivateForm,
  handleActivate,
  loginError,
  members,
  onActivated,
  onBackToLogin,
  cycle,
  activationSummary,
}) {
  const trimmedToken = activateToken.trim();
  const invitedMember = useMemo(
    () => members.find((member) => member.inviteToken === trimmedToken && member.status === 'INVITED') || null,
    [members, trimmedToken],
  );

  if (authScreen === 'activateSuccess') {
    const summary = activationSummary || {};
    return (
      <div
        className="app-screen px-4 py-6 sm:px-6 sm:py-10 concept-font-body"
        style={{ background: `radial-gradient(circle at top, #ffffff 0%, ${CONCEPT_THEME.cream} 52%, #f3efe7 100%)` }}
      >
        <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[32px] border bg-white shadow-[0_30px_90px_rgba(27,46,74,0.12)] lg:grid-cols-[1.08fr_0.92fr] concept-anim-fade" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <BrandingPanel cycleId={cycle?.id} />

          <div className="app-screen-content flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
            <div className="w-full max-w-md text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 concept-anim-pulse" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}30` }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.emerald} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="mt-6 text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.emerald }}>Activation Complete</p>
              <h1 className="concept-font-display mt-3 text-4xl font-bold" style={{ color: CONCEPT_THEME.navy }}>You're All Set!</h1>
              <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                Your SERCAT access has been activated and your institution can now sign in with the email address on file.
              </p>

              <div className="mt-6 rounded-[28px] border px-5 py-5 text-left" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
                <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Activated Account</div>
                <div className="mt-2 text-lg font-semibold" style={{ color: CONCEPT_THEME.navy }}>{summary.memberName || summary.memberId || 'Member account'}</div>
                <div className="mt-1 text-sm" style={{ color: CONCEPT_THEME.text }}>{summary.piName || 'Principal Investigator'}</div>
                <div className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>{summary.piEmail || ''}</div>
              </div>

              <div className="mt-6 rounded-[28px] border px-5 py-5 text-left" style={{ background: CONCEPT_THEME.amberLight, borderColor: `${CONCEPT_THEME.amber}30` }}>
                <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.amberOnAmber }}>What's next?</div>
                <ol className="mt-3 space-y-2 text-sm leading-6" style={{ color: CONCEPT_THEME.navy }}>
                  <li>1. Sign in with your institutional email and new password.</li>
                  <li>2. Review your dashboard and cycle status.</li>
                  <li>3. Submit scheduling preferences before the deadline.</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => onActivated(summary.piEmail || '')}
                className="mt-8 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                style={{ background: CONCEPT_THEME.navy }}
              >
                Sign In Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-screen px-4 py-6 sm:px-6 sm:py-10 concept-font-body"
      style={{ background: `radial-gradient(circle at top, #ffffff 0%, ${CONCEPT_THEME.cream} 52%, #f3efe7 100%)` }}
    >
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[32px] border bg-white shadow-[0_30px_90px_rgba(27,46,74,0.12)] lg:grid-cols-[1.08fr_0.92fr] concept-anim-fade" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <BrandingPanel cycleId={cycle?.id} />

        <div className="app-screen-content flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div>
              <p className="text-sm uppercase tracking-[0.24em]" style={{ color: invitedMember ? CONCEPT_THEME.emerald : CONCEPT_THEME.amberText }}>
                {invitedMember ? 'Valid Invitation' : 'Activate Access'}
              </p>
              <h1 className="concept-font-display mt-3 text-4xl font-bold leading-tight" style={{ color: CONCEPT_THEME.navy }}>
                Complete Your Account
              </h1>
              <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                Paste the activation token from your invite email to load your institution details, then choose your password.
              </p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleActivate}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                  Activation Token
                </label>
                <input
                  type="text"
                  value={activateToken}
                  onChange={(event) => setActivateToken(event.target.value)}
                  className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: CONCEPT_THEME.sand,
                    borderColor: invitedMember ? `${CONCEPT_THEME.emerald}55` : CONCEPT_THEME.border,
                    color: CONCEPT_THEME.text,
                  }}
                  placeholder="Paste the invite token"
                />
              </div>

              {loginError ? (
                <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: '#fff1f1', borderColor: '#fecaca', color: '#b91c1c' }}>
                  {loginError}
                </div>
              ) : null}

              {invitedMember ? (
                <>
                  <ReadOnlyInvitationCard member={invitedMember} />

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                      Set Password
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={activateForm.password}
                      onChange={(event) => setActivateForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                      placeholder="At least 8 characters"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={activateForm.confirmPassword}
                      onChange={(event) => setActivateForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                      placeholder="Re-enter your password"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={activateForm.phone}
                      onChange={(event) => setActivateForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2"
                      style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
                      placeholder="Office or mobile number"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                    style={{ background: CONCEPT_THEME.navy }}
                  >
                    Activate Account
                  </button>
                </>
              ) : (
                <div className="rounded-[28px] border px-5 py-5" style={{ background: CONCEPT_THEME.amberLight, borderColor: `${CONCEPT_THEME.amber}30` }}>
                  <div className="text-xs uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.amberOnAmber }}>Before you continue</div>
                  <p className="mt-2 text-sm leading-6" style={{ color: CONCEPT_THEME.navy }}>
                    Activation tokens are generated by the admin when an invite is created or re-sent. If you do not have a token, contact <a href="mailto:admin@ser-cat.org" className="font-semibold">admin@ser-cat.org</a>.
                  </p>
                </div>
              )}
            </form>

            <div className="mt-6 text-sm" style={{ color: CONCEPT_THEME.muted }}>
              Already have an account?{' '}
              <button type="button" onClick={onBackToLogin} className="font-semibold" style={{ color: CONCEPT_THEME.sky }}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
