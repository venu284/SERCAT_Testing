import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ConceptFontStyles from './components/ConceptFontStyles';
import ActivateAccountScreen from './screens/auth/ActivateAccountScreen';
import LoginScreen from './screens/auth/LoginScreen';
import MemberDashboard from './screens/member/MemberDashboard';
import AvailabilityCalendar from './screens/member/AvailabilityCalendar';
import PreferenceForm from './screens/member/PreferenceForm';
import MySchedule from './screens/member/MySchedule';
import ShiftChanges from './screens/member/ShiftChanges';
import AdminDashboard from './screens/admin/AdminDashboard';
import MembersAndShares from './screens/admin/MembersAndShares';
import RunCycles from './screens/admin/RunCycles';
import EngineAndSchedule from './screens/admin/EngineAndSchedule';
import FairnessPanel from './screens/admin/FairnessPanel';
import ShiftChangeAdmin from './screens/admin/ShiftChangeAdmin';
import ConflictLog from './screens/admin/ConflictLog';
import { ADMIN_PORTAL_TABS, MEMBER_PORTAL_TABS } from './lib/constants';
import { CONCEPT_THEME, COLORS, MEMBER_BG } from './lib/theme';
import { useMockApp } from './lib/mock-state';

const MEMBER_ROUTE_BY_TAB = {
  dashboard: '/member/dashboard',
  availability: '/member/availability',
  preferences: '/member/preferences',
  schedule: '/member/schedule',
  shiftChanges: '/member/shift-changes',
};

const ADMIN_ROUTE_BY_TAB = {
  dashboard: '/admin/dashboard',
  members: '/admin/members',
  cycle: '/admin/run-cycles',
  engine: '/admin/engine',
  fairness: '/admin/fairness',
  shiftChanges: '/admin/shift-changes',
  conflicts: '/admin/conflicts',
};

const MEMBER_TAB_BY_PATH = Object.fromEntries(Object.entries(MEMBER_ROUTE_BY_TAB).map(([tab, path]) => [path, tab]));
const ADMIN_TAB_BY_PATH = Object.fromEntries(Object.entries(ADMIN_ROUTE_BY_TAB).map(([tab, path]) => [path, tab]));

function MemberRouteFallback() {
  return <div className="text-center py-12 text-gray-500 text-sm">Select a member account to preview member screens.</div>;
}

function EngineEmptyState() {
  return <div className="text-center py-12 text-gray-400 text-sm">Run the engine to populate this screen.</div>;
}

