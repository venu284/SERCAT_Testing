import React, { useCallback, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ConceptFontStyles from './components/ConceptFontStyles';
import ActivateAccountScreen from './screens/auth/ActivateAccountScreen';
import LoginScreen from './screens/auth/LoginScreen';
import MemberDashboard from './screens/member/MemberDashboard';
import AvailabilityCalendar from './screens/member/AvailabilityCalendar';
import PreferenceForm from './screens/member/PreferenceForm';
import MySchedule from './screens/member/MySchedule';
import ShiftChanges from './screens/member/ShiftChanges';
import MemberComments from './screens/member/MemberComments';
import MemberProfile from './screens/member/MemberProfile';
import AdminDashboard from './screens/admin/AdminDashboard';
import MembersAndShares from './screens/admin/MembersAndShares';
import RunCycles from './screens/admin/RunCycles';
import EngineAndSchedule from './screens/admin/EngineAndSchedule';
import FairnessPanel from './screens/admin/FairnessPanel';
import ShiftChangeAdmin from './screens/admin/ShiftChangeAdmin';
import AdminComments from './screens/admin/AdminComments';
import ConflictLog from './screens/admin/ConflictLog';
import { ADMIN_PORTAL_TABS, MEMBER_PORTAL_TABS } from './lib/constants';
import { CONCEPT_THEME, COLORS, MEMBER_BG } from './lib/theme';
import { MockStateProvider, useMockApp } from './lib/mock-state';
import { useAuth } from './contexts/AuthContext';

const MEMBER_ROUTE_BY_TAB = {
  dashboard: '/member/dashboard',
  availability: '/member/availability',
  preferences: '/member/preferences',
  schedule: '/member/schedule',
  shiftChanges: '/member/shift-changes',
  comments: '/member/comments',
  profile: '/member/profile',
};

const ADMIN_ROUTE_BY_TAB = {
  dashboard: '/admin/dashboard',
  members: '/admin/members',
  cycle: '/admin/run-cycles',
  engine: '/admin/engine',
  fairness: '/admin/fairness',
  shiftChanges: '/admin/shift-changes',
  comments: '/admin/comments',
  conflicts: '/admin/conflicts',
};

const MEMBER_TAB_BY_PATH = Object.fromEntries(Object.entries(MEMBER_ROUTE_BY_TAB).map(([tab, path]) => [path, tab]));
const ADMIN_TAB_BY_PATH = Object.fromEntries(Object.entries(ADMIN_ROUTE_BY_TAB).map(([tab, path]) => [path, tab]));

function MemberRouteFallback() {
  return <div className="py-12 text-center text-sm text-gray-500">Select a member account to preview member screens.</div>;
}

function EngineEmptyState() {
  return <div className="py-12 text-center text-sm text-gray-400">Run the engine to populate this screen.</div>;
}

function getInitials(label = '') {
  const words = String(label || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'PI';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function getMemberBadgeTone(tabId, badge, active) {
  if (!badge) return null;
  if (active) {
    return { background: 'rgba(255,255,255,0.16)', color: 'white' };
  }
  if (tabId === 'preferences' && badge === 'Action') {
    return { background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
  }
  if (tabId === 'preferences' && badge === 'Late') {
    return { background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error };
  }
  if (tabId === 'schedule' && (badge === 'Ready' || badge === 'Published')) {
    return { background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald };
  }
  if (tabId === 'availability' && badge === 'Live') {
    return { background: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky };
  }
  if (tabId === 'shiftChanges') {
    return { background: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal };
  }
  return { background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text };
}

function MemberNavIcon({ tabId, active }) {
  const stroke = active ? 'white' : CONCEPT_THEME.navy;
  const strokeProps = { fill: 'none', stroke, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

  if (tabId === 'dashboard') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M4 12.5L12 4l8 8.5" />
        <path d="M6.5 10.5V20h11v-9.5" />
      </svg>
    );
  }
  if (tabId === 'availability') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M3.5 9.5h17" />
      </svg>
    );
  }
  if (tabId === 'preferences') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M8 6h10" />
        <path d="M8 12h10" />
        <path d="M8 18h10" />
        <path d="M4 6h.01" />
        <path d="M4 12h.01" />
        <path d="M4 18h.01" />
      </svg>
    );
  }
  if (tabId === 'schedule') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v5l3 2" />
      </svg>
    );
  }
  if (tabId === 'shiftChanges') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M7 7h10" />
        <path d="M13 3l4 4-4 4" />
        <path d="M17 17H7" />
        <path d="M11 13l-4 4 4 4" />
      </svg>
    );
  }
  if (tabId === 'comments') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M5 6.5h14a2 2 0 012 2v7a2 2 0 01-2 2H10l-5 3v-3H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0114 0" />
    </svg>
  );
}

