import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { INITIAL_MEMBERS } from '../data/members';
import { INITIAL_CYCLE } from '../data/cycle';
import { ALGORITHM_PROFILE, DEFAULT_CONFIG } from '../data/config';
import currentRunSnapshot from '../data/current-run-snapshot.json';
import { createSeedSnapshot } from '../data/seed-state';
import { computeEntitlements } from './entitlements.js';
import {
  ADMIN_PORTAL_TABS,
  MEMBER_PORTAL_TABS,
  SHIFT_LABELS,
  SHIFT_ORDER,
  SHIFT_TIME_LABELS,
} from './constants';
import {
  addDays,
  daysBetweenSigned,
  escapeHtml,
  formatCalendarDate,
  fromDateStr,
  generateDateRange,
  localTodayDateStr,
  toDateStr,
} from './dates';
import {
  buildTestAccounts,
  isValidEmail,
  normalizeEmail,
  normalizeLoginKey,
  sanitizeUsername,
} from './auth';
import { api } from './api';
import {
  normalizeMemberAccessAccount,
  normalizeMemberAccessAccounts,
  normalizeMemberComments,
  normalizeMemberPreferences,
  normalizeMemberRecord,
  normalizeRegistrationRequests,
  normalizeShiftChangeRequest,
  normalizeShiftChangeRequests,
  sampleWholeShare,
} from './normalizers';
import { clearStoredSnapshot, loadStoredSnapshot, saveStoredSnapshot } from './storage';
import { mapServerCommentsToMemberComments, mapServerSwapRequestsToShiftChangeRequests } from './server-bridge.js';
import { ensureMemberPalette, simpleHash } from './theme';
import { useServerSync } from '../hooks/useServerSync';

const MockStateContext = createContext(null);
const DEFAULT_SCHEDULE_PUBLICATION = { status: 'draft', publishedAt: '', draftedAt: '' };
const DEFAULT_LOGIN_FORM = { username: '', password: '' };
const DEFAULT_ACTIVATE_FORM = { password: '', confirmPassword: '', phone: '' };
const DEFAULT_NEW_MEMBER_FORM = { id: '', name: '', shares: '1.00', piName: '', piEmail: '' };
const DEFAULT_ENGINE_PROGRESS = { running: false, value: 0, message: 'Idle' };
const DEFAULT_SHIFT_CHANGE_FORM = { requestedDate: '', requestedShift: '', reason: '' };

