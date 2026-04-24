import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CONCEPT_THEME } from '../../lib/theme';

export default function LoginScreen({ cycle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (location.state?.email) {
      setLoginForm((prev) => ({ ...prev, email: location.state.email }));
    }
  }, [location.state?.email]);

  const handleSignIn = async (event) => {
    event.preventDefault();

    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    if (!email || !password) {
      setLoginError('Enter both email and password.');
      return;
    }

    try {
      setLoginError('');
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setLoginError(err?.message || 'Invalid email or password.');
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
            <div>
              <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.navy }}>
                <span className="concept-font-display text-lg font-bold">SERCAT</span>
                <span className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: CONCEPT_THEME.accentOnAccent }}>Cycle {cycle?.id || '2026-1'}</span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.accentText }}>Member Sign In</p>
              <h1 className="concept-font-display mt-3 text-4xl font-bold leading-tight" style={{ color: CONCEPT_THEME.navy }}>Welcome back</h1>
              <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
                Sign in with your institutional email and password to continue to the SERCAT portal.
              </p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSignIn}>
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
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
                  <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-semibold"
                    style={{ color: CONCEPT_THEME.sky }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
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

              {loginError ? (
                <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
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
                <a className="font-semibold" href="mailto:admin@ser-cat.org" style={{ color: CONCEPT_THEME.accentText }}>
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
                onClick={() => navigate('/activate')}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
                style={{ background: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal }}
              >
                Activate your account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