function getAdminBadgeTone(badge, active) {
  if (!badge) return null;
  if (active) {
    return { background: 'rgba(255,255,255,0.16)', color: 'white' };
  }
  return { background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
}

function AdminNavIcon({ tabId, active }) {
  const stroke = active ? 'white' : CONCEPT_THEME.navy;
  const strokeProps = { fill: 'none', stroke, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

  if (tabId === 'dashboard') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M4 12.5L12 4l8 8.5" />
        <path d="M6.5 10.5V20h11v-9.5" />
      </svg>
    );
  }
  if (tabId === 'members') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <circle cx="9" cy="8.5" r="2.5" />
        <circle cx="16.5" cy="10" r="2" />
        <path d="M4.5 18a4.5 4.5 0 019 0" />
        <path d="M13.5 18a3.5 3.5 0 017 0" />
      </svg>
    );
  }
  if (tabId === 'cycle') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M3.5 9.5h17" />
      </svg>
    );
  }
  if (tabId === 'engine') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M6 7.5h12" />
        <path d="M6 12h12" />
        <path d="M6 16.5h12" />
        <circle cx="9" cy="7.5" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="11" cy="16.5" r="1.5" />
      </svg>
    );
  }
  if (tabId === 'fairness') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M12 5v14" />
        <path d="M7 9.5h10" />
        <path d="M8 9.5l-2.5 5h5L8 9.5z" />
        <path d="M16 9.5l-2.5 5h5L16 9.5z" />
      </svg>
    );
  }
  if (tabId === 'shiftChanges') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M7 7h10" />
        <path d="M13 3l4 4-4 4" />
        <path d="M17 17H7" />
        <path d="M11 13l-4 4 4 4" />
      </svg>
    );
  }
  if (tabId === 'comments') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M5 6.5h14a2 2 0 012 2v7a2 2 0 01-2 2H10l-5 3v-3H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...strokeProps}>
      <path d="M12 3l9 16H3L12 3z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function MemberPreviewSwitcher({
  members,
  currentView,
  inAdminArea,
  inMemberArea,
  adminTab,
  openAdminTab,
  openMemberPreview,
  compact = false,
}) {
  return (
    <div className={compact ? 'overflow-x-auto' : ''}>
      <div className={`flex min-w-max flex-wrap items-center gap-1.5 ${compact ? 'pb-1' : ''}`}>
        <button
          onClick={() => openAdminTab(adminTab || 'dashboard')}
          className="rounded-xl px-3 py-2 text-sm font-semibold transition-all"
          style={{
            background: currentView === 'admin' && inAdminArea ? CONCEPT_THEME.navy : CONCEPT_THEME.sand,
            color: currentView === 'admin' && inAdminArea ? 'white' : CONCEPT_THEME.text,
            border: `1px solid ${currentView === 'admin' && inAdminArea ? CONCEPT_THEME.navy : CONCEPT_THEME.border}`,
          }}
        >
          Admin
        </button>
        {members.map((member) => (
          <button
            key={member.id}
            onClick={() => openMemberPreview(member.id)}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition-all"
            style={currentView === member.id && inMemberArea
              ? { backgroundColor: COLORS[member.id], color: 'white', border: '1px solid transparent' }
              : { backgroundColor: MEMBER_BG[member.id], color: COLORS[member.id], border: '1px solid transparent' }}
          >
            {member.id}
          </button>
        ))}
      </div>
    </div>
  );
}