function buildInviteToken(memberId) {
  return `${memberId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildActivationSummary(member) {
  if (!member) return null;
  return {
    memberId: member.id,
    memberName: member.name || member.id,
    piName: member.piName || member.id,
    piEmail: member.piEmail || '',
  };
}

function buildInitialMemberComments(memberList = []) {
  const memberIds = new Set(memberList.map((member) => member.id));
  const seeded = {};

  memberIds.forEach((memberId) => {
    seeded[memberId] = [];
  });

  if (memberIds.has('UGA')) {
    seeded.UGA = [
      {
        id: 'CMT-UGA-1',
        memberId: 'UGA',
        subject: 'Beamline timing clarification',
        message: 'Could you confirm whether the March weekend calibration window affects overnight staffing expectations for UGA users?',
        status: 'Read',
        createdAt: '2026-03-10T14:30:00Z',
        updatedAt: '2026-03-11T09:00:00Z',
        readAt: '2026-03-11T09:00:00Z',
      },
      {
        id: 'CMT-UGA-2',
        memberId: 'UGA',
        subject: 'Preference submission follow-up',
        message: 'Thanks for the reminder. We have now finalized our preferred dates and will watch for the published schedule.',
        status: 'Replied',
        createdAt: '2026-03-05T17:10:00Z',
        updatedAt: '2026-03-06T13:15:00Z',
        readAt: '2026-03-06T11:20:00Z',
        adminReply: 'Thanks for the update. We have your submitted dates on file and will notify you once the draft schedule is published.',
        adminReplyAt: '2026-03-06T13:15:00Z',
      },
    ];
  }

  if (memberIds.has('MIT') && seeded.MIT.length === 0) {
    seeded.MIT = [
      {
        id: 'CMT-MIT-1',
        memberId: 'MIT',
        subject: 'Detector setup note',
        message: 'Our PI asked whether the new detector setup checklist should be completed before arrival or during onsite orientation.',
        status: 'Sent',
        createdAt: '2026-03-12T11:45:00Z',
        updatedAt: '2026-03-12T11:45:00Z',
      },
    ];
  }

  return normalizeMemberComments(seeded, memberList);
}

function getDemoPreferenceDeadline(cycle) {
  const today = localTodayDateStr();
  let nextDeadline = addDays(today, 7);
  if (cycle?.startDate && nextDeadline < cycle.startDate) nextDeadline = cycle.startDate;
  if (cycle?.endDate && nextDeadline > cycle.endDate) nextDeadline = cycle.endDate;
  return nextDeadline;
}

function normalizeLegacyAssignmentReason(assignment) {
  if (assignment?.assignmentReason) return assignment.assignmentReason;
  // Legacy snapshot compatibility for older local browser data.
  switch (assignment?.assignmentType) {
    case 'FIRST_CHOICE':
      return 'choice1';
    case 'SECOND_CHOICE':
      return 'choice2';
    case 'PROXIMITY':
      return 'fallback_proximity';
    case 'BACKFILL_ASSIGNED':
      return 'fallback_any';
    case 'MANUAL_OVERRIDE':
      return 'manual_override';
    case 'AUTO_ASSIGNED':
    default:
      return 'auto_assigned';
  }
}

function normalizeLoadedResultsShape(results) {
  if (!results || !Array.isArray(results.assignments)) return null;
  return {
    ...results,
    assignments: results.assignments.map((assignment) => ({
      ...assignment,
      assignedDate: assignment.assignedDate || assignment.date || '',
      // Legacy snapshot compatibility for older local browser data.
      shift: assignment.shift || assignment.shiftType || 'DS1',
      assignmentReason: normalizeLegacyAssignmentReason(assignment),
    })),
  };
}

function deriveDemoBaselineSnapshot(snapshot) {
  const seed = createSeedSnapshot();
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const cycle = { ...INITIAL_CYCLE, ...(source.cycle || {}) };
  const today = localTodayDateStr();
  if (!cycle.preferenceDeadline || cycle.preferenceDeadline < today) {
    cycle.preferenceDeadline = getDemoPreferenceDeadline(cycle);
  }

  return {
    ...seed,
    ...source,
    cycle,
    currentView: 'admin',
    memberTab: 'dashboard',
    adminTab: 'dashboard',
    results: null,
    schedulePublication: { ...DEFAULT_SCHEDULE_PUBLICATION },
    shiftChangeRequests: [],
    registrationRequests: [],
    memberAccessAccounts: [],
  };
}

function getDefaultState() {
  const seed = createSeedSnapshot();
  return {
    members: INITIAL_MEMBERS.map(normalizeMemberRecord),
    cycle: { ...INITIAL_CYCLE },
    queue: Array.isArray(seed.queue) ? seed.queue : [],
    config: { ...DEFAULT_CONFIG },
    preferences: {},
    results: null,
    session: null,
    authScreen: 'login',
    loginForm: { ...DEFAULT_LOGIN_FORM },
    loginError: '',
    activateToken: '',
    activateForm: { ...DEFAULT_ACTIVATE_FORM },
    activationSummary: null,
    registrationRequests: [],
    memberAccessAccounts: [],
    memberComments: buildInitialMemberComments(INITIAL_MEMBERS.map(normalizeMemberRecord)),
    registrationApprovalDrafts: {},
    registrationActionErrors: {},
    currentView: 'admin',
    memberTab: 'dashboard',
    adminTab: 'dashboard',
    memberStatusFilter: 'all',
    newMemberForm: { ...DEFAULT_NEW_MEMBER_FORM },
    schedulePublication: { ...DEFAULT_SCHEDULE_PUBLICATION },
    engineProgress: { ...DEFAULT_ENGINE_PROGRESS },
    selectedShiftChangeSource: '',
    expandedMemberRequestId: '',
    shiftChangeSubmittedFlash: false,
    memberShiftChangeError: '',
    shiftChangeForm: { ...DEFAULT_SHIFT_CHANGE_FORM },
    shiftChangeRequests: [],
    adminShiftDrafts: {},
    adminShiftActionErrors: {},
    dbStatus: 'Browser storage: local mode',
    dbBusy: false,
  };
}

export function MockStateProvider({ children, externalSession, onExternalSignOut }) {
  const defaultsRef = useRef(getDefaultState());
  const defaults = defaultsRef.current;

  const [members, setMembers] = useState(defaults.members);
  const [cycle, setCycle] = useState(defaults.cycle);
  const [queue, setQueue] = useState(defaults.queue);
  const [config, setConfig] = useState(defaults.config);
  const [preferences, setPreferences] = useState(defaults.preferences);
  const [results, setResults] = useState(defaults.results);
  const [internalSession, setInternalSession] = useState(defaults.session);
  const session = externalSession !== undefined ? externalSession : internalSession;
  const setSession = externalSession !== undefined ? () => {} : setInternalSession;
  const [authScreen, setAuthScreen] = useState(defaults.authScreen);
  const [loginForm, setLoginForm] = useState(defaults.loginForm);
  const [loginError, setLoginError] = useState(defaults.loginError);
  const [activateToken, setActivateToken] = useState(defaults.activateToken);
  const [activateForm, setActivateForm] = useState(defaults.activateForm);
  const [activationSummary, setActivationSummary] = useState(defaults.activationSummary);
  const [registrationRequests, setRegistrationRequests] = useState(defaults.registrationRequests);
  const [memberAccessAccounts, setMemberAccessAccounts] = useState(defaults.memberAccessAccounts);
  const [memberComments, setMemberComments] = useState(defaults.memberComments);
  const [registrationApprovalDrafts, setRegistrationApprovalDrafts] = useState(defaults.registrationApprovalDrafts);
  const [registrationActionErrors, setRegistrationActionErrors] = useState(defaults.registrationActionErrors);
  const [currentView, setCurrentView] = useState(defaults.currentView);
  const [memberTab, setMemberTab] = useState(defaults.memberTab);
  const [adminTab, setAdminTab] = useState(defaults.adminTab);
  const [memberStatusFilter, setMemberStatusFilter] = useState(defaults.memberStatusFilter);
  const [newMemberForm, setNewMemberForm] = useState(defaults.newMemberForm);
  const [schedulePublication, setSchedulePublication] = useState(defaults.schedulePublication);
  const [engineProgress, setEngineProgress] = useState(defaults.engineProgress);
  const [selectedShiftChangeSource, setSelectedShiftChangeSource] = useState(defaults.selectedShiftChangeSource);
  const [expandedMemberRequestId, setExpandedMemberRequestId] = useState(defaults.expandedMemberRequestId);
  const [shiftChangeSubmittedFlash, setShiftChangeSubmittedFlash] = useState(defaults.shiftChangeSubmittedFlash);
  const [memberShiftChangeError, setMemberShiftChangeError] = useState(defaults.memberShiftChangeError);
  const [shiftChangeForm, setShiftChangeForm] = useState(defaults.shiftChangeForm);
  const [shiftChangeRequests, setShiftChangeRequests] = useState(defaults.shiftChangeRequests);
  const [adminShiftDrafts, setAdminShiftDrafts] = useState(defaults.adminShiftDrafts);
  const [adminShiftActionErrors, setAdminShiftActionErrors] = useState(defaults.adminShiftActionErrors);
  const [dbStatus, setDbStatus] = useState(defaults.dbStatus);
  const [dbBusy, setDbBusy] = useState(defaults.dbBusy);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const demoBaselineRef = useRef(deriveDemoBaselineSnapshot(currentRunSnapshot));
  const prevExternalSessionRef = useRef(externalSession);

  const testAccounts = useMemo(() => buildTestAccounts(members, memberAccessAccounts), [members, memberAccessAccounts]);
  const isAdminSession = session?.role === 'admin';
  const membersRef = useRef(members);
  membersRef.current = members;
  const isAuthenticated = session !== null;
  const queryClient = useQueryClient();
  void queryClient;
  const serverSync = useServerSync({
    isAuthenticated,
    setMembers,
    setCycle,
    setPreferences,
    setQueue,
    setResults,
    setSchedulePublication,
    membersRef,
  });
  const memberDirectory = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member])),
    [members],
  );

  useEffect(() => {
    if (externalSession === undefined || serverSync.commentsQuery?.data === undefined) return;
    setMemberComments(mapServerCommentsToMemberComments(serverSync.commentsQuery.data, members));
  }, [externalSession, serverSync.commentsQuery?.data, members]);

  useEffect(() => {
    if (externalSession === undefined || serverSync.swapRequestsQuery?.data === undefined) return;
    setShiftChangeRequests(mapServerSwapRequestsToShiftChangeRequests(serverSync.swapRequestsQuery.data, members));
  }, [externalSession, serverSync.swapRequestsQuery?.data, members]);

  useEffect(() => {
    if (!session) return;
    if (session.role === 'admin') {
      if (currentView !== 'admin' && !members.some((member) => member.id === currentView)) {
        setCurrentView('admin');
      }
      return;
    }
    if (externalSession !== undefined && !serverSync.dataReady) {
      return;
    }
    const signedInMember = members.find((member) => member.id === session.memberId);
    if (!signedInMember) {
      setSession(null);
      setLoginError('This account is no longer available. Contact admin.');
      setCurrentView('admin');
      return;
    }
    if (signedInMember.status !== 'ACTIVE') {
      setSession(null);
      setLoginError('This account is not active. Contact admin@ser-cat.org.');
      setCurrentView('admin');
      return;
    }
    if (currentView !== session.memberId) {
      setCurrentView(session.memberId);
    }
  }, [session, currentView, members, externalSession, serverSync.dataReady]);

  const resetScheduleArtifacts = useCallback(() => {
    setResults(null);
    setSchedulePublication({ ...DEFAULT_SCHEDULE_PUBLICATION });
    setShiftChangeRequests([]);
    setAdminShiftDrafts({});
    setAdminShiftActionErrors({});
    setSelectedShiftChangeSource('');
    setExpandedMemberRequestId('');
    setShiftChangeSubmittedFlash(false);
    setMemberShiftChangeError('');
    setShiftChangeForm({ ...DEFAULT_SHIFT_CHANGE_FORM });
  }, []);

  const resetEphemeralUiState = useCallback(() => {
    setSession(null);
    setAuthScreen('login');
    setLoginForm({ ...DEFAULT_LOGIN_FORM });
    setLoginError('');
    setActivateToken('');
    setActivateForm({ ...DEFAULT_ACTIVATE_FORM });
    setActivationSummary(null);
    setRegistrationApprovalDrafts({});
    setRegistrationActionErrors({});
    setMemberStatusFilter('all');
    setNewMemberForm({ ...DEFAULT_NEW_MEMBER_FORM });
    setEngineProgress({ ...DEFAULT_ENGINE_PROGRESS });
    setSelectedShiftChangeSource('');
    setExpandedMemberRequestId('');
    setShiftChangeSubmittedFlash(false);
    setMemberShiftChangeError('');
    setShiftChangeForm({ ...DEFAULT_SHIFT_CHANGE_FORM });
    setAdminShiftDrafts({});
    setAdminShiftActionErrors({});
  }, []);

  useEffect(() => {
    if (isAuthenticated && serverSync.dataReady) {
      setDbStatus('Connected to SERCAT database');
    }
  }, [isAuthenticated, serverSync.dataReady]);

  useEffect(() => {
    if (externalSession === undefined) return;
    const prev = prevExternalSessionRef.current;
    prevExternalSessionRef.current = externalSession;

    if (externalSession && !prev) {
      if (externalSession.role === 'admin') {
        setCurrentView('admin');
        setAdminTab('dashboard');
      } else if (externalSession.memberId) {
        setCurrentView(externalSession.memberId);
        setMemberTab('dashboard');
      }
    }

    if (!externalSession && prev) {
      resetEphemeralUiState();
      setCurrentView('admin');
      setAdminTab('dashboard');
      setMemberTab('dashboard');
    }
  }, [externalSession, resetEphemeralUiState]);

  const buildSnapshot = useCallback((overrides = {}) => ({
    members,
    cycle,
    queue,
    config,
    preferences,
    results,
    currentView,
    memberTab,
    adminTab,
    schedulePublication,
    shiftChangeRequests,
    registrationRequests,
    memberAccessAccounts,
    memberComments,
    algorithm: {
      ...ALGORITHM_PROFILE,
      capturedAt: new Date().toISOString(),
      sourceHash: simpleHash('server-scheduling-api'),
      configSnapshot: { ...(overrides.config || config) },
      source: 'server-scheduling-api',
    },
    ...overrides,
  }), [
    members,
    cycle,
    queue,
    config,
    preferences,
    results,
    currentView,
    memberTab,
    adminTab,
    schedulePublication,
    shiftChangeRequests,
    registrationRequests,
    memberAccessAccounts,
    memberComments,
  ]);

  const applySnapshot = useCallback((snapshot, sourceLabel = 'Loaded local state') => {
    const loadedMembers = Array.isArray(snapshot?.members) && snapshot.members.length > 0
      ? snapshot.members.map(normalizeMemberRecord)
      : INITIAL_MEMBERS.map(normalizeMemberRecord);

    loadedMembers.forEach((member, idx) => ensureMemberPalette(member.id, idx));

    const normalizedPreferences = {};
    loadedMembers.forEach((member) => {
      normalizedPreferences[member.id] = normalizeMemberPreferences(
        member,
        snapshot?.preferences?.[member.id] || {},
      );
    });

    setMembers(loadedMembers);
    setCycle({ ...INITIAL_CYCLE, ...(snapshot?.cycle || {}) });
    setQueue(Array.isArray(snapshot?.queue) ? snapshot.queue : []);
    setConfig({ ...DEFAULT_CONFIG, ...(snapshot?.config || {}) });
    setPreferences(normalizedPreferences);

    const loadedResults = snapshot?.results;
    const hasValidResultsShape = Boolean(
      loadedResults
      && Array.isArray(loadedResults.assignments)
      && Array.isArray(loadedResults.engineLog)
      && loadedResults.fairness
      && Array.isArray(loadedResults.fairness.memberSatisfaction),
    );
    setResults(hasValidResultsShape ? normalizeLoadedResultsShape(loadedResults) : null);

    const view = snapshot?.currentView;
    setCurrentView(view === 'admin' || loadedMembers.some((member) => member.id === view) ? view : 'admin');

    const legacyTab = snapshot?.adminTab;
    const adminTabMap = { overview: 'dashboard', availability: 'cycle', calendar: 'engine' };
    const nextAdminTab = adminTabMap[legacyTab] || legacyTab || 'dashboard';
    const validAdminTabs = new Set(ADMIN_PORTAL_TABS.map((tab) => tab.id));
    setAdminTab(validAdminTabs.has(nextAdminTab) ? nextAdminTab : 'dashboard');

    const validMemberTabs = new Set(MEMBER_PORTAL_TABS.map((tab) => tab.id));
    setMemberTab(validMemberTabs.has(snapshot?.memberTab) ? snapshot.memberTab : 'dashboard');

    const loadedPublication = snapshot?.schedulePublication || {};
    const normalizedStatus = loadedPublication.status === 'published' ? 'published' : 'draft';
    setSchedulePublication({
      status: normalizedStatus,
      draftedAt: loadedPublication.draftedAt || '',
      publishedAt: normalizedStatus === 'published' ? (loadedPublication.publishedAt || '') : '',
    });

    setShiftChangeRequests(normalizeShiftChangeRequests(snapshot?.shiftChangeRequests));
    setRegistrationRequests(normalizeRegistrationRequests(snapshot?.registrationRequests));
    setMemberAccessAccounts(normalizeMemberAccessAccounts(snapshot?.memberAccessAccounts));
    setMemberComments(normalizeMemberComments(
      snapshot?.memberComments || buildInitialMemberComments(loadedMembers),
      loadedMembers,
    ));
    setActivateToken('');
    setActivateForm({ ...DEFAULT_ACTIVATE_FORM });
    setActivationSummary(null);
    setRegistrationApprovalDrafts({});
    setRegistrationActionErrors({});
    setAdminShiftDrafts({});
    setAdminShiftActionErrors({});
    setDbStatus(sourceLabel);
  }, []);

  const saveStateToStorage = useCallback((snapshot, label = 'manual-save', options = {}) => {
    void options;
    setDbBusy(true);
    try {
      const ok = saveStoredSnapshot(snapshot);
      const stamp = new Date().toLocaleString();
      setDbStatus(ok ? `Local save: ${label} | ${stamp}` : 'Local save failed');
      return ok;
    } finally {
      setDbBusy(false);
    }
  }, []);

  const saveCurrentToDatabase = useCallback(() => {
    if (externalSession !== undefined) {
      setDbStatus('Connected to SERCAT database');
      return;
    }
    saveStateToStorage(buildSnapshot(), 'manual-save');
  }, [externalSession, buildSnapshot, saveStateToStorage]);

  const loadFromDatabase = useCallback(() => {
    if (externalSession !== undefined) {
      serverSync.refetchAll();
      setDbStatus('Refreshed from SERCAT database');
      return true;
    }
    setDbBusy(true);
    try {
      const snapshot = loadStoredSnapshot();
      if (!snapshot) {
        applySnapshot(demoBaselineRef.current, 'Loaded standard demo baseline');
        return true;
      }
      applySnapshot(snapshot, `Local load: ${new Date().toLocaleString()}`);
      return true;
    } finally {
      setDbBusy(false);
    }
  }, [externalSession, serverSync.refetchAll, applySnapshot]);

  useEffect(() => {
    if (hasLoadedSnapshot) return;
    if (externalSession !== undefined) {
      setHasLoadedSnapshot(true);
      return;
    }
    const storedSnapshot = loadStoredSnapshot();
    if (storedSnapshot) {
      applySnapshot(storedSnapshot, 'Loaded from browser storage');
    } else {
      demoBaselineRef.current = deriveDemoBaselineSnapshot(currentRunSnapshot);
      applySnapshot(demoBaselineRef.current, 'Loaded standard demo baseline');
    }
    setHasLoadedSnapshot(true);
  }, [applySnapshot, hasLoadedSnapshot, externalSession]);

  useEffect(() => {
    if (!hasLoadedSnapshot || externalSession !== undefined) return;
    saveStoredSnapshot(buildSnapshot());
  }, [hasLoadedSnapshot, externalSession, buildSnapshot]);

  const resetToDemoBaseline = useCallback(() => {
    if (externalSession !== undefined) {
      serverSync.refetchAll();
      return;
    }
    demoBaselineRef.current = deriveDemoBaselineSnapshot(currentRunSnapshot);
    clearStoredSnapshot();
    resetEphemeralUiState();
    applySnapshot(demoBaselineRef.current, 'Reset to standard demo baseline');
    saveStoredSnapshot(demoBaselineRef.current);
  }, [externalSession, serverSync.refetchAll, applySnapshot, resetEphemeralUiState]);

  const handleSignIn = useCallback((event) => {
    if (externalSession !== undefined) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const loginKey = normalizeLoginKey(loginForm.username);
    const username = sanitizeUsername(loginForm.username);
    const password = String(loginForm.password || '');

    if (!loginKey || !password) {
      setLoginError('Enter both login and password.');
      return;
    }

    if (loginKey === normalizeLoginKey(testAccounts.admin.username) && password === testAccounts.admin.password) {
      setSession({ role: 'admin', username: loginKey });
      setCurrentView('admin');
      setAdminTab('dashboard');
      setMemberTab('dashboard');
      setLoginForm({ username: '', password: '' });
      setLoginError('');
      setAuthScreen('login');
      return;
    }

    const memberAccount = testAccounts.membersByLogin[loginKey] || testAccounts.membersByUsername[username];
    if (memberAccount && memberAccount.password === password) {
      setSession({ role: 'member', username: memberAccount.username || loginKey, memberId: memberAccount.memberId });
      setCurrentView(memberAccount.memberId);
      setMemberTab('dashboard');
      setLoginForm({ username: '', password: '' });
      setLoginError('');
      setAuthScreen('login');
      return;
    }

    const invitedMember = members.find(
      (member) => normalizeEmail(member.piEmail) === loginKey && member.status === 'INVITED',
    );
    if (invitedMember) {
      setLoginError('Your account has not been activated yet. Check your email for the activation link, or click "Activate your account" below.');
      return;
    }

    const deactivatedMember = members.find(
      (member) => normalizeEmail(member.piEmail) === loginKey && member.status === 'DEACTIVATED',
    );
    if (deactivatedMember) {
      setLoginError('This account is deactivated. Contact admin@ser-cat.org.');
      return;
    }

    setLoginError('Invalid email or password.');
  }, [externalSession, loginForm, members, testAccounts]);

  const handleSSOSignIn = useCallback(() => {
    setLoginError('SSO is shown in prototype mode. Please use username/password for this local demo.');
  }, []);

  const handleActivate = useCallback((event) => {
    if (externalSession !== undefined) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const token = activateToken.trim();
    const { password, confirmPassword, phone } = activateForm;
    const now = new Date().toISOString();
    const member = members.find((entry) => entry.inviteToken === token && entry.status === 'INVITED');

    if (!member) {
      setLoginError('Invalid or expired activation link. Contact admin@ser-cat.org.');
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

    const email = normalizeEmail(member.piEmail);
    const activatedMember = normalizeMemberRecord({
      ...member,
      status: 'ACTIVE',
      piPhone: phone || member.piPhone,
      inviteToken: null,
      activatedAt: now,
    });

    const accessAccount = normalizeMemberAccessAccount({
      id: `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      memberId: member.id,
      email,
      username: email,
      password,
      status: 'ACTIVE',
      createdAt: now,
      approvedFromRequestId: '',
    });

    setMemberAccessAccounts((prev) => [
      ...prev.map((account) => (
        account.memberId === member.id || normalizeEmail(account.email) === email
          ? { ...account, status: 'INACTIVE' }
          : account
      )),
      accessAccount,
    ]);
    setMembers((prev) => prev.map((entry) => (entry.id === member.id ? activatedMember : entry)));
    setPreferences((prev) => ({
      ...prev,
      [member.id]: normalizeMemberPreferences(activatedMember, prev[member.id]),
    }));
    setQueue((prev) => {
      if (prev.some((entry) => entry.memberId === member.id)) return prev;
      const meanDeficit = prev.length > 0 ? prev.reduce((sum, entry) => sum + entry.deficitScore, 0) / prev.length : 0;
      const insertAt = Math.ceil(prev.length / 2);
      const next = [...prev];
      next.splice(insertAt, 0, {
        memberId: member.id,
        deficitScore: parseFloat(meanDeficit.toFixed(4)),
        cycleWins: 0,
        roundWins: 0,
      });
      return next;
    });
    resetScheduleArtifacts();
    setLoginError('');
    setActivateToken('');
    setActivateForm({ ...DEFAULT_ACTIVATE_FORM });
    setActivationSummary(buildActivationSummary(activatedMember));
    setAuthScreen('activateSuccess');
  }, [externalSession, activateForm, activateToken, members, resetScheduleArtifacts]);

  const handleSignOut = useCallback(() => {
    if (onExternalSignOut) {
      void onExternalSignOut();
      return;
    }
    resetEphemeralUiState();
    setCurrentView('admin');
    setAdminTab('dashboard');
    setMemberTab('dashboard');
  }, [resetEphemeralUiState, onExternalSignOut]);

  const updatePreference = useCallback((memberId, prefs) => {
    setPreferences((prev) => ({ ...prev, [memberId]: prefs }));
    const member = members.find((m) => m.id === memberId);
    const cycleId = cycle._dbId;
    if (externalSession !== undefined && member?._piUserId && cycleId) {
      const wholePrefs = Array.isArray(prefs.wholeShare) ? prefs.wholeShare : [];
      const fractionalPrefs = Array.isArray(prefs.fractionalPreferences) ? prefs.fractionalPreferences : [];
      const apiPrefs = wholePrefs
        .filter((p) => p.choice1Date || p.choice2Date)
        .map((p) => ({
          shareIndex: p.shareIndex,
          shift: p.shift,
          choice1Date: p.choice1Date || null,
          choice2Date: p.choice2Date || null,
        }));
      const apiFractionalPrefs = fractionalPrefs
        .filter((p) => p.choice1Date || p.choice2Date)
        .map((p) => ({
          blockIndex: p.blockIndex,
          fractionalHours: p.fractionalHours,
          choice1Date: p.choice1Date || null,
          choice2Date: p.choice2Date || null,
        }));

      void api.post(`/cycles/${cycleId}/preferences`, {
        preferences: apiPrefs,
        fractionalPreferences: apiFractionalPrefs,
      }).catch((err) => {
        console.error('Failed to persist preferences:', err);
      });
    }
  }, [members, cycle._dbId, externalSession]);

  const updateMember = useCallback((memberId, patch) => {
    const nextStatus = patch.status ? String(patch.status).toUpperCase() : '';
    const shouldResetSchedule = patch.shares !== undefined || Boolean(nextStatus);

    setMembers((prevMembers) => {
      let updatedMember = null;
      let sharesChanged = false;
      let statusChanged = false;
      const next = prevMembers.map((member) => {
        if (member.id !== memberId) return member;
        const nextShares = patch.shares !== undefined
          ? Math.max(0, parseFloat((Number(patch.shares) || 0).toFixed(2)))
          : member.shares;
        sharesChanged = patch.shares !== undefined && nextShares !== member.shares;
        statusChanged = Boolean(nextStatus) && nextStatus !== member.status;
        updatedMember = normalizeMemberRecord({
          ...member,
          ...patch,
          shares: nextShares,
          status: nextStatus || member.status,
          piEmail: patch.piEmail !== undefined ? normalizeEmail(patch.piEmail) : member.piEmail,
        });
        return updatedMember;
      });
      if (updatedMember && (sharesChanged || statusChanged)) {
        setPreferences((prevPrefs) => ({
          ...prevPrefs,
          [memberId]: { ...normalizeMemberPreferences(updatedMember, prevPrefs[memberId]), submitted: false },
        }));
      }
      return next;
    });

    if (nextStatus === 'ACTIVE') {
      setQueue((prev) => {
        if (prev.some((entry) => entry.memberId === memberId)) return prev;
        const meanDeficit = prev.length > 0 ? prev.reduce((sum, entry) => sum + entry.deficitScore, 0) / prev.length : 0;
        const insertAt = Math.ceil(prev.length / 2);
        const next = [...prev];
        next.splice(insertAt, 0, {
          memberId,
          deficitScore: parseFloat(meanDeficit.toFixed(4)),
          cycleWins: 0,
          roundWins: 0,
        });
        return next;
      });
    }
    if (nextStatus && nextStatus !== 'ACTIVE') {
      setQueue((prev) => prev.filter((entry) => entry.memberId !== memberId));
    }
    if (shouldResetSchedule) {
      resetScheduleArtifacts();
    }

    if (externalSession !== undefined && patch.shares !== undefined) {
      const member = members.find((m) => m.id === memberId);
      if (member?._shareId) {
        const newShares = Math.max(0, parseFloat((Number(patch.shares) || 0).toFixed(2)));
        const newWhole = Math.floor(newShares);
        const newFrac = parseFloat((newShares - newWhole).toFixed(2));
        void api.put(`/shares/${member._shareId}`, {
          wholeShares: newWhole,
          fractionalShares: newFrac,
        }).then(() => {
          serverSync.refetchAll();
        }).catch((err) => {
          console.error('Failed to update share:', err);
        });
      }
    }
  }, [externalSession, members, resetScheduleArtifacts, serverSync]);

  const saveMemberProfile = useCallback((memberId, patch) => {
    const member = members.find((entry) => entry.id === memberId);
    if (!member) {
      return { ok: false, error: 'Member record not found.' };
    }

    const nextPiName = String(patch.piName ?? member.piName ?? '').trim();
    const nextPiPhone = String(patch.piPhone ?? member.piPhone ?? '').trim();
    const nextPiRole = String(patch.piRole ?? member.piRole ?? '').trim();
    const emailChanged = patch.piEmail !== undefined;
    const nextPiEmail = emailChanged ? normalizeEmail(patch.piEmail) : member.piEmail;

    if (!nextPiName) {
      return { ok: false, error: 'PI name is required.' };
    }
    if (!nextPiEmail || !isValidEmail(nextPiEmail)) {
      return { ok: false, error: 'Enter a valid PI email address.' };
    }

    const duplicateMember = members.some(
      (entry) => entry.id !== memberId && entry.status !== 'DEACTIVATED' && normalizeEmail(entry.piEmail) === nextPiEmail,
    );
    const duplicateAccess = memberAccessAccounts.some(
      (account) => account.memberId !== memberId && account.status === 'ACTIVE' && normalizeEmail(account.email) === nextPiEmail,
    );
    if (duplicateMember || duplicateAccess) {
      return { ok: false, error: 'That PI email is already in use.' };
    }

    updateMember(memberId, {
      piName: nextPiName,
      piEmail: nextPiEmail,
      piPhone: nextPiPhone,
      piRole: nextPiRole,
    });

    if (emailChanged) {
      setMemberAccessAccounts((prev) => prev.map((account) => (
        account.memberId === memberId && account.status === 'ACTIVE'
          ? normalizeMemberAccessAccount({
            ...account,
            email: nextPiEmail,
            username: nextPiEmail,
          })
          : account
      )));
      setSession((prev) => (
        prev?.role === 'member' && prev.memberId === memberId
          ? { ...prev, username: nextPiEmail }
          : prev
      ));
    }

    return { ok: true };
  }, [memberAccessAccounts, members, updateMember]);

  const submitMemberComment = useCallback((memberId, payload) => {
    const member = members.find((entry) => entry.id === memberId);
    if (!member) {
      return { ok: false, error: 'Member record not found.' };
    }

    const subject = String(payload.subject || '').trim();
    const message = String(payload.message || '').trim();
    if (!subject) {
      return { ok: false, error: 'Subject is required.' };
    }
    if (!message) {
      return { ok: false, error: 'Message is required.' };
    }

    if (externalSession !== undefined) {
      void api.post('/comments', { subject, message })
        .then(() => serverSync.commentsQuery?.refetch?.())
        .catch((err) => console.error('Failed to submit comment:', err));

      return { ok: true, comment: { subject, message } };
    }

    const now = new Date().toISOString();
    const nextComment = {
      id: `CMT-${memberId}-${Date.now()}`,
      memberId,
      subject,
      message,
      status: 'Sent',
      createdAt: now,
      updatedAt: now,
      readAt: '',
      adminReply: '',
      adminReplyAt: '',
    };

    setMemberComments((prev) => ({
      ...prev,
      [memberId]: [
        normalizeMemberComments({ [memberId]: [nextComment] }, [member])[memberId][0],
        ...(prev[memberId] || []),
      ],
    }));

    return { ok: true, comment: nextComment };
  }, [externalSession, members, serverSync]);

  const markMemberCommentRead = useCallback((memberId, commentId) => {
    const member = members.find((entry) => entry.id === memberId);
    if (!member) {
      return { ok: false, error: 'Member record not found.' };
    }

    const existingComment = (memberComments[memberId] || []).find((entry) => entry.id === commentId);
    if (!existingComment) {
      return { ok: false, error: 'Comment not found.' };
    }
    if (existingComment.status !== 'Sent') {
      return { ok: true, comment: existingComment };
    }

    if (externalSession !== undefined) {
      void api.put(`/comments/${commentId}`, { status: 'read' })
        .then(() => serverSync.commentsQuery?.refetch?.())
        .catch((err) => console.error('Failed to mark comment read:', err));

      return { ok: true, comment: existingComment };
    }

    const now = new Date().toISOString();
    const updatedComment = normalizeMemberComments({
      [memberId]: [{
        ...existingComment,
        status: 'Read',
        readAt: existingComment.readAt || now,
        updatedAt: now,
      }],
    }, [member])[memberId][0];

    setMemberComments((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] || []).map((entry) => (
        entry.id === commentId ? updatedComment : entry
      )),
    }));

    return { ok: true, comment: updatedComment };
  }, [externalSession, memberComments, members, serverSync]);

  const replyToMemberComment = useCallback((memberId, commentId, replyText) => {
    const member = members.find((entry) => entry.id === memberId);
    if (!member) {
      return { ok: false, error: 'Member record not found.' };
    }

    const existingComment = (memberComments[memberId] || []).find((entry) => entry.id === commentId);
    if (!existingComment) {
      return { ok: false, error: 'Comment not found.' };
    }

    const adminReply = String(replyText || '').trim();
    if (!adminReply) {
      return { ok: false, error: 'Reply message is required.' };
    }

    if (externalSession !== undefined) {
      void api.put(`/comments/${commentId}`, { adminReply })
        .then(() => serverSync.commentsQuery?.refetch?.())
        .catch((err) => console.error('Failed to reply to comment:', err));

      return { ok: true, comment: { adminReply } };
    }

    const now = new Date().toISOString();
    const updatedComment = normalizeMemberComments({
      [memberId]: [{
        ...existingComment,
        status: 'Replied',
        readAt: existingComment.readAt || now,
        adminReply,
        adminReplyAt: now,
        updatedAt: now,
      }],
    }, [member])[memberId][0];

    setMemberComments((prev) => ({
      ...prev,
      [memberId]: (prev[memberId] || []).map((entry) => (
        entry.id === commentId ? updatedComment : entry
      )),
    }));

    return { ok: true, comment: updatedComment };
  }, [externalSession, memberComments, members, serverSync]);

  const setRegistrationApprovalDraft = useCallback((requestId, patch) => {
    setRegistrationApprovalDrafts((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        ...patch,
      },
    }));
    setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, []);

  const approveRegistrationRequest = useCallback((requestId) => {
    const request = registrationRequests.find((entry) => entry.id === requestId);
    if (!request || request.status !== 'Pending') return;

    const institution = members.find((member) => member.id === request.institutionMemberId);
    if (!institution) {
      setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: 'Institution account no longer exists.' }));
      return;
    }

    const draft = registrationApprovalDrafts[requestId] || {};
    const approvedShares = parseFloat(draft.approvedShares || request.requestedShares);
    if (!Number.isFinite(approvedShares) || approvedShares <= 0) {
      setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: 'Approved shares must be greater than 0.' }));
      return;
    }

    const email = normalizeEmail(request.institutionalEmail);
    if (!isValidEmail(email)) {
      setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: 'Institutional email is invalid.' }));
      return;
    }

    const hasDuplicate = memberAccessAccounts.some((account) =>
      account.status === 'ACTIVE' && normalizeEmail(account.email) === email);
    if (hasDuplicate) {
      setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: 'This email already has approved access.' }));
      return;
    }

    const localPartBase = sanitizeUsername(email.split('@')[0]) || sanitizeUsername(request.institutionMemberId) || 'member';
    const existingPasswords = new Set(memberAccessAccounts.map((account) => String(account.password || '')));
    let generatedPassword = `${localPartBase}@123`;
    let suffix = 2;
    while (existingPasswords.has(generatedPassword)) {
      generatedPassword = `${localPartBase}${suffix}@123`;
      suffix += 1;
    }

    const createdAt = new Date().toISOString();
    const accessAccount = normalizeMemberAccessAccount({
      id: `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      memberId: request.institutionMemberId,
      email,
      username: email,
      password: generatedPassword,
      status: 'ACTIVE',
      createdAt,
      approvedFromRequestId: request.id,
    });

    setMemberAccessAccounts((prev) => [...prev, accessAccount]);
    updateMember(request.institutionMemberId, {
      shares: approvedShares,
      status: 'ACTIVE',
      piEmail: institution.piEmail || email,
      activatedAt: institution.activatedAt || createdAt,
    });
    const resetInstitutionMember = normalizeMemberRecord({
      ...institution,
      shares: parseFloat(approvedShares.toFixed(2)),
      status: 'ACTIVE',
      piEmail: institution.piEmail || email,
      activatedAt: institution.activatedAt || createdAt,
    });
    setPreferences((prev) => ({
      ...prev,
      [request.institutionMemberId]: normalizeMemberPreferences(resetInstitutionMember, {}),
    }));
    resetScheduleArtifacts();
    setRegistrationRequests((prev) => prev.map((entry) => (
      entry.id === requestId
        ? {
          ...entry,
          status: 'Approved',
          resolvedAt: createdAt,
          adminNote: String(draft.adminNote || '').trim(),
          requestedShares: parseFloat(approvedShares.toFixed(2)),
        }
        : entry
    )));
    setRegistrationApprovalDrafts((prev) => {
      if (!prev[requestId]) return prev;
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, [registrationRequests, registrationApprovalDrafts, memberAccessAccounts, members, resetScheduleArtifacts, updateMember]);

  const rejectRegistrationRequest = useCallback((requestId) => {
    const request = registrationRequests.find((entry) => entry.id === requestId);
    if (!request || request.status !== 'Pending') return;
    const draft = registrationApprovalDrafts[requestId] || {};
    const resolvedAt = new Date().toISOString();

    setRegistrationRequests((prev) => prev.map((entry) => (
      entry.id === requestId
        ? {
          ...entry,
          status: 'Rejected',
          resolvedAt,
          adminNote: String(draft.adminNote || '').trim(),
        }
        : entry
    )));
    setRegistrationApprovalDrafts((prev) => {
      if (!prev[requestId]) return prev;
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setRegistrationActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, [registrationRequests, registrationApprovalDrafts]);

  const validateInviteDetails = useCallback((memberId, details) => {
    const piName = String(details?.piName || '').trim();
    if (!piName) {
      return { ok: false, error: 'PI name is required.' };
    }

    const piEmail = normalizeEmail(details?.piEmail);
    if (!isValidEmail(piEmail)) {
      return { ok: false, error: 'A valid PI email is required.' };
    }

    const duplicateMember = members.some(
      (entry) => entry.id !== memberId && entry.status !== 'DEACTIVATED' && normalizeEmail(entry.piEmail) === piEmail,
    );
    const duplicateAccess = memberAccessAccounts.some(
      (account) => account.memberId !== memberId && account.status === 'ACTIVE' && normalizeEmail(account.email) === piEmail,
    );
    if (duplicateMember || duplicateAccess) {
      return { ok: false, error: 'That PI email is already in use.' };
    }

    return { ok: true, details: { piName, piEmail } };
  }, [memberAccessAccounts, members]);

  const resendMemberInvite = useCallback((memberId) => {
    const member = members.find((entry) => entry.id === memberId && entry.status === 'INVITED');
    if (!member) {
      return { ok: false, error: 'Pending invite not found.' };
    }

    const inviteToken = buildInviteToken(member.id);
    const invitedAt = new Date().toISOString();
    updateMember(memberId, { inviteToken, invitedAt, activatedAt: null });

    if (externalSession !== undefined && member._piUserId) {
      void api.post(`/users/${member._piUserId}/resend-invite`, { activationToken: inviteToken })
        .then(() => serverSync.refetchAll())
        .catch((err) => {
          console.error('Failed to resend invite:', err);
        });
    }

    return {
      ok: true,
      inviteToken,
      piName: member.piName || member.id,
      piEmail: member.piEmail || '',
    };
  }, [externalSession, members, updateMember, serverSync]);

  const cancelMemberInvite = useCallback((memberId) => {
    const member = members.find((entry) => entry.id === memberId && entry.status === 'INVITED');
    if (!member) {
      return { ok: false, error: 'Pending invite not found.' };
    }

    updateMember(memberId, {
      status: 'DEACTIVATED',
      inviteToken: null,
      invitedAt: null,
      activatedAt: null,
      piPhone: '',
      piRole: '',
    });
    setMemberAccessAccounts((prev) => prev.map((account) => (
      account.memberId === memberId ? { ...account, status: 'INACTIVE' } : account
    )));

    if (externalSession !== undefined && member._piUserId) {
      void api.delete(`/users/${member._piUserId}`)
        .then(() => serverSync.refetchAll())
        .catch((err) => {
          console.error('Failed to cancel invite:', err);
        });
    }

    return { ok: true };
  }, [externalSession, members, updateMember, serverSync]);

  const deactivateMember = useCallback((memberId) => {
    const member = members.find((entry) => entry.id === memberId && entry.status === 'ACTIVE');
    if (!member) {
      return { ok: false, error: 'Active member not found.' };
    }

    updateMember(memberId, {
      status: 'DEACTIVATED',
      inviteToken: null,
      invitedAt: null,
    });
    setMemberAccessAccounts((prev) => prev.map((account) => (
      account.memberId === memberId ? { ...account, status: 'INACTIVE' } : account
    )));

    if (externalSession !== undefined && member._piUserId) {
      void api.delete(`/users/${member._piUserId}`)
        .then(() => serverSync.refetchAll())
        .catch((err) => {
          console.error('Failed to deactivate member:', err);
        });
    }

    return { ok: true };
  }, [externalSession, members, updateMember, serverSync]);

  const changeMemberPi = useCallback((memberId, nextDetails) => {
    const member = members.find((entry) => entry.id === memberId && entry.status === 'ACTIVE');
    if (!member) {
      return { ok: false, error: 'Active member not found.' };
    }

    const validation = validateInviteDetails(memberId, nextDetails);
    if (!validation.ok) {
      return validation;
    }
    const details = validation.details;

    const inviteToken = buildInviteToken(member.id);
    const invitedAt = new Date().toISOString();
    updateMember(memberId, {
      ...details,
      status: 'INVITED',
      piPhone: '',
      piRole: '',
      inviteToken,
      invitedAt,
      activatedAt: null,
    });
    setMemberAccessAccounts((prev) => prev.map((account) => (
      account.memberId === memberId ? { ...account, status: 'INACTIVE' } : account
    )));

    if (externalSession !== undefined && member._piUserId) {
      void api.put(`/users/${member._piUserId}`, {
        name: details.piName,
        email: details.piEmail,
        institutionId: member._institutionUuid || null,
        resetActivation: true,
        activationToken: inviteToken,
      }).then(() => {
        serverSync.refetchAll();
      }).catch((err) => {
        console.error('Failed to change PI:', err);
      });
    }

    return {
      ok: true,
      inviteToken,
      piName: details.piName,
      piEmail: details.piEmail,
    };
  }, [externalSession, members, updateMember, validateInviteDetails, serverSync]);

  const reinviteMember = useCallback((memberId, nextDetails) => {
    const member = members.find((entry) => entry.id === memberId && entry.status === 'DEACTIVATED');
    if (!member) {
      return { ok: false, error: 'Deactivated member not found.' };
    }

    const validation = validateInviteDetails(memberId, nextDetails);
    if (!validation.ok) {
      return validation;
    }
    const details = validation.details;

    const inviteToken = buildInviteToken(member.id);
    const invitedAt = new Date().toISOString();
    updateMember(memberId, {
      ...details,
      status: 'INVITED',
      piPhone: '',
      piRole: '',
      inviteToken,
      invitedAt,
      activatedAt: null,
    });
    setMemberAccessAccounts((prev) => prev.map((account) => (
      account.memberId === memberId ? { ...account, status: 'INACTIVE' } : account
    )));

    if (externalSession !== undefined && member._piUserId) {
      void api.put(`/users/${member._piUserId}`, {
        name: details.piName,
        email: details.piEmail,
        institutionId: member._institutionUuid || null,
        isActive: true,
        resetActivation: true,
        activationToken: inviteToken,
      }).then(() => {
        serverSync.refetchAll();
      }).catch((err) => {
        console.error('Failed to re-invite member:', err);
      });
    }

    return {
      ok: true,
      inviteToken,
      piName: details.piName,
      piEmail: details.piEmail,
    };
  }, [externalSession, members, updateMember, validateInviteDetails, serverSync]);

  const persistCycleChange = useCallback(async (patch) => {
    if (externalSession === undefined) return;
    const dbId = cycle._dbId;
    if (!dbId) return;

    try {
      if (patch.startDate || patch.endDate || patch.preferenceDeadline || patch.id) {
        await api.put(`/cycles/${dbId}`, {
          ...(patch.id !== undefined && { name: patch.id }),
          ...(patch.startDate !== undefined && { startDate: patch.startDate }),
          ...(patch.endDate !== undefined && { endDate: patch.endDate }),
          ...(patch.preferenceDeadline !== undefined && { preferenceDeadline: patch.preferenceDeadline }),
        });
      }
    } catch (err) {
      console.error('Failed to persist cycle change:', err);
    }
  }, [externalSession, cycle._dbId]);

  const cyclePersistTimer = useRef(null);
  const prevCycleRef = useRef(null);

  useEffect(() => {
    if (!cycle._dbId) return;
    if (!prevCycleRef.current) {
      prevCycleRef.current = cycle;
      return;
    }

    const prev = prevCycleRef.current;
    prevCycleRef.current = cycle;

    const changed = prev.id !== cycle.id
      || prev.startDate !== cycle.startDate
      || prev.endDate !== cycle.endDate
      || prev.preferenceDeadline !== cycle.preferenceDeadline;
    if (!changed) return;

    clearTimeout(cyclePersistTimer.current);
    cyclePersistTimer.current = setTimeout(() => {
      void persistCycleChange({
        id: cycle.id,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        preferenceDeadline: cycle.preferenceDeadline,
      });
    }, 1000);

    return () => clearTimeout(cyclePersistTimer.current);
  }, [
    cycle.id,
    cycle.startDate,
    cycle.endDate,
    cycle.preferenceDeadline,
    cycle._dbId,
    persistCycleChange,
  ]);

  const toggleDateBlocked = useCallback((date) => {
    setCycle((prev) => {
      const blockedDates = new Set(prev.blockedDates || []);
      if (blockedDates.has(date)) blockedDates.delete(date);
      else blockedDates.add(date);
      const next = { ...prev, blockedDates: [...blockedDates].sort() };

      if (externalSession !== undefined && prev._dbId) {
        const allDates = [];
        const start = new Date(prev.startDate);
        const end = new Date(prev.endDate);
        const blocked = new Set(next.blockedDates);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          allDates.push({ date: ds, isAvailable: !blocked.has(ds) });
        }
        void api.post(`/cycles/${prev._dbId}/dates`, { dates: allDates })
          .then(() => {
            serverSync.refetchAll();
          })
          .catch((err) => {
          console.error('Failed to persist date toggle:', err);
        });
      }

      return next;
    });
    setResults(null);
  }, [externalSession, serverSync]);

  const toggleSlotBlocked = useCallback((date, shift) => {
    setCycle((prev) => {
      const blockedSlots = new Set(prev.blockedSlots || []);
      const key = `${date}:${shift}`;
      if (blockedSlots.has(key)) blockedSlots.delete(key);
      else blockedSlots.add(key);
      return { ...prev, blockedSlots: [...blockedSlots].sort() };
    });
    setResults(null);
  }, []);

  const addMember = useCallback(() => {
    const id = newMemberForm.id.trim().toUpperCase().replace(/\s+/g, '');
    const name = newMemberForm.name.trim() || id;
    const shares = parseFloat(newMemberForm.shares);
    const piName = newMemberForm.piName.trim();
    const piEmail = normalizeEmail(newMemberForm.piEmail);

    if (!id) {
      return { ok: false, error: 'Enter a member ID.' };
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      return { ok: false, error: 'Shares must be greater than 0.' };
    }
    if (members.some((member) => member.id === id)) {
      return { ok: false, error: `Member ${id} already exists.` };
    }
    if (!piName) {
      return { ok: false, error: 'PI name is required.' };
    }
    if (!piEmail || !isValidEmail(piEmail)) {
      return { ok: false, error: 'A valid PI email is required.' };
    }
    if (members.some((member) => normalizeEmail(member.piEmail) === piEmail && member.status !== 'DEACTIVATED')) {
      return { ok: false, error: 'That PI email is already assigned to another member.' };
    }
    if (memberAccessAccounts.some((account) => account.status === 'ACTIVE' && normalizeEmail(account.email) === piEmail)) {
      return { ok: false, error: 'That PI email already has active member access.' };
    }

    ensureMemberPalette(id, members.length);
    const inviteToken = buildInviteToken(id);
    const invitedAt = new Date().toISOString();
    const member = normalizeMemberRecord({
      id,
      name,
      shares: parseFloat(shares.toFixed(2)),
      status: 'INVITED',
      registrationEnabled: true,
      piName,
      piEmail,
      piPhone: '',
      piRole: '',
      inviteToken,
      invitedAt,
      activatedAt: null,
    });
    setMembers((prev) => [...prev, member]);
    setPreferences((prev) => ({ ...prev, [id]: normalizeMemberPreferences(member, prev[id]) }));
    setCurrentView('admin');
    setLoginError('');
    setNewMemberForm({ ...DEFAULT_NEW_MEMBER_FORM });
    resetScheduleArtifacts();

    if (externalSession !== undefined) {
      const wholeShares = Math.floor(shares);
      const fractionalShares = parseFloat((shares - wholeShares).toFixed(2));
      void api.post('/shares/upload', {
        rows: [{
          institutionName: name,
          abbreviation: id,
          piName,
          piEmail,
          wholeShares,
          fractionalShares,
          activationToken: inviteToken,
        }],
      }).then(() => {
        serverSync.refetchAll();
      }).catch((err) => {
        console.error('Failed to create member:', err);
        setDbStatus('Failed to create member in SERCAT database');
      });
    }

    return {
      ok: true,
      memberId: id,
      inviteToken,
      piName,
      piEmail,
    };
  }, [externalSession, memberAccessAccounts, members, newMemberForm, resetScheduleArtifacts, serverSync]);

  const runEngine = useCallback(async () => {
    if (!isAdminSession) return;

    if (externalSession !== undefined && cycle._dbId) {
      setEngineProgress({ running: true, value: 20, message: 'Sending to server...' });
      try {
        setEngineProgress({ running: true, value: 50, message: 'Generating schedule...' });
        await api.post(`/cycles/${cycle._dbId}/schedules/generate`);
        setEngineProgress({ running: true, value: 75, message: 'Syncing persisted schedule...' });
        await serverSync.refetchAll();
        setAdminTab('engine');
        setEngineProgress({ running: false, value: 100, message: 'Draft ready for review.' });
      } catch (err) {
        setEngineProgress({ running: false, value: 0, message: `Error: ${err.message}` });
      }
      return;
    }

    setEngineProgress({
      running: false,
      value: 0,
      message: 'Schedule generation now runs only through the server API. Sign in to an API-backed session to generate a draft.',
    });
  }, [isAdminSession, externalSession, serverSync]);

  const publishSchedule = useCallback(async () => {
    if (!isAdminSession || !results) return;

    if (externalSession !== undefined && results._scheduleId) {
      try {
        await api.post(`/schedules/${results._scheduleId}/publish`);
        await serverSync.refetchAll();
      } catch (err) {
        console.error('Publish failed:', err);
      }
      return;
    }

    const nextPublication = {
      status: 'published',
      draftedAt: schedulePublication.draftedAt || new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };
    setSchedulePublication(nextPublication);
    if (externalSession === undefined) {
      saveStateToStorage(buildSnapshot({ schedulePublication: nextPublication, adminTab }), 'schedule-publish');
    }
  }, [isAdminSession, results, externalSession, schedulePublication, adminTab, buildSnapshot, saveStateToStorage, serverSync]);

  const markScheduleDraft = useCallback(async () => {
    if (!isAdminSession || !results) return;

    if (externalSession !== undefined && results._scheduleId) {
      try {
        await api.post(`/schedules/${results._scheduleId}/unpublish`);
        await serverSync.refetchAll();
      } catch (err) {
        console.error('Unpublish failed:', err);
      }
      return;
    }

    const nextPublication = {
      status: 'draft',
      draftedAt: schedulePublication.draftedAt || new Date().toISOString(),
      publishedAt: '',
    };
    setSchedulePublication(nextPublication);
    if (externalSession === undefined) {
      saveStateToStorage(buildSnapshot({ schedulePublication: nextPublication, adminTab }), 'schedule-unpublish');
    }
  }, [isAdminSession, results, externalSession, schedulePublication, adminTab, buildSnapshot, saveStateToStorage, serverSync]);

  const submittedCount = Object.values(preferences).filter((pref) => pref.submitted).length;
  const activeMembers = members.filter((member) => member.status === 'ACTIVE');
  const invitedMembers = members.filter((member) => member.status === 'INVITED');
  const deactivatedMembers = members.filter((member) => member.status === 'DEACTIVATED');
  const pendingMembers = invitedMembers;
  const inactiveMembers = members.filter((member) => member.status !== 'ACTIVE');
  const pendingRegistrationRequests = useMemo(
    () => registrationRequests
      .filter((request) => request.status === 'Pending')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [registrationRequests],
  );
  const pendingRegistrationCount = pendingRegistrationRequests.length;
  const resolvedRegistrationRequests = useMemo(
    () => registrationRequests
      .filter((request) => request.status !== 'Pending')
      .sort((a, b) => (b.resolvedAt || b.createdAt || '').localeCompare(a.resolvedAt || a.createdAt || '')),
    [registrationRequests],
  );
  const hasGeneratedSchedule = Boolean(results?.assignments && Array.isArray(results.assignments));
  const hasGeneratedScheduleForCurrentMember = currentView !== 'admin'
    && Boolean(results?.assignments?.some((assignment) => assignment.memberId === currentView));
  const memberLoginAccounts = useMemo(
    () => members
      .map((member) => ({ member, account: testAccounts.membersById[member.id] }))
      .filter((entry) => Boolean(entry.account)),
    [members, testAccounts],
  );
  const piAccessAccounts = useMemo(
    () => [...memberAccessAccounts]
      .filter((account) => account.status === 'ACTIVE')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [memberAccessAccounts],
  );
  const activeMember = members.find((member) => member.id === currentView) || null;
  const currentMemberAssignments = results?.assignments?.filter((assignment) => assignment.memberId === currentView) || [];
  const sortedCurrentMemberAssignments = useMemo(
    () => [...currentMemberAssignments].sort((a, b) => {
      const dateDelta = String(a.assignedDate || '').localeCompare(String(b.assignedDate || ''));
      if (dateDelta !== 0) return dateDelta;
      return SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift);
    }),
    [currentMemberAssignments],
  );
  const assignmentKey = useCallback((assignment) => `${assignment.assignedDate}:${assignment.shift}`, []);
  const hasAvailabilityCalendar = Boolean(cycle.startDate && cycle.endDate && cycle.startDate <= cycle.endDate);
  const cycleDays = useMemo(() => generateDateRange(cycle.startDate, cycle.endDate), [cycle.startDate, cycle.endDate]);
  const availableShiftRequestDates = useMemo(() => {
    const blockedDateSet = new Set(cycle.blockedDates || []);
    const blockedSlotSet = new Set(cycle.blockedSlots || []);
    return cycleDays.filter((date) => {
      if (blockedDateSet.has(date)) return false;
      return SHIFT_ORDER.some((shift) => !blockedSlotSet.has(`${date}:${shift}`));
    });
  }, [cycleDays, cycle.blockedDates, cycle.blockedSlots]);
  const selectedShiftChangeDate = selectedShiftChangeSource ? selectedShiftChangeSource.split(':')[0] : '';
  const availableShiftRequestDatesForSelection = useMemo(() => {
    if (!selectedShiftChangeDate) return availableShiftRequestDates;
    return availableShiftRequestDates.filter((date) => date !== selectedShiftChangeDate);
  }, [availableShiftRequestDates, selectedShiftChangeDate]);
  const availableShiftRequestTypes = useMemo(() => {
    if (!shiftChangeForm.requestedDate) return SHIFT_ORDER;
    const blockedSlotSet = new Set(cycle.blockedSlots || []);
    return SHIFT_ORDER.filter((shift) => !blockedSlotSet.has(`${shiftChangeForm.requestedDate}:${shift}`));
  }, [shiftChangeForm.requestedDate, cycle.blockedSlots]);
  const selectedShiftChangeAssignmentObj = useMemo(
    () => sortedCurrentMemberAssignments.find((assignment) => assignmentKey(assignment) === selectedShiftChangeSource) || null,
    [sortedCurrentMemberAssignments, assignmentKey, selectedShiftChangeSource],
  );
  const memberShiftRequests = useMemo(
    () => shiftChangeRequests
      .filter((request) => request.memberId === currentView)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [shiftChangeRequests, currentView],
  );
  const memberShiftCounts = useMemo(
    () => sortedCurrentMemberAssignments.reduce((acc, assignment) => {
      const key = assignment.shift || 'UNSPECIFIED';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    [sortedCurrentMemberAssignments],
  );
  const activeMemberEntitlement = useMemo(() => {
    if (!activeMember) return { wholeShares: 0, fractionalHours: 0 };
    return computeEntitlements([activeMember])[0] || { wholeShares: 0, fractionalHours: 0 };
  }, [activeMember]);
  const activeMemberPreferences = activeMember
    ? (preferences[activeMember.id] || normalizeMemberPreferences(activeMember, {}))
    : { submitted: false, notes: '' };
  const preferenceDeadline = cycle.preferenceDeadline || addDays(cycle.startDate, -7);
  const todayDate = localTodayDateStr();
  const daysUntilPreferenceDeadline = daysBetweenSigned(todayDate, preferenceDeadline);
  const isPreferenceSubmitted = Boolean(activeMemberPreferences?.submitted);
  const scheduleUpcomingAssignments = useMemo(
    () => sortedCurrentMemberAssignments.filter((assignment) => String(assignment.assignedDate || '') >= todayDate),
    [sortedCurrentMemberAssignments, todayDate],
  );
  const schedulePastAssignments = useMemo(
    () => sortedCurrentMemberAssignments.filter((assignment) => String(assignment.assignedDate || '') < todayDate),
    [sortedCurrentMemberAssignments, todayDate],
  );
  const nextUpcomingAssignment = scheduleUpcomingAssignments[0] || null;
  const formatMemberShiftDate = useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    return fromDateStr(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);
  const formatMemberShiftTiming = useCallback((shift) => (
    SHIFT_TIME_LABELS[shift] || shift || 'Unassigned'
  ), []);
  const scheduleRelativeDayLabel = useCallback((dateStr) => {
    const delta = daysBetweenSigned(todayDate, dateStr);
    if (delta === 0) return 'Today';
    if (delta === 1) return 'Tomorrow';
    if (delta > 1) return `In ${delta} days`;
    if (delta === -1) return 'Yesterday';
    return `${Math.abs(delta)} days ago`;
  }, [todayDate]);
  const scheduleMonths = useMemo(() => {
    const monthMap = new Map();
    cycleDays.forEach((dateStr) => {
      const monthKey = dateStr.slice(0, 7);
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey).push(dateStr);
    });
    return [...monthMap.entries()];
  }, [cycleDays]);
  const memberAssignmentMapByDate = useMemo(() => {
    const map = {};
    sortedCurrentMemberAssignments.forEach((assignment) => {
      if (!map[assignment.assignedDate]) map[assignment.assignedDate] = [];
      map[assignment.assignedDate].push(assignment);
    });
    return map;
  }, [sortedCurrentMemberAssignments]);
  const memberShiftChangeSummary = useMemo(() => ({
    pending: memberShiftRequests.filter((request) => request.status === 'Pending').length,
    approved: memberShiftRequests.filter((request) => request.status === 'Approved').length,
    rejected: memberShiftRequests.filter((request) => request.status === 'Rejected').length,
  }), [memberShiftRequests]);
  const memberTabBadges = useMemo(() => {
    const scheduleBadge = schedulePublication.status === 'published'
      ? (hasGeneratedScheduleForCurrentMember ? 'Ready' : 'Published')
      : 'Pending';
    const preferencesBadge = isPreferenceSubmitted
      ? 'Done'
      : daysUntilPreferenceDeadline < 0
        ? 'Late'
        : 'Action';
    const commentsBadge = (() => {
      if (!activeMember) return '';
      const myComments = memberComments[activeMember.id] || [];
      const repliedCount = myComments.filter((entry) => entry.status === 'Replied').length;
      return repliedCount > 0 ? `${repliedCount}` : '';
    })();
    return {
      dashboard: '',
      availability: hasAvailabilityCalendar ? 'Live' : 'N/A',
      preferences: preferencesBadge,
      schedule: scheduleBadge,
      shiftChanges: memberShiftChangeSummary.pending > 0 ? `${memberShiftChangeSummary.pending}` : '',
      comments: commentsBadge,
      profile: '',
    };
  }, [
    schedulePublication.status,
    hasGeneratedScheduleForCurrentMember,
    isPreferenceSubmitted,
    daysUntilPreferenceDeadline,
    hasAvailabilityCalendar,
    memberShiftChangeSummary.pending,
    memberComments,
    activeMember,
  ]);
  const submittedPreferenceNotes = useMemo(() => members
    .map((member) => {
      const pref = preferences[member.id] || {};
      return {
        memberId: member.id,
        memberName: member.name,
        submitted: Boolean(pref.submitted),
        note: String(pref.notes || '').trim(),
      };
    })
    .filter((entry) => entry.note.length > 0), [members, preferences]);
  const sortedShiftRequests = useMemo(
    () => [...shiftChangeRequests].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [shiftChangeRequests],
  );
  const filteredMembersForAdmin = useMemo(() => {
    if (memberStatusFilter === 'active') return activeMembers;
    if (memberStatusFilter === 'invited') return invitedMembers;
    if (memberStatusFilter === 'deactivated') return deactivatedMembers;
    return members;
  }, [activeMembers, deactivatedMembers, invitedMembers, memberStatusFilter, members]);

  useEffect(() => {
    if (selectedShiftChangeSource && !selectedShiftChangeAssignmentObj) {
      setSelectedShiftChangeSource('');
    }
  }, [selectedShiftChangeSource, selectedShiftChangeAssignmentObj]);

  useEffect(() => {
    if (!selectedShiftChangeSource) {
      setShiftChangeForm((prev) => {
        if (!prev.requestedDate && !prev.requestedShift && !prev.reason) return prev;
        return { requestedDate: '', requestedShift: '', reason: '' };
      });
      return;
    }
    setShiftChangeForm((prev) => {
      if (!prev.requestedDate) return prev;
      if (!availableShiftRequestDatesForSelection.includes(prev.requestedDate)) {
        return { ...prev, requestedDate: '', requestedShift: '' };
      }
      return prev;
    });
  }, [selectedShiftChangeSource, availableShiftRequestDatesForSelection]);

  useEffect(() => {
    setShiftChangeForm((prev) => {
      if (!prev.requestedDate) {
        if (!prev.requestedShift) return prev;
        if (!SHIFT_ORDER.includes(prev.requestedShift)) {
          return { ...prev, requestedShift: '' };
        }
        return prev;
      }
      if (!prev.requestedShift) return prev;
      if (!availableShiftRequestTypes.includes(prev.requestedShift)) {
        return { ...prev, requestedShift: '' };
      }
      return prev;
    });
  }, [availableShiftRequestTypes]);

  useEffect(() => {
    if (memberShiftChangeError) setMemberShiftChangeError('');
  }, [selectedShiftChangeSource, shiftChangeForm.requestedDate, shiftChangeForm.requestedShift]);

  const submitShiftChangeRequest = useCallback((event) => {
    event.preventDefault();
    if (!activeMember) return;
    if (!selectedShiftChangeAssignmentObj) {
      setMemberShiftChangeError('Select an assigned shift to request a change.');
      return;
    }
    if (shiftChangeForm.requestedDate && !availableShiftRequestDatesForSelection.includes(shiftChangeForm.requestedDate)) {
      setMemberShiftChangeError('Preferred date is not available.');
      return;
    }
    if (shiftChangeForm.requestedDate && shiftChangeForm.requestedShift && !availableShiftRequestTypes.includes(shiftChangeForm.requestedShift)) {
      setMemberShiftChangeError('Preferred shift is blocked on selected date.');
      return;
    }

    if (externalSession !== undefined) {
      if (!results?._scheduleId) {
        setMemberShiftChangeError('Schedule is not available. Try refreshing.');
        return;
      }

      const activePiId = members.find((member) => member.id === activeMember.id)?._piUserId;
      const assignment = results.assignments?.find((entry) => (
        entry.assignedDate === selectedShiftChangeAssignmentObj.assignedDate
        && entry.shift === selectedShiftChangeAssignmentObj.shift
        && (entry.piId === activePiId || entry.memberId === activeMember.id)
      ));

      if (!assignment) {
        setMemberShiftChangeError('Could not find the assignment. Try refreshing.');
        return;
      }

      const preferredDates = shiftChangeForm.requestedDate ? [shiftChangeForm.requestedDate] : [];

      void api.post('/swap-requests', {
        scheduleId: results._scheduleId,
        targetAssignmentId: assignment.id || assignment._id,
        preferredDates,
      }).then(() => {
        serverSync.swapRequestsQuery?.refetch?.();
        setShiftChangeSubmittedFlash(true);
        window.setTimeout(() => setShiftChangeSubmittedFlash(false), 2800);
        setMemberShiftChangeError('');
        setSelectedShiftChangeSource('');
        setShiftChangeForm({ requestedDate: '', requestedShift: '', reason: '' });
      }).catch((err) => {
        setMemberShiftChangeError(err.message || 'Failed to submit swap request.');
      });
      return;
    }

    const request = {
      id: `SCR-${Date.now()}`,
      memberId: activeMember.id,
      sourceDate: selectedShiftChangeAssignmentObj.assignedDate,
      sourceShift: selectedShiftChangeAssignmentObj.shift,
      requestedDate: shiftChangeForm.requestedDate || '',
      requestedShift: shiftChangeForm.requestedShift || '',
      reason: '',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      adminNote: '',
      reassignedDate: '',
      reassignedShift: '',
      resolvedAt: '',
    };
    setShiftChangeRequests((prev) => [normalizeShiftChangeRequest(request), ...prev]);
    setShiftChangeSubmittedFlash(true);
    window.setTimeout(() => setShiftChangeSubmittedFlash(false), 2800);
    setMemberShiftChangeError('');
    setExpandedMemberRequestId(request.id);
    setSelectedShiftChangeSource('');
    setShiftChangeForm({ requestedDate: '', requestedShift: '', reason: '' });
  }, [
    activeMember,
    selectedShiftChangeAssignmentObj,
    shiftChangeForm,
    availableShiftRequestDatesForSelection,
    availableShiftRequestTypes,
    externalSession,
    members,
    results,
    serverSync,
  ]);

  const downloadMemberSchedulePdf = useCallback(() => {
    if (!activeMember) {
      return { ok: false, error: 'Member account not found.' };
    }
    if (!hasGeneratedSchedule) {
      return { ok: false, error: 'Schedule is not generated yet.' };
    }

    const sortedAssignments = [...currentMemberAssignments].sort((a, b) => {
      const dateDelta = (a.assignedDate || '').localeCompare(b.assignedDate || '');
      if (dateDelta !== 0) return dateDelta;
      return SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift);
    });

    const popup = window.open('', '_blank');
    if (!popup) {
      return { ok: false, error: 'Pop-up blocked. Please allow pop-ups to download your schedule PDF.' };
    }

    const rowsHtml = sortedAssignments.length > 0
      ? sortedAssignments.map((assignment, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(formatCalendarDate(assignment.assignedDate))}</td>
            <td>${escapeHtml(assignment.shift)}</td>
            <td>${escapeHtml(SHIFT_TIME_LABELS[assignment.shift] || SHIFT_LABELS[assignment.shift] || assignment.shift)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4">No shifts assigned for this cycle.</td></tr>';

    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Schedule - ${escapeHtml(activeMember.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1 { margin: 0 0 8px 0; font-size: 20px; }
    .meta { margin-bottom: 16px; font-size: 12px; color: #4b5563; }
    .meta div { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 700; }
    td:first-child, th:first-child { width: 48px; text-align: center; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Member Schedule</h1>
  <div class="meta">
    <div><strong>Member:</strong> ${escapeHtml(`${activeMember.id} - ${activeMember.name}`)}</div>
    <div><strong>Cycle:</strong> ${escapeHtml(`${formatCalendarDate(cycle.startDate)} - ${formatCalendarDate(cycle.endDate)}`)}</div>
    <div><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString())}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Shift</th>
        <th>Time Slot</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
      }, 200);
    });
  </script>
</body>
</html>`);
    popup.document.close();
    return { ok: true };
  }, [activeMember, hasGeneratedSchedule, currentMemberAssignments, cycle.startDate, cycle.endDate]);

  const updateShiftDraft = useCallback((requestId, patch) => {
    setAdminShiftDrafts((prev) => ({ ...prev, [requestId]: { ...(prev[requestId] || {}), ...patch } }));
    setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, []);

  const resolveShiftChange = useCallback((requestId, status) => {
    const request = shiftChangeRequests.find((entry) => entry.id === requestId);
    if (!request) return;
    const draft = adminShiftDrafts[requestId] || {};

    if (externalSession !== undefined) {
      if (!request._swapId) {
        setAdminShiftActionErrors((prev) => ({
          ...prev,
          [requestId]: 'Swap request is missing server metadata. Refresh and try again.',
        }));
        return;
      }

      if (status === 'Rejected') {
        void api.put(`/swap-requests/${request._swapId}`, {
          status: 'denied',
          adminNotes: String(draft.adminNote || '').trim(),
        }).then(() => {
          setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
          serverSync.swapRequestsQuery?.refetch?.();
          serverSync.refetchAll();
        }).catch((err) => {
          setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: err.message }));
        });
        return;
      }

      const targetDate = String(draft.reassignedDate || request.requestedDate || '').trim();
      const targetShift = String(draft.reassignedShift || request.requestedShift || '').trim();
      const adminNote = String(draft.adminNote || '').trim();

      if (!targetDate || !targetShift) {
        setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Select reassigned date and shift before approval.' }));
        return;
      }

      void api.put(`/swap-requests/${request._swapId}`, {
        status: 'approved',
        adminNotes: adminNote,
        reassignedDate: targetDate,
        reassignedShift: targetShift,
      }).then(() => {
        setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
        serverSync.swapRequestsQuery?.refetch?.();
        serverSync.refetchAll();
      }).catch((err) => {
        setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: err.message }));
      });
      return;
    }

    if (status === 'Rejected') {
      setShiftChangeRequests((prev) => prev.map((entry) => {
        if (entry.id !== requestId) return entry;
        return {
          ...entry,
          status: 'Rejected',
          adminNote: String(draft.adminNote || entry.adminNote || '').trim(),
          reassignedDate: '',
          reassignedShift: '',
          resolvedAt: new Date().toISOString(),
        };
      }));
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
      return;
    }

    if (!results?.assignments || !Array.isArray(results.assignments)) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Generate a schedule before approving requests.' }));
      return;
    }

    const sourceDate = String(request.sourceDate || '').trim();
    const sourceShift = String(request.sourceShift || '').trim();
    const targetDate = String(draft.reassignedDate || request.reassignedDate || request.requestedDate || '').trim();
    const targetShift = String(draft.reassignedShift || request.reassignedShift || request.requestedShift || '').trim();
    const adminNote = String(draft.adminNote || request.adminNote || '').trim();

    if (!sourceDate || !sourceShift) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Cannot approve: source shift is missing in this request.' }));
      return;
    }
    if (!targetDate || !targetShift) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Select reassigned date and shift before approval.' }));
      return;
    }
    if (!SHIFT_ORDER.includes(targetShift)) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Selected reassigned shift is invalid.' }));
      return;
    }
    if (targetDate < cycle.startDate || targetDate > cycle.endDate) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Reassignment date is outside the current cycle.' }));
      return;
    }

    const blockedDateSet = new Set(cycle.blockedDates || []);
    const blockedSlotSet = new Set(cycle.blockedSlots || []);
    if (blockedDateSet.has(targetDate) || blockedSlotSet.has(`${targetDate}:${targetShift}`)) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Selected reassignment slot is blocked.' }));
      return;
    }

    const sourceIndex = results.assignments.findIndex((assignment) =>
      assignment.memberId === request.memberId
      && assignment.assignedDate === sourceDate
      && assignment.shift === sourceShift);
    if (sourceIndex < 0) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Cannot approve: source assignment no longer exists.' }));
      return;
    }

    const conflictingIndex = results.assignments.findIndex((assignment, idx) =>
      idx !== sourceIndex
      && assignment.assignedDate === targetDate
      && assignment.shift === targetShift);
    if (conflictingIndex >= 0) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Selected reassignment slot is already assigned. Pick an open slot.' }));
      return;
    }

    setResults((prev) => {
      if (!prev?.assignments || !Array.isArray(prev.assignments)) return prev;
      const prevSourceIndex = prev.assignments.findIndex((assignment) =>
        assignment.memberId === request.memberId
        && assignment.assignedDate === sourceDate
        && assignment.shift === sourceShift);
      if (prevSourceIndex < 0) return prev;
      const prevConflict = prev.assignments.findIndex((assignment, idx) =>
        idx !== prevSourceIndex
        && assignment.assignedDate === targetDate
        && assignment.shift === targetShift);
      if (prevConflict >= 0) return prev;
      const nextAssignments = [...prev.assignments];
      nextAssignments[prevSourceIndex] = {
        ...nextAssignments[prevSourceIndex],
        assignedDate: targetDate,
        shift: targetShift,
        assignmentReason: 'manual_override',
      };
      return { ...prev, assignments: nextAssignments };
    });

    setShiftChangeRequests((prev) => prev.map((entry) => {
      if (entry.id !== requestId) return entry;
      return {
        ...entry,
        status: 'Approved',
        adminNote,
        reassignedDate: targetDate,
        reassignedShift: targetShift,
        resolvedAt: new Date().toISOString(),
      };
    }));
    setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, [adminShiftDrafts, shiftChangeRequests, results, cycle, externalSession, serverSync]);

  const originalChoiceMarks = useMemo(() => {
    const marks = {};
    Object.entries(preferences).forEach(([memberId, pref]) => {
      if (!pref?.submitted) return;
      (pref.wholeShare || []).forEach((wholeShare) => {
        if (wholeShare.choice1Date) {
          const key = `${wholeShare.choice1Date}:${wholeShare.shift}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} 1st`);
        }
        if (wholeShare.choice2Date) {
          const key = `${wholeShare.choice2Date}:${wholeShare.shift}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} 2nd`);
        }
      });
      (pref.fractionalPreferences || []).forEach((fractional, idx) => {
        const shift = idx % 2 === 0 ? 'DS1' : 'DS2';
        if (fractional.choice1Date) {
          const key = `${fractional.choice1Date}:${shift}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} F${idx + 1} 1st`);
        }
        if (fractional.choice2Date) {
          const key = `${fractional.choice2Date}:${shift}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} F${idx + 1} 2nd`);
        }
      });
    });
    return marks;
  }, [preferences]);

  const loadSamplePrefs = useCallback(() => {
    const sample = {
      MIT: {
        wholeShare: [
          { shareIndex: 1, shift: 'DS1', choice1Date: '2026-03-03', choice2Date: '2026-03-10' },
          { shareIndex: 1, shift: 'DS2', choice1Date: '', choice2Date: '' },
          { shareIndex: 1, shift: 'NS', choice1Date: '2026-03-17', choice2Date: '2026-03-24' },
          ...sampleWholeShare(2, '2026-03-24', '2026-03-31'),
          ...sampleWholeShare(3, '2026-04-14', '2026-04-21'),
        ],
        fractionalPreferences: [],
        submitted: true,
      },
      Duke: {
        wholeShare: [
          ...sampleWholeShare(1, '2026-03-03', '2026-03-05'),
        ],
        fractionalPreferences: [],
        submitted: true,
      },
      UGA: {
        wholeShare: [
          ...sampleWholeShare(1, '2026-03-03', '2026-03-07'),
          ...sampleWholeShare(2, '2026-03-24', '2026-04-01'),
        ],
        fractionalPreferences: [
          { blockIndex: 1, fractionalHours: 4.8, choice1Date: '2026-04-07', choice2Date: '2026-04-08' },
        ],
        submitted: true,
      },
      Emory: {
        wholeShare: [
          ...sampleWholeShare(1, '2026-03-10', '2026-03-17'),
        ],
        fractionalPreferences: [
          { blockIndex: 1, fractionalHours: 6, choice1Date: '2026-04-07', choice2Date: '2026-04-09' },
        ],
        submitted: true,
      },
      MUSC: {
        wholeShare: [],
        fractionalPreferences: [
          { blockIndex: 1, fractionalHours: 6, choice1Date: '2026-03-20', choice2Date: '2026-03-21' },
          { blockIndex: 2, fractionalHours: 6, choice1Date: '2026-03-27', choice2Date: '2026-03-28' },
        ],
        submitted: true,
      },
    };
    setPreferences((prev) => ({ ...prev, ...sample }));
  }, []);

  const value = useMemo(() => ({
    members,
    setMembers,
    cycle,
    setCycle,
    queue,
    setQueue,
    config,
    setConfig,
    preferences,
    setPreferences,
    results,
    setResults,
    session,
    setSession,
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
    registrationRequests,
    setRegistrationRequests,
    memberAccessAccounts,
    setMemberAccessAccounts,
    memberComments,
    setMemberComments,
    registrationApprovalDrafts,
    registrationActionErrors,
    currentView,
    setCurrentView,
    memberTab,
    setMemberTab,
    adminTab,
    setAdminTab,
    memberStatusFilter,
    setMemberStatusFilter,
    newMemberForm,
    setNewMemberForm,
    schedulePublication,
    setSchedulePublication,
    engineProgress,
    setEngineProgress,
    selectedShiftChangeSource,
    setSelectedShiftChangeSource,
    expandedMemberRequestId,
    setExpandedMemberRequestId,
    shiftChangeSubmittedFlash,
    memberShiftChangeError,
    setMemberShiftChangeError,
    shiftChangeForm,
    setShiftChangeForm,
    shiftChangeRequests,
    adminShiftDrafts,
    adminShiftActionErrors,
    dbStatus,
    dbBusy,
    serverDataReady: serverSync.dataReady,
    serverDataLoading: serverSync.isLoading,
    refetchServerData: serverSync.refetchAll,
    testAccounts,
    isAdminSession,
    memberDirectory,
    buildSnapshot,
    applySnapshot,
    saveStateToStorage,
    saveCurrentToDatabase,
    loadFromDatabase,
    resetToDemoBaseline,
    handleSignIn,
    handleSSOSignIn,
    handleActivate,
    handleSignOut,
    updatePreference,
    updateMember,
    saveMemberProfile,
    submitMemberComment,
    markMemberCommentRead,
    replyToMemberComment,
    setRegistrationApprovalDraft,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    resendMemberInvite,
    cancelMemberInvite,
    deactivateMember,
    changeMemberPi,
    reinviteMember,
    toggleDateBlocked,
    toggleSlotBlocked,
    addMember,
    runEngine,
    publishSchedule,
    markScheduleDraft,
    submittedCount,
    activeMembers,
    pendingMembers,
    invitedMembers,
    deactivatedMembers,
    inactiveMembers,
    pendingRegistrationRequests,
    pendingRegistrationCount,
    resolvedRegistrationRequests,
    hasGeneratedSchedule,
    hasGeneratedScheduleForCurrentMember,
    memberLoginAccounts,
    piAccessAccounts,
    activeMember,
    currentMemberAssignments,
    sortedCurrentMemberAssignments,
    assignmentKey,
    hasAvailabilityCalendar,
    cycleDays,
    availableShiftRequestDates,
    selectedShiftChangeDate,
    availableShiftRequestDatesForSelection,
    availableShiftRequestTypes,
    selectedShiftChangeAssignmentObj,
    memberShiftRequests,
    memberShiftCounts,
    activeMemberEntitlement,
    activeMemberPreferences,
    preferenceDeadline,
    todayDate,
    daysUntilPreferenceDeadline,
    isPreferenceSubmitted,
    scheduleUpcomingAssignments,
    schedulePastAssignments,
    nextUpcomingAssignment,
    formatMemberShiftDate,
    formatMemberShiftTiming,
    scheduleRelativeDayLabel,
    scheduleMonths,
    memberAssignmentMapByDate,
    memberShiftChangeSummary,
    memberTabBadges,
    submittedPreferenceNotes,
    sortedShiftRequests,
    filteredMembersForAdmin,
    submitShiftChangeRequest,
    downloadMemberSchedulePdf,
    updateShiftDraft,
    resolveShiftChange,
    originalChoiceMarks,
    loadSamplePrefs,
  }), [
    members,
    cycle,
    queue,
    config,
    preferences,
    results,
    session,
    authScreen,
    loginForm,
    loginError,
    activateToken,
    activateForm,
    activationSummary,
    registrationRequests,
    memberAccessAccounts,
    memberComments,
    registrationApprovalDrafts,
    registrationActionErrors,
    currentView,
    memberTab,
    adminTab,
    memberStatusFilter,
    newMemberForm,
    schedulePublication,
    engineProgress,
    selectedShiftChangeSource,
    expandedMemberRequestId,
    shiftChangeSubmittedFlash,
    memberShiftChangeError,
    shiftChangeForm,
    shiftChangeRequests,
    adminShiftDrafts,
    adminShiftActionErrors,
    dbStatus,
    dbBusy,
    serverSync.dataReady,
    serverSync.isLoading,
    serverSync.refetchAll,
    testAccounts,
    isAdminSession,
    memberDirectory,
    buildSnapshot,
    applySnapshot,
    saveStateToStorage,
    saveCurrentToDatabase,
    loadFromDatabase,
    resetToDemoBaseline,
    handleSignIn,
    handleSSOSignIn,
    handleActivate,
    handleSignOut,
    updatePreference,
    updateMember,
    saveMemberProfile,
    submitMemberComment,
    markMemberCommentRead,
    replyToMemberComment,
    setRegistrationApprovalDraft,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    resendMemberInvite,
    cancelMemberInvite,
    deactivateMember,
    changeMemberPi,
    reinviteMember,
    toggleDateBlocked,
    toggleSlotBlocked,
    addMember,
    runEngine,
    publishSchedule,
    markScheduleDraft,
    submittedCount,
    activeMembers,
    pendingMembers,
    invitedMembers,
    deactivatedMembers,
    inactiveMembers,
    pendingRegistrationRequests,
    pendingRegistrationCount,
    resolvedRegistrationRequests,
    hasGeneratedSchedule,
    hasGeneratedScheduleForCurrentMember,
    memberLoginAccounts,
    piAccessAccounts,
    activeMember,
    currentMemberAssignments,
    sortedCurrentMemberAssignments,
    assignmentKey,
    hasAvailabilityCalendar,
    cycleDays,
    availableShiftRequestDates,
    selectedShiftChangeDate,
    availableShiftRequestDatesForSelection,
    availableShiftRequestTypes,
    selectedShiftChangeAssignmentObj,
    memberShiftRequests,
    memberShiftCounts,
    activeMemberEntitlement,
    activeMemberPreferences,
    preferenceDeadline,
    todayDate,
    daysUntilPreferenceDeadline,
    isPreferenceSubmitted,
    scheduleUpcomingAssignments,
    schedulePastAssignments,
    nextUpcomingAssignment,
    formatMemberShiftDate,
    formatMemberShiftTiming,
    scheduleRelativeDayLabel,
    scheduleMonths,
    memberAssignmentMapByDate,
    memberShiftChangeSummary,
    memberTabBadges,
    submittedPreferenceNotes,
    sortedShiftRequests,
    filteredMembersForAdmin,
    submitShiftChangeRequest,
    downloadMemberSchedulePdf,
    updateShiftDraft,
    resolveShiftChange,
    originalChoiceMarks,
    loadSamplePrefs,
  ]);

  return React.createElement(MockStateContext.Provider, { value }, children);
}

export function useMockApp() {
  const context = useContext(MockStateContext);
  if (!context) {
    throw new Error('useMockApp must be used within MockStateProvider');
  }
  return context;
}
