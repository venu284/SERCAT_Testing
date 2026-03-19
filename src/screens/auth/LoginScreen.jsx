import React from 'react';
import { CONCEPT_THEME } from '../../lib/theme';

export default function LoginScreen({
  authScreen,
  setAuthScreen,
  loginForm,
  setLoginForm,
  loginError,
  registrationSuccess,
  registrationForm,
  setRegistrationForm,
  handleSignIn,
  handleSSOSignIn,
  handleRegister,
  handleResetDemoData,
  registrationInstitutions = [],
}) {
  const hasInstitutionOptions = registrationInstitutions.length > 0;
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 concept-font-body" style={{ background: CONCEPT_THEME.cream }}>
      <div className="w-full max-w-sm concept-anim-fade">
        <div className="mb-4 flex gap-1">
          <button
            type="button"
            onClick={() => setAuthScreen('login')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-md"
            style={{ background: authScreen === 'login' ? CONCEPT_THEME.navy : CONCEPT_THEME.sand, color: authScreen === 'login' ? 'white' : CONCEPT_THEME.muted }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setAuthScreen('register')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-md"
            style={{ background: authScreen === 'register' ? CONCEPT_THEME.navy : CONCEPT_THEME.sand, color: authScreen === 'register' ? 'white' : CONCEPT_THEME.muted }}
          >
            Register
          </button>
        </div>

        {authScreen === 'login' ? (
          <>
            <h1 className="concept-font-display text-3xl font-bold mb-1" style={{ color: CONCEPT_THEME.navy }}>Welcome back</h1>
            <p className="text-sm mb-6" style={{ color: CONCEPT_THEME.muted }}>Sign in to continue to your portal.</p>
            <form className="space-y-3" onSubmit={handleSignIn}>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: CONCEPT_THEME.text }}>Username or Institutional Email</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}
                  placeholder="member username or pi@institution.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: CONCEPT_THEME.text }}>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}
                  placeholder="password"
                />
              </div>
              {registrationSuccess ? (
                <div className="text-xs rounded-lg px-2.5 py-2 border" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}40`, color: CONCEPT_THEME.emerald }}>
                  {registrationSuccess.type === 'request'
                    ? `Registration submitted for ${registrationSuccess.institutionalEmail} (${registrationSuccess.institutionLabel}). Waiting for admin approval.`
                    : `New account for ${registrationSuccess.memberId}: ${registrationSuccess.username} / ${registrationSuccess.password}`}
                </div>
              ) : null}
              {loginError ? <div className="text-xs rounded-lg px-2.5 py-2 border border-red-200 text-red-700 bg-red-50">{loginError}</div> : null}
              <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold" style={{ background: CONCEPT_THEME.navy, color: 'white' }}>
                Sign In
              </button>
            </form>

            <div className="flex items-center gap-3 my-3">
              <div className="h-px flex-1" style={{ background: CONCEPT_THEME.border }} />
              <span className="text-xs" style={{ color: CONCEPT_THEME.subtle }}>or</span>
              <div className="h-px flex-1" style={{ background: CONCEPT_THEME.border }} />
            </div>

            <button
              type="button"
              onClick={handleSSOSignIn}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.border}`, color: CONCEPT_THEME.text }}
            >
              Sign in with Institutional SSO
            </button>

            <button
              type="button"
              onClick={handleResetDemoData}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: CONCEPT_THEME.emeraldLight, border: `1px solid ${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}
            >
              Reset Demo Data
            </button>
            <p className="text-[11px] mt-2 text-center" style={{ color: CONCEPT_THEME.subtle }}>
              Restores the standard mock baseline so a shareholder can test from registration through submission.
            </p>
          </>
        ) : (
          <>
            <h1 className="concept-font-display text-3xl font-bold mb-1" style={{ color: CONCEPT_THEME.navy }}>Request access</h1>
            <p className="text-sm mb-6" style={{ color: CONCEPT_THEME.muted }}>Self-declare shares for admin approval.</p>
            {!hasInstitutionOptions ? <div className="text-xs rounded-lg px-2.5 py-2 border border-amber-200 bg-amber-50 text-amber-800 mb-3">No institutions are currently open for registration. Contact SERCAT admin.</div> : null}
            <form className="space-y-3" onSubmit={handleRegister}>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: CONCEPT_THEME.text }}>Institution</label>
                <select
                  value={registrationForm.institutionMemberId}
                  onChange={(e) => setRegistrationForm((prev) => ({ ...prev, institutionMemberId: e.target.value }))}
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}
                >
                  <option value="">Select institution</option>
                  {registrationInstitutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name} ({institution.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: CONCEPT_THEME.text }}>Institutional Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={registrationForm.institutionalEmail}
                  onChange={(e) => setRegistrationForm((prev) => ({ ...prev, institutionalEmail: e.target.value }))}
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}
                  placeholder="pi@institution.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: CONCEPT_THEME.text }}>Declared Shares</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={registrationForm.shares}
                  onChange={(e) => setRegistrationForm((prev) => ({ ...prev, shares: e.target.value }))}
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}
                  placeholder="1.00"
                />
              </div>
              {loginError ? <div className="text-xs rounded-lg px-2.5 py-2 border border-red-200 text-red-700 bg-red-50">{loginError}</div> : null}
              <button
                type="submit"
                disabled={!hasInstitutionOptions}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: hasInstitutionOptions ? CONCEPT_THEME.navy : CONCEPT_THEME.sandDark, color: hasInstitutionOptions ? 'white' : CONCEPT_THEME.muted }}
              >
                Submit Registration
              </button>
            </form>

            <button
              type="button"
              onClick={handleResetDemoData}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: CONCEPT_THEME.emeraldLight, border: `1px solid ${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}
            >
              Reset Demo Data
            </button>
          </>
        )}
      </div>
    </div>
  );
}