function AppContent({ authUser, authLogin, authLogout, authActivate, authRequestReset }) {
  const {
    session,
    authScreen,
    setAuthScreen,
    loginForm,
    setLoginForm,
    loginError,
    setLoginError,
    activateToken,
    setActivateToken,
    activateForm,
    setActivateForm,
    activationSummary,
    setActivationSummary,
    handleSignIn,
    handleSSOSignIn,
    handleActivate,
    isAdminSession,
    currentView,
    setCurrentView,
    memberTab,
    setMemberTab,
    adminTab,
    setAdminTab,
    handleSignOut,
    cycle,
    members,
    activeMember,
    memberTabBadges,
    pendingRegistrationCount,
    dbStatus,
    dbBusy,
    serverDataReady,
    serverDataLoading,
    loadFromDatabase,
    resetToDemoBaseline,
    saveCurrentToDatabase,
    results,
  } = useMockApp();

  void authRequestReset;

  const realHandleSignIn = useCallback(async (event) => {
    event.preventDefault();
    setLoginError('');
    const email = loginForm.username?.trim().toLowerCase();
    const password = loginForm.password;
    if (!email || !password) {
      setLoginError('Enter both email and password.');
      return;
    }
    try {
      await authLogin(email, password);
      setLoginForm({ username: '', password: '' });
      setLoginError('');
      setAuthScreen('login');
    } catch (err) {
      setLoginError(err.message || 'Invalid email or password.');
    }
  }, [loginForm, authLogin, setLoginError, setLoginForm, setAuthScreen]);

  const realHandleActivate = useCallback(async (event) => {
    event.preventDefault();
    setLoginError('');
    const token = activateToken.trim();
    const { password, confirmPassword, phone } = activateForm;

    if (!token) {
      setLoginError('Enter the activation token from your invite email.');
      return;
    }
    if (!password || password.length < 8) {
      setLoginError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    try {
      const result = await authActivate(token, password, confirmPassword, phone);
      setActivationSummary({
        memberId: result.user?.id || '',
        memberName: result.user?.institutionName || '',
        piName: result.user?.name || '',
        piEmail: result.user?.email || '',
      });
      setAuthScreen('activateSuccess');
      setLoginError('');
      setActivateToken('');
      setActivateForm({ password: '', confirmPassword: '', phone: '' });
    } catch (err) {
      setLoginError(err.message || 'Invalid or expired activation token.');
    }
  }, [
    activateForm,
    activateToken,
    authActivate,
    setActivationSummary,
    setActivateForm,
    setActivateToken,
    setAuthScreen,
    setLoginError,
  ]);

  const realHandleSignOut = useCallback(async () => {
    await authLogout();
  }, [authLogout]);

  const effectiveHandleSignIn = authUser !== undefined ? realHandleSignIn : handleSignIn;
  const effectiveHandleActivate = authUser !== undefined ? realHandleActivate : handleActivate;
  const effectiveHandleSignOut = authUser !== undefined ? realHandleSignOut : handleSignOut;

  const location = useLocation();
  const navigate = useNavigate();
  const inMemberArea = location.pathname.startsWith('/member/');
  const inAdminArea = location.pathname.startsWith('/admin/');
  const showMemberShell = inMemberArea && Boolean(activeMember);
  const showAdminShell = inAdminArea && isAdminSession;

  useEffect(() => {
    if (!session) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
      return;
    }

    if (session.role === 'admin') {
      if (location.pathname === '/' || location.pathname === '/login') {
        navigate('/admin/dashboard', { replace: true });
      }
      return;
    }

    if (location.pathname === '/' || location.pathname === '/login' || location.pathname.startsWith('/admin/')) {
      navigate('/member/dashboard', { replace: true });
    }
  }, [session, location.pathname, navigate]);

  useEffect(() => {
    if (!session) return;

    if (location.pathname.startsWith('/member/')) {
      const nextMemberTab = MEMBER_TAB_BY_PATH[location.pathname] || 'dashboard';
      if (memberTab !== nextMemberTab) setMemberTab(nextMemberTab);
      if (session.role === 'member') {
        if (currentView !== session.memberId) setCurrentView(session.memberId);
      } else if ((currentView === 'admin' || !members.some((member) => member.id === currentView)) && members[0]) {
        setCurrentView(members[0].id);
      }
      return;
    }

    if (location.pathname.startsWith('/admin/')) {
      const nextAdminTab = ADMIN_TAB_BY_PATH[location.pathname] || 'dashboard';
      if (adminTab !== nextAdminTab) setAdminTab(nextAdminTab);
      if (session.role === 'admin' && currentView !== 'admin') {
        setCurrentView('admin');
      }
    }
  }, [session, location.pathname, memberTab, setMemberTab, currentView, setCurrentView, members, adminTab, setAdminTab]);

  const openAdminTab = (tabId) => {
    setCurrentView('admin');
    setAdminTab(tabId);
    navigate(ADMIN_ROUTE_BY_TAB[tabId] || '/admin/dashboard');
  };

  const openMemberTab = (tabId) => {
    setMemberTab(tabId);
    navigate(MEMBER_ROUTE_BY_TAB[tabId] || '/member/dashboard');
  };

  const openMemberPreview = (memberId) => {
    setCurrentView(memberId);
    navigate(MEMBER_ROUTE_BY_TAB[memberTab] || '/member/dashboard');
  };

  if (!session) {
    if (authScreen === 'activate' || authScreen === 'activateSuccess') {
      return (
        <>
          <ConceptFontStyles />
          <ActivateAccountScreen
            authScreen={authScreen}
            activateToken={activateToken}
            setActivateToken={setActivateToken}
            activateForm={activateForm}
            setActivateForm={setActivateForm}
            handleActivate={effectiveHandleActivate}
            loginError={loginError}
            members={members}
            cycle={cycle}
            activationSummary={activationSummary}
            onActivated={(email = '') => {
              setAuthScreen('login');
              setLoginError('');
              setActivateToken('');
              setActivateForm({ password: '', confirmPassword: '', phone: '' });
              setLoginForm({ username: email, password: '' });
            }}
            onBackToLogin={() => {
              setAuthScreen('login');
              setLoginError('');
              setActivateToken('');
              setActivateForm({ password: '', confirmPassword: '', phone: '' });
              setLoginForm((prev) => ({ ...prev, password: '' }));
            }}
          />
        </>
      );
    }

    return (
      <>
        <ConceptFontStyles />
        <LoginScreen
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginError={loginError}
          handleSignIn={effectiveHandleSignIn}
          handleSSOSignIn={handleSSOSignIn}
          handleResetDemoData={authUser !== undefined ? () => {} : resetToDemoBaseline}
          onShowActivate={() => {
            setAuthScreen('activate');
            setLoginError('');
          }}
          members={members}
          cycle={cycle}
        />
      </>
    );
  }

  if (session && serverDataLoading && !serverDataReady) {
    return (
      <>
        <ConceptFontStyles />
        <div className="flex min-h-screen items-center justify-center" style={{ background: '#faf8f5' }}>
          <div className="text-center">
            <div className="text-lg font-semibold" style={{ color: '#0f2a4a' }}>SERCAT</div>
            <div className="mt-2 text-sm" style={{ color: '#8896a7' }}>Loading data...</div>
          </div>
        </div>
      </>
    );
  }

  const profileName = activeMember?.piName || activeMember?.id || 'Member';
  const profileInstitution = activeMember?.name || activeMember?.id || 'Member account';
  const adminProfileName = 'SERCAT Admin';
  const adminProfileInstitution = 'Administrative Console';

  const routesElement = (
    <Routes>
      <Route path="/" element={<Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />} />
      <Route path="/login" element={<Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />} />
      <Route path="/member/dashboard" element={activeMember ? <MemberDashboard /> : <MemberRouteFallback />} />
      <Route path="/member/availability" element={activeMember ? <AvailabilityCalendar /> : <MemberRouteFallback />} />
      <Route path="/member/preferences" element={activeMember ? <PreferenceForm /> : <MemberRouteFallback />} />
      <Route path="/member/schedule" element={activeMember ? <MySchedule /> : <MemberRouteFallback />} />
      <Route path="/member/shift-changes" element={activeMember ? <ShiftChanges /> : <MemberRouteFallback />} />
      <Route path="/member/comments" element={activeMember ? <MemberComments /> : <MemberRouteFallback />} />
      <Route path="/member/profile" element={activeMember ? <MemberProfile /> : <MemberRouteFallback />} />
      <Route path="/admin/dashboard" element={isAdminSession ? <AdminDashboard /> : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/members" element={isAdminSession ? <MembersAndShares /> : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/run-cycles" element={isAdminSession ? <RunCycles /> : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/engine" element={isAdminSession ? <EngineAndSchedule /> : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/fairness" element={isAdminSession ? (results ? <FairnessPanel /> : <EngineEmptyState />) : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/shift-changes" element={isAdminSession ? <ShiftChangeAdmin /> : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/comments" element={isAdminSession ? <AdminComments /> : <Navigate to="/member/dashboard" replace />} />
      <Route path="/admin/conflicts" element={isAdminSession ? (results ? <ConflictLog /> : <EngineEmptyState />) : <Navigate to="/member/dashboard" replace />} />
      <Route path="*" element={<Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />} />
    </Routes>
  );

  return (
    <>
      <ConceptFontStyles />
      <div className="app-screen flex w-full flex-col overflow-x-hidden" style={{ background: CONCEPT_THEME.cream, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {showMemberShell ? (
          <div className="sticky top-0 z-50 border-b" style={{ background: CONCEPT_THEME.navy, borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${CONCEPT_THEME.amber}22` }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 12l10 5 10-5" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="concept-font-display truncate text-base font-bold text-white">SERCAT</div>
                  <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Cycle {cycle.id}</div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: `${CONCEPT_THEME.amber}22`, color: CONCEPT_THEME.amber }}>
                    {getInitials(profileName)}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <div className="truncate text-sm font-semibold text-white">{profileName}</div>
                    <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{profileInstitution}</div>
                  </div>
                </div>
                <button
                  onClick={effectiveHandleSignOut}
                  className="rounded-xl px-3 py-2 text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        ) : showAdminShell ? (
          <div className="sticky top-0 z-50 border-b" style={{ background: CONCEPT_THEME.navy, borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${CONCEPT_THEME.amber}22` }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 12l10 5 10-5" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="concept-font-display truncate text-base font-bold text-white">SERCAT</div>
                  <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Cycle {cycle.id}</div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: `${CONCEPT_THEME.amber}22`, color: CONCEPT_THEME.amber }}>
                    {getInitials(adminProfileName)}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <div className="truncate text-sm font-semibold text-white">{adminProfileName}</div>
                    <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{adminProfileInstitution}</div>
                  </div>
                </div>
                <button
                  onClick={effectiveHandleSignOut}
                  className="rounded-xl px-3 py-2 text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="sticky top-0 z-50" style={{ background: CONCEPT_THEME.navy }}>
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${CONCEPT_THEME.amber}22` }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 12l10 5 10-5" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="concept-font-display truncate text-sm font-bold leading-tight text-white">SERCAT Scheduling Portal</h1>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Cycle {cycle.id}</span>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: `${CONCEPT_THEME.amber}22`, color: CONCEPT_THEME.amber }}>
                    {getInitials(isAdminSession ? adminProfileName : profileName)}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <div className="truncate text-sm font-semibold text-white">
                      {isAdminSession ? adminProfileName : profileName}
                    </div>
                    <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      {isAdminSession ? adminProfileInstitution : profileInstitution}
                    </div>
                  </div>
                </div>
                <button
                  onClick={effectiveHandleSignOut}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto flex-1 w-full max-w-[1600px] px-3 py-4 sm:px-4">
          {showMemberShell ? (
            <div className="space-y-4">
              {isAdminSession ? (
                <div className="rounded-2xl border bg-white px-3 py-3 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.muted }}>Member preview</div>
                  <MemberPreviewSwitcher
                    members={members}
                    currentView={currentView}
                    inAdminArea={inAdminArea}
                    inMemberArea={inMemberArea}
                    adminTab={adminTab}
                    openAdminTab={openAdminTab}
                    openMemberPreview={openMemberPreview}
                    compact
                  />
                </div>
              ) : null}

              <div
                className="sticky z-40 -mx-3 border-b px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4"
                style={{ top: 72, background: 'rgba(245,246,248,0.94)', borderColor: CONCEPT_THEME.borderLight }}
              >
                <div className="overflow-x-auto">
                  <div className="flex min-w-max items-stretch gap-2">
                    {MEMBER_PORTAL_TABS.map((tab) => {
                      const badge = memberTabBadges[tab.id];
                      const active = memberTab === tab.id;
                      const badgeTone = getMemberBadgeTone(tab.id, badge, active);
                      return (
                        <button
                          key={tab.id}
                          onClick={() => openMemberTab(tab.id)}
                          className="relative rounded-2xl border px-4 py-2.5 text-left transition-all"
                          style={active
                            ? {
                              background: CONCEPT_THEME.navy,
                              color: 'white',
                              borderColor: CONCEPT_THEME.navy,
                              boxShadow: '0 12px 24px rgba(15,42,74,0.18)',
                            }
                            : {
                              background: CONCEPT_THEME.warmWhite,
                              color: CONCEPT_THEME.text,
                              borderColor: CONCEPT_THEME.border,
                            }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: active ? 'rgba(255,255,255,0.12)' : CONCEPT_THEME.sand }}>
                              <MemberNavIcon tabId={tab.id} active={active} />
                            </div>
                            <span className="whitespace-nowrap text-sm font-semibold">{tab.label}</span>
                            {badge && badgeTone ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: badgeTone.background, color: badgeTone.color }}>
                                {badge}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                {routesElement}
              </div>
            </div>
          ) : (
            <>
              {inAdminArea && isAdminSession && (
                <div className="space-y-4">
                  <div
                    className="sticky z-40 -mx-3 border-b px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4"
                    style={{ top: 72, background: 'rgba(245,246,248,0.94)', borderColor: CONCEPT_THEME.borderLight }}
                  >
                    <div className="overflow-x-auto">
                      <div className="flex min-w-max items-stretch gap-2">
                        {ADMIN_PORTAL_TABS.map((tab) => {
                          const active = adminTab === tab.id;
                          const badge = tab.id === 'members' && pendingRegistrationCount > 0 ? pendingRegistrationCount : 0;
                          const badgeTone = getAdminBadgeTone(badge, active);
                          return (
                            <button
                              key={tab.id}
                              onClick={() => openAdminTab(tab.id)}
                              className="relative rounded-2xl border px-4 py-2.5 text-left transition-all"
                              style={active
                                ? {
                                  background: CONCEPT_THEME.navy,
                                  color: 'white',
                                  borderColor: CONCEPT_THEME.navy,
                                  boxShadow: '0 12px 24px rgba(15,42,74,0.18)',
                                }
                                : {
                                  background: CONCEPT_THEME.warmWhite,
                                  color: CONCEPT_THEME.text,
                                  borderColor: CONCEPT_THEME.border,
                                }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: active ? 'rgba(255,255,255,0.12)' : CONCEPT_THEME.sand }}>
                                  <AdminNavIcon tabId={tab.id} active={active} />
                                </div>
                                <span className="whitespace-nowrap text-sm font-semibold">{tab.label}</span>
                                {badge && badgeTone ? (
                                  <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: badgeTone.background, color: badgeTone.color }}>
                                    {badge}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isAdminSession && inAdminArea ? (
                <div className="py-12 text-center text-sm text-gray-500">Member sessions cannot access admin screens.</div>
              ) : (
                routesElement
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function App() {
  const { user, loading, login, logout, activate, requestReset } = useAuth();

  const externalSession = React.useMemo(() => {
    if (!user) return null;
    if (user.role === 'admin') {
      return { role: 'admin', username: user.email };
    }
    return {
      role: 'member',
      username: user.email,
      memberId: user.institutionAbbreviation || user.institutionId || user.email,
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#faf8f5' }}>
        <div className="text-center">
          <div className="text-lg font-semibold" style={{ color: '#0f2a4a' }}>SERCAT</div>
          <div className="mt-2 text-sm" style={{ color: '#8896a7' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <MockStateProvider
      externalSession={externalSession}
      onExternalSignOut={logout}
    >
      <AppContent
        authUser={user}
        authLogin={login}
        authLogout={logout}
        authActivate={activate}
        authRequestReset={requestReset}
      />
    </MockStateProvider>
  );
}