export default function App() {
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
    loadFromDatabase,
    resetToDemoBaseline,
    saveCurrentToDatabase,
    results,
  } = useMockApp();

  const location = useLocation();
  const navigate = useNavigate();
  const inMemberArea = location.pathname.startsWith('/member/');
  const inAdminArea = location.pathname.startsWith('/admin/');

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
            handleActivate={handleActivate}
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
          handleSignIn={handleSignIn}
          handleSSOSignIn={handleSSOSignIn}
          handleResetDemoData={resetToDemoBaseline}
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

  return (
    <>
      <ConceptFontStyles />
      <div className="app-screen flex w-full flex-col overflow-x-hidden" style={{ background: CONCEPT_THEME.cream, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="sticky top-0 z-50" style={{ background: CONCEPT_THEME.navy }}>
          <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${CONCEPT_THEME.amber}22` }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 12l10 5 10-5" />
                  <path d="M2 17l10 5 10-5" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="concept-font-display font-bold text-white text-sm leading-tight truncate">SERCAT Scheduling Portal</h1>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.58)' }}>Phase 1 UI | {cycle.id}</span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col lg:items-end gap-2">
              {isAdminSession ? (
                <div className="w-full lg:max-w-[980px] overflow-x-auto">
                  <div className="flex items-center gap-1.5 pb-1 min-w-max">
                    <button
                      onClick={() => {
                        setCurrentView('admin');
                        openAdminTab(adminTab || 'dashboard');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: currentView === 'admin' && inAdminArea ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
                        color: 'white',
                        border: `1px solid ${currentView === 'admin' && inAdminArea ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.1)'}`,
                      }}
                    >
                      Admin
                    </button>
                    {members.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => openMemberPreview(member.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={currentView === member.id && inMemberArea
                          ? { backgroundColor: COLORS[member.id], color: 'white', border: '1px solid transparent' }
                          : { backgroundColor: MEMBER_BG[member.id], color: COLORS[member.id], border: '1px solid transparent' }}
                      >
                        {member.id}
                      </button>
                    ))}
                  </div>
                </div>
              ) : <div />}

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {!isAdminSession ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: `${CONCEPT_THEME.sky}22`, color: '#e5f1ff' }}>
                    Member: {session.memberId}
                  </span>
                ) : null}
                <span className="px-2 py-1 rounded text-[11px] font-semibold" style={{ background: isAdminSession ? 'rgba(255,255,255,0.13)' : `${CONCEPT_THEME.emerald}22`, color: isAdminSession ? 'white' : '#d6f7e7' }}>
                  {isAdminSession ? 'Admin Session' : 'Member Session'}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-4">
          {inMemberArea && activeMember && (
            <div className="space-y-4 mb-4">
              <div className="bg-white rounded-lg border p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-gray-800">{activeMember.name}</h2>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                    Member Portal
                  </span>
                </div>
              </div>

              <div className="sticky top-14 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 backdrop-blur border-y" style={{ background: `${CONCEPT_THEME.cream}f2`, borderColor: CONCEPT_THEME.borderLight }}>
                <div className="overflow-x-auto">
                  <div className="flex items-center gap-1 min-w-max pr-1">
                    {MEMBER_PORTAL_TABS.map((tab) => {
                      const badge = memberTabBadges[tab.id];
                      const active = memberTab === tab.id;
                      const badgeClass = active
                        ? 'bg-white/20 text-white'
                        : tab.id === 'preferences' && badge === 'Action'
                          ? 'bg-amber-100 text-amber-700'
                          : tab.id === 'preferences' && badge === 'Late'
                            ? 'bg-red-100 text-red-700'
                            : tab.id === 'schedule' && badge === 'Ready'
                              ? 'bg-emerald-100 text-emerald-700'
                              : tab.id === 'shiftChanges' && badge
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-600';
                      return (
                        <button
                          key={tab.id}
                          onClick={() => openMemberTab(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{tab.label}</span>
                            {badge ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>{badge}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {inAdminArea && isAdminSession && (
            <div className="space-y-4 mb-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {ADMIN_PORTAL_TABS.map((tab) => {
                    const active = adminTab === tab.id;
                    const badge = tab.id === 'members' && pendingRegistrationCount > 0 ? pendingRegistrationCount : 0;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => openAdminTab(tab.id)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: active ? CONCEPT_THEME.navy : CONCEPT_THEME.warmWhite,
                          color: active ? 'white' : CONCEPT_THEME.text,
                          border: active ? `1px solid ${CONCEPT_THEME.navy}` : `1px solid ${CONCEPT_THEME.border}`,
                          boxShadow: active ? '0 6px 16px rgba(27,46,74,0.18)' : 'none',
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span>{tab.label}</span>
                          {badge ? <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{badge}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1" />
                <span className="text-[11px]" style={{ color: CONCEPT_THEME.muted }}>{dbStatus}</span>
                <button
                  onClick={loadFromDatabase}
                  disabled={dbBusy}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:cursor-not-allowed"
                  style={{ background: dbBusy ? '#f3f4f6' : CONCEPT_THEME.sand, color: dbBusy ? '#9ca3af' : CONCEPT_THEME.text, border: `1px solid ${CONCEPT_THEME.border}` }}
                >
                  Load Local
                </button>
                <button
                  onClick={saveCurrentToDatabase}
                  disabled={dbBusy}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:cursor-not-allowed"
                  style={{ background: dbBusy ? '#f3f4f6' : CONCEPT_THEME.emeraldLight, color: dbBusy ? '#9ca3af' : CONCEPT_THEME.emerald, border: `1px solid ${dbBusy ? '#e5e7eb' : `${CONCEPT_THEME.emerald}33`}` }}
                >
                  Save Local
                </button>
              </div>
            </div>
          )}

          {!isAdminSession && inAdminArea ? (
            <div className="text-center py-12 text-gray-500 text-sm">Member sessions cannot access admin screens.</div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />} />
              <Route path="/login" element={<Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />} />
              <Route path="/member/dashboard" element={activeMember ? <MemberDashboard /> : <MemberRouteFallback />} />
              <Route path="/member/availability" element={activeMember ? <AvailabilityCalendar /> : <MemberRouteFallback />} />
              <Route path="/member/preferences" element={activeMember ? <PreferenceForm /> : <MemberRouteFallback />} />
              <Route path="/member/schedule" element={activeMember ? <MySchedule /> : <MemberRouteFallback />} />
              <Route path="/member/shift-changes" element={activeMember ? <ShiftChanges /> : <MemberRouteFallback />} />
              <Route path="/admin/dashboard" element={isAdminSession ? <AdminDashboard /> : <Navigate to="/member/dashboard" replace />} />
              <Route path="/admin/members" element={isAdminSession ? <MembersAndShares /> : <Navigate to="/member/dashboard" replace />} />
              <Route path="/admin/run-cycles" element={isAdminSession ? <RunCycles /> : <Navigate to="/member/dashboard" replace />} />
              <Route path="/admin/engine" element={isAdminSession ? <EngineAndSchedule /> : <Navigate to="/member/dashboard" replace />} />
              <Route path="/admin/fairness" element={isAdminSession ? (results ? <FairnessPanel /> : <EngineEmptyState />) : <Navigate to="/member/dashboard" replace />} />
              <Route path="/admin/shift-changes" element={isAdminSession ? <ShiftChangeAdmin /> : <Navigate to="/member/dashboard" replace />} />
              <Route path="/admin/conflicts" element={isAdminSession ? (results ? <ConflictLog /> : <EngineEmptyState />) : <Navigate to="/member/dashboard" replace />} />
              <Route path="*" element={<Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />} />
            </Routes>
          )}
        </div>
      </div>
    </>
  );
}
