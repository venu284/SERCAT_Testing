import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_MEMBERS } from '../data/members';
import { INITIAL_CYCLE } from '../data/cycle';
import { ALGORITHM_PROFILE, DEFAULT_CONFIG } from '../data/config';
import currentRunSnapshot from '../data/current-run-snapshot.json';
import { createSeedSnapshot } from '../data/seed-state';
import { computeEntitlements, runSchedulingEngine } from '../engine/engine';
import {
  ADMIN_PORTAL_TABS,
  MEMBER_PORTAL_TABS,
  SHIFT_LABELS,
  SHIFT_ORDER,
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
import {
  normalizeMemberAccessAccount,
  normalizeMemberAccessAccounts,
  normalizeMemberPreferences,
  normalizeMemberRecord,
  normalizeRegistrationRequests,
  normalizeShiftChangeRequest,
  normalizeShiftChangeRequests,
  sampleWholeShare,
} from './normalizers';
import { clearStoredSnapshot, loadStoredSnapshot, saveStoredSnapshot } from './storage';
import { ensureMemberPalette, simpleHash } from './theme';

const MockStateContext = createContext(null);
const DEFAULT_SCHEDULE_PUBLICATION = { status: 'draft', publishedAt: '', draftedAt: '' };
const DEFAULT_LOGIN_FORM = { username: '', password: '' };
const DEFAULT_REGISTRATION_FORM = { institutionMemberId: '', institutionalEmail: '', shares: '1.00' };
const DEFAULT_NEW_MEMBER_FORM = { id: '', name: '', shares: '1.00' };
const DEFAULT_ENGINE_PROGRESS = { running: false, value: 0, message: 'Idle' };
const DEFAULT_SHIFT_CHANGE_FORM = { requestedDate: '', requestedShiftType: '', reason: '' };

function getDemoPreferenceDeadline(cycle) {
  const today = localTodayDateStr();
  let nextDeadline = addDays(today, 7);
  if (cycle?.startDate && nextDeadline < cycle.startDate) nextDeadline = cycle.startDate;
  if (cycle?.endDate && nextDeadline > cycle.endDate) nextDeadline = cycle.endDate;
  return nextDeadline;
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
    registrationForm: { ...DEFAULT_REGISTRATION_FORM },
    registrationSuccess: null,
    registrationRequests: [],
    memberAccessAccounts: [],
    registrationApprovalDrafts: {},
    registrationActionErrors: {},
    currentView: 'admin',
    memberTab: 'dashboard',
    adminTab: 'dashboard',
    memberStatusFilter: 'active',
    newMemberForm: { ...DEFAULT_NEW_MEMBER_FORM },
    schedulePublication: { ...DEFAULT_SCHEDULE_PUBLICATION },
    engineProgress: { ...DEFAULT_ENGINE_PROGRESS },
    memberScheduleView: 'agenda',
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

export function MockStateProvider({ children }) {
  const defaultsRef = useRef(getDefaultState());
  const defaults = defaultsRef.current;

  const [members, setMembers] = useState(defaults.members);
  const [cycle, setCycle] = useState(defaults.cycle);
  const [queue, setQueue] = useState(defaults.queue);
  const [config, setConfig] = useState(defaults.config);
  const [preferences, setPreferences] = useState(defaults.preferences);
  const [results, setResults] = useState(defaults.results);
  const [session, setSession] = useState(defaults.session);
  const [authScreen, setAuthScreen] = useState(defaults.authScreen);
  const [loginForm, setLoginForm] = useState(defaults.loginForm);
  const [loginError, setLoginError] = useState(defaults.loginError);
  const [registrationForm, setRegistrationForm] = useState(defaults.registrationForm);
  const [registrationSuccess, setRegistrationSuccess] = useState(defaults.registrationSuccess);
  const [registrationRequests, setRegistrationRequests] = useState(defaults.registrationRequests);
  const [memberAccessAccounts, setMemberAccessAccounts] = useState(defaults.memberAccessAccounts);
  const [registrationApprovalDrafts, setRegistrationApprovalDrafts] = useState(defaults.registrationApprovalDrafts);
  const [registrationActionErrors, setRegistrationActionErrors] = useState(defaults.registrationActionErrors);
  const [currentView, setCurrentView] = useState(defaults.currentView);
  const [memberTab, setMemberTab] = useState(defaults.memberTab);
  const [adminTab, setAdminTab] = useState(defaults.adminTab);
  const [memberStatusFilter, setMemberStatusFilter] = useState(defaults.memberStatusFilter);
  const [newMemberForm, setNewMemberForm] = useState(defaults.newMemberForm);
  const [schedulePublication, setSchedulePublication] = useState(defaults.schedulePublication);
  const [engineProgress, setEngineProgress] = useState(defaults.engineProgress);
  const [memberScheduleView, setMemberScheduleView] = useState(defaults.memberScheduleView);
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

  const testAccounts = useMemo(() => buildTestAccounts(members, memberAccessAccounts), [members, memberAccessAccounts]);
  const isAdminSession = session?.role === 'admin';
  const memberDirectory = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member])),
    [members],
  );

  useEffect(() => {
    if (!session) return;
    if (session.role === 'admin') {
      if (currentView !== 'admin' && !members.some((member) => member.id === currentView)) {
        setCurrentView('admin');
      }
      return;
    }
    if (!members.some((member) => member.id === session.memberId)) {
      setSession(null);
      setLoginError('This account is no longer available. Contact admin.');
      setCurrentView('admin');
      return;
    }
    if (currentView !== session.memberId) {
      setCurrentView(session.memberId);
    }
  }, [session, currentView, members]);

  const resetEphemeralUiState = useCallback(() => {
    setSession(null);
    setAuthScreen('login');
    setLoginForm({ ...DEFAULT_LOGIN_FORM });
    setLoginError('');
    setRegistrationForm({ ...DEFAULT_REGISTRATION_FORM });
    setRegistrationSuccess(null);
    setRegistrationApprovalDrafts({});
    setRegistrationActionErrors({});
    setMemberStatusFilter('active');
    setNewMemberForm({ ...DEFAULT_NEW_MEMBER_FORM });
    setEngineProgress({ ...DEFAULT_ENGINE_PROGRESS });
    setMemberScheduleView('agenda');
    setSelectedShiftChangeSource('');
    setExpandedMemberRequestId('');
    setShiftChangeSubmittedFlash(false);
    setMemberShiftChangeError('');
    setShiftChangeForm({ ...DEFAULT_SHIFT_CHANGE_FORM });
    setAdminShiftDrafts({});
    setAdminShiftActionErrors({});
  }, []);

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
    algorithm: {
      ...ALGORITHM_PROFILE,
      capturedAt: new Date().toISOString(),
      sourceHash: simpleHash(runSchedulingEngine.toString()),
      configSnapshot: { ...(overrides.config || config) },
      source: runSchedulingEngine.toString(),
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
    setResults(hasValidResultsShape ? loadedResults : null);

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
    saveStateToStorage(buildSnapshot(), 'manual-save');
  }, [buildSnapshot, saveStateToStorage]);

  const loadFromDatabase = useCallback(() => {
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
  }, [applySnapshot]);

  useEffect(() => {
    const storedSnapshot = loadStoredSnapshot();
    if (storedSnapshot) {
      applySnapshot(storedSnapshot, 'Loaded from browser storage');
    } else {
      demoBaselineRef.current = deriveDemoBaselineSnapshot(currentRunSnapshot);
      applySnapshot(demoBaselineRef.current, 'Loaded standard demo baseline');
    }
    setHasLoadedSnapshot(true);
  }, [applySnapshot]);

  useEffect(() => {
    if (!hasLoadedSnapshot) return;
    saveStoredSnapshot(buildSnapshot());
  }, [hasLoadedSnapshot, buildSnapshot]);

  const resetToDemoBaseline = useCallback(() => {
    demoBaselineRef.current = deriveDemoBaselineSnapshot(currentRunSnapshot);
    clearStoredSnapshot();
    resetEphemeralUiState();
    applySnapshot(demoBaselineRef.current, 'Reset to standard demo baseline');
    saveStoredSnapshot(demoBaselineRef.current);
  }, [applySnapshot, resetEphemeralUiState]);

  const handleSignIn = useCallback((event) => {
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
      setSession({ role: 'member', username: loginKey, memberId: memberAccount.memberId });
      setCurrentView(memberAccount.memberId);
      setMemberTab('dashboard');
      setLoginForm({ username: '', password: '' });
      setLoginError('');
      setAuthScreen('login');
      return;
    }

    setLoginError('Invalid username or password.');
  }, [loginForm, testAccounts]);

  const handleSSOSignIn = useCallback(() => {
    setLoginError('SSO is shown in prototype mode. Please use username/password for this local demo.');
  }, []);

  const handleRegister = useCallback((event) => {
    event.preventDefault();
    const institutionMemberId = String(registrationForm.institutionMemberId || '').trim();
    const institutionalEmail = normalizeEmail(registrationForm.institutionalEmail);
    const shares = parseFloat(registrationForm.shares);
    const now = new Date().toISOString();
    const institution = members.find((member) => member.id === institutionMemberId);

    if (!institutionMemberId || !institution || institution.registrationEnabled === false) {
      setLoginError('Registration failed: choose a valid institution.');
      return;
    }
    if (!isValidEmail(institutionalEmail)) {
      setLoginError('Registration failed: enter a valid institutional email.');
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setLoginError('Registration failed: shares must be greater than 0.');
      return;
    }

    const duplicateRequest = registrationRequests.some((request) =>
      normalizeEmail(request.institutionalEmail) === institutionalEmail
      && (request.status === 'Pending' || request.status === 'Approved'));
    if (duplicateRequest) {
      setLoginError('Registration failed: this institution/email already has an active or approved request.');
      return;
    }

    const duplicateAccess = memberAccessAccounts.some((account) =>
      normalizeEmail(account.email) === institutionalEmail
      && account.status === 'ACTIVE');
    if (duplicateAccess) {
      setLoginError('Registration failed: this institutional email already has approved access.');
      return;
    }

    const request = {
      id: `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      institutionMemberId,
      institutionLabel: institution.name || institution.id,
      institutionalEmail,
      requestedShares: parseFloat(shares.toFixed(2)),
      status: 'Pending',
      createdAt: now,
      resolvedAt: '',
      adminNote: '',
    };

    setRegistrationRequests((prev) => [request, ...prev]);
    setRegistrationSuccess({ type: 'request', institutionalEmail, institutionLabel: request.institutionLabel });
    setRegistrationForm({ institutionMemberId: '', institutionalEmail: '', shares: '1.00' });
    setAuthScreen('login');
    setLoginError('');
  }, [registrationForm, members, registrationRequests, memberAccessAccounts]);

  const handleSignOut = useCallback(() => {
    resetEphemeralUiState();
    setCurrentView('admin');
    setAdminTab('dashboard');
    setMemberTab('dashboard');
  }, [resetEphemeralUiState]);

  const updatePreference = useCallback((memberId, prefs) => {
    setPreferences((prev) => ({ ...prev, [memberId]: prefs }));
  }, []);

  const updateMember = useCallback((memberId, patch) => {
    setMembers((prevMembers) => {
      let updatedMember = null;
      let sharesChanged = false;
      const next = prevMembers.map((member) => {
        if (member.id !== memberId) return member;
        const nextShares = patch.shares !== undefined
          ? Math.max(0, parseFloat((Number(patch.shares) || 0).toFixed(2)))
          : member.shares;
        sharesChanged = patch.shares !== undefined && nextShares !== member.shares;
        updatedMember = { ...member, ...patch, shares: nextShares };
        return updatedMember;
      });
      if (updatedMember && sharesChanged) {
        setPreferences((prevPrefs) => ({
          ...prevPrefs,
          [memberId]: { ...normalizeMemberPreferences(updatedMember, prevPrefs[memberId]), submitted: false },
        }));
      }
      return next;
    });

    if (patch.status === 'ACTIVE') {
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
    setResults(null);
  }, []);

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
    updateMember(request.institutionMemberId, { shares: approvedShares, status: 'ACTIVE' });
    const resetInstitutionMember = normalizeMemberRecord({
      ...institution,
      shares: parseFloat(approvedShares.toFixed(2)),
      status: 'ACTIVE',
    });
    setPreferences((prev) => ({
      ...prev,
      [request.institutionMemberId]: normalizeMemberPreferences(resetInstitutionMember, {}),
    }));
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
  }, [registrationRequests, registrationApprovalDrafts, memberAccessAccounts, members, updateMember]);

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

  const toggleDateBlocked = useCallback((date) => {
    setCycle((prev) => {
      const blockedDates = new Set(prev.blockedDates || []);
      if (blockedDates.has(date)) blockedDates.delete(date);
      else blockedDates.add(date);
      return { ...prev, blockedDates: [...blockedDates].sort() };
    });
    setResults(null);
  }, []);

  const toggleSlotBlocked = useCallback((date, shiftType) => {
    setCycle((prev) => {
      const blockedSlots = new Set(prev.blockedSlots || []);
      const key = `${date}:${shiftType}`;
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

    if (!id) {
      window.alert('Enter a member ID (e.g., UNC).');
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      window.alert('Shares must be greater than 0.');
      return;
    }
    if (members.some((member) => member.id === id)) {
      window.alert(`Member ${id} already exists.`);
      return;
    }

    ensureMemberPalette(id, members.length);
    const member = { id, name, shares: parseFloat(shares.toFixed(2)), status: 'ACTIVE', registrationEnabled: true };
    setMembers((prev) => [...prev, member]);
    setQueue((prev) => {
      if (prev.some((entry) => entry.memberId === id)) return prev;
      const meanDeficit = prev.length > 0 ? prev.reduce((sum, entry) => sum + entry.deficitScore, 0) / prev.length : 0;
      const insertAt = Math.ceil(prev.length / 2);
      const next = [...prev];
      next.splice(insertAt, 0, { memberId: id, deficitScore: parseFloat(meanDeficit.toFixed(4)), cycleWins: 0, roundWins: 0 });
      return next;
    });
    setPreferences((prev) => ({ ...prev, [id]: normalizeMemberPreferences(member, prev[id]) }));
    setCurrentView(id);
    setResults(null);
    setNewMemberForm({ id: '', name: '', shares: '1.00' });
  }, [members, newMemberForm]);

  const runEngine = useCallback(() => {
    if (!isAdminSession) return;
    setEngineProgress({ running: true, value: 20, message: 'Validating submissions...' });
    window.setTimeout(() => {
      const wholePrefs = [];
      const fractionalPrefs = [];
      Object.entries(preferences).forEach(([memberId, pref]) => {
        if (pref.submitted) {
          pref.wholeShare.forEach((wholeShare) => wholePrefs.push({ memberId, ...wholeShare }));
          pref.fractional.forEach((fractional) => fractionalPrefs.push({ memberId, ...fractional }));
        }
      });

      setEngineProgress({ running: true, value: 65, message: 'Generating draft schedule...' });
      const result = runSchedulingEngine({
        cycle,
        members,
        wholeSharePreferences: wholePrefs,
        fractionalPreferences: fractionalPrefs,
        priorityQueue: queue,
        config,
        simpleHash,
      });
      const draftedAt = new Date().toISOString();
      const nextPublication = { status: 'draft', draftedAt, publishedAt: '' };
      setResults(result);
      setSchedulePublication(nextPublication);
      setAdminTab('engine');
      setEngineProgress({ running: false, value: 100, message: 'Draft ready for review.' });
      saveStateToStorage(buildSnapshot({ results: result, adminTab: 'engine', schedulePublication: nextPublication }), 'engine-run');
    }, 240);
  }, [isAdminSession, preferences, cycle, members, queue, config, buildSnapshot, saveStateToStorage]);

  const publishSchedule = useCallback(() => {
    if (!isAdminSession || !results) return;
    const nextPublication = {
      status: 'published',
      draftedAt: schedulePublication.draftedAt || new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };
    setSchedulePublication(nextPublication);
    saveStateToStorage(buildSnapshot({ schedulePublication: nextPublication, adminTab }), 'schedule-publish');
  }, [isAdminSession, results, schedulePublication, adminTab, buildSnapshot, saveStateToStorage]);

  const markScheduleDraft = useCallback(() => {
    if (!isAdminSession || !results) return;
    const nextPublication = {
      status: 'draft',
      draftedAt: schedulePublication.draftedAt || new Date().toISOString(),
      publishedAt: '',
    };
    setSchedulePublication(nextPublication);
    saveStateToStorage(buildSnapshot({ schedulePublication: nextPublication, adminTab }), 'schedule-unpublish');
  }, [isAdminSession, results, schedulePublication, adminTab, buildSnapshot, saveStateToStorage]);

  const submittedCount = Object.values(preferences).filter((pref) => pref.submitted).length;
  const activeMembers = members.filter((member) => member.status === 'ACTIVE');
  const pendingMembers = members.filter((member) => member.status !== 'ACTIVE');
  const registrationInstitutions = useMemo(
    () => members
      .filter((member) => member.registrationEnabled !== false)
      .sort((a, b) => `${a.name || ''}${a.id}`.localeCompare(`${b.name || ''}${b.id}`))
      .map((member) => ({ id: member.id, name: member.name || member.id })),
    [members],
  );
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
      const dateDelta = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateDelta !== 0) return dateDelta;
      return SHIFT_ORDER.indexOf(a.shiftType) - SHIFT_ORDER.indexOf(b.shiftType);
    }),
    [currentMemberAssignments],
  );
  const assignmentKey = useCallback((assignment) => `${assignment.date}:${assignment.shiftType}`, []);
  const hasAvailabilityCalendar = Boolean(cycle.startDate && cycle.endDate && cycle.startDate <= cycle.endDate);
  const cycleDays = useMemo(() => generateDateRange(cycle.startDate, cycle.endDate), [cycle.startDate, cycle.endDate]);
  const availableShiftRequestDates = useMemo(() => {
    const blockedDateSet = new Set(cycle.blockedDates || []);
    const blockedSlotSet = new Set(cycle.blockedSlots || []);
    return cycleDays.filter((date) => {
      if (blockedDateSet.has(date)) return false;
      return SHIFT_ORDER.some((shiftType) => !blockedSlotSet.has(`${date}:${shiftType}`));
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
    return SHIFT_ORDER.filter((shiftType) => !blockedSlotSet.has(`${shiftChangeForm.requestedDate}:${shiftType}`));
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
      const key = assignment.shiftType || 'UNSPECIFIED';
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
    () => sortedCurrentMemberAssignments.filter((assignment) => String(assignment.date || '') >= todayDate),
    [sortedCurrentMemberAssignments, todayDate],
  );
  const schedulePastAssignments = useMemo(
    () => sortedCurrentMemberAssignments.filter((assignment) => String(assignment.date || '') < todayDate),
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
      if (!map[assignment.date]) map[assignment.date] = [];
      map[assignment.date].push(assignment);
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
    return {
      dashboard: '',
      availability: hasAvailabilityCalendar ? 'Live' : 'N/A',
      preferences: preferencesBadge,
      schedule: scheduleBadge,
      shiftChanges: memberShiftChangeSummary.pending > 0 ? `${memberShiftChangeSummary.pending}` : '',
    };
  }, [
    schedulePublication.status,
    hasGeneratedScheduleForCurrentMember,
    isPreferenceSubmitted,
    daysUntilPreferenceDeadline,
    hasAvailabilityCalendar,
    memberShiftChangeSummary.pending,
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
  const filteredMembersForAdmin = memberStatusFilter === 'pending' ? pendingMembers : activeMembers;

  useEffect(() => {
    if (selectedShiftChangeSource && !selectedShiftChangeAssignmentObj) {
      setSelectedShiftChangeSource('');
    }
  }, [selectedShiftChangeSource, selectedShiftChangeAssignmentObj]);

  useEffect(() => {
    if (!selectedShiftChangeSource) {
      setShiftChangeForm((prev) => {
        if (!prev.requestedDate && !prev.requestedShiftType && !prev.reason) return prev;
        return { requestedDate: '', requestedShiftType: '', reason: prev.reason };
      });
      return;
    }
    setShiftChangeForm((prev) => {
      if (!prev.requestedDate) return prev;
      if (!availableShiftRequestDatesForSelection.includes(prev.requestedDate)) {
        return { ...prev, requestedDate: '', requestedShiftType: '' };
      }
      return prev;
    });
  }, [selectedShiftChangeSource, availableShiftRequestDatesForSelection]);

  useEffect(() => {
    setShiftChangeForm((prev) => {
      if (!prev.requestedDate) {
        if (!prev.requestedShiftType) return prev;
        if (!SHIFT_ORDER.includes(prev.requestedShiftType)) {
          return { ...prev, requestedShiftType: '' };
        }
        return prev;
      }
      if (!prev.requestedShiftType) return prev;
      if (!availableShiftRequestTypes.includes(prev.requestedShiftType)) {
        return { ...prev, requestedShiftType: '' };
      }
      return prev;
    });
  }, [availableShiftRequestTypes]);

  useEffect(() => {
    if (memberShiftChangeError) setMemberShiftChangeError('');
  }, [selectedShiftChangeSource, shiftChangeForm.requestedDate, shiftChangeForm.requestedShiftType, shiftChangeForm.reason]);

  const submitShiftChangeRequest = useCallback((event) => {
    event.preventDefault();
    if (!activeMember) return;
    if (!selectedShiftChangeAssignmentObj) {
      setMemberShiftChangeError('Select an assigned shift to request a change.');
      return;
    }
    if (!shiftChangeForm.reason.trim()) {
      setMemberShiftChangeError('Reason is required.');
      return;
    }
    if (shiftChangeForm.requestedDate && !availableShiftRequestDatesForSelection.includes(shiftChangeForm.requestedDate)) {
      setMemberShiftChangeError('Preferred date is not available.');
      return;
    }
    if (shiftChangeForm.requestedDate && shiftChangeForm.requestedShiftType && !availableShiftRequestTypes.includes(shiftChangeForm.requestedShiftType)) {
      setMemberShiftChangeError('Preferred shift is blocked on selected date.');
      return;
    }

    const request = {
      id: `SCR-${Date.now()}`,
      memberId: activeMember.id,
      sourceDate: selectedShiftChangeAssignmentObj.date,
      sourceShiftType: selectedShiftChangeAssignmentObj.shiftType,
      requestedDate: shiftChangeForm.requestedDate || '',
      requestedShiftType: shiftChangeForm.requestedShiftType || '',
      reason: shiftChangeForm.reason.trim(),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      adminNote: '',
      reassignedDate: '',
      reassignedShiftType: '',
      resolvedAt: '',
    };
    setShiftChangeRequests((prev) => [normalizeShiftChangeRequest(request), ...prev]);
    setShiftChangeSubmittedFlash(true);
    window.setTimeout(() => setShiftChangeSubmittedFlash(false), 2800);
    setMemberShiftChangeError('');
    setExpandedMemberRequestId(request.id);
    setSelectedShiftChangeSource('');
    setShiftChangeForm({ requestedDate: '', requestedShiftType: '', reason: '' });
  }, [
    activeMember,
    selectedShiftChangeAssignmentObj,
    shiftChangeForm,
    availableShiftRequestDatesForSelection,
    availableShiftRequestTypes,
  ]);

  const downloadMemberSchedulePdf = useCallback(() => {
    if (!activeMember) return;
    if (!hasGeneratedSchedule) {
      window.alert('Schedule is not generated yet.');
      return;
    }

    const sortedAssignments = [...currentMemberAssignments].sort((a, b) => {
      const dateDelta = (a.date || '').localeCompare(b.date || '');
      if (dateDelta !== 0) return dateDelta;
      return SHIFT_ORDER.indexOf(a.shiftType) - SHIFT_ORDER.indexOf(b.shiftType);
    });

    const popup = window.open('', '_blank');
    if (!popup) {
      window.alert('Pop-up blocked. Please allow pop-ups to download your schedule PDF.');
      return;
    }

    const rowsHtml = sortedAssignments.length > 0
      ? sortedAssignments.map((assignment, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(formatCalendarDate(assignment.date))}</td>
            <td>${escapeHtml(assignment.shiftType)}</td>
            <td>${escapeHtml(SHIFT_LABELS[assignment.shiftType] || assignment.shiftType)}</td>
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
  }, [activeMember, hasGeneratedSchedule, currentMemberAssignments, cycle.startDate, cycle.endDate]);

  const updateShiftDraft = useCallback((requestId, patch) => {
    setAdminShiftDrafts((prev) => ({ ...prev, [requestId]: { ...(prev[requestId] || {}), ...patch } }));
    setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, []);

  const resolveShiftChange = useCallback((requestId, status) => {
    const request = shiftChangeRequests.find((entry) => entry.id === requestId);
    if (!request) return;
    const draft = adminShiftDrafts[requestId] || {};

    if (status === 'Rejected') {
      setShiftChangeRequests((prev) => prev.map((entry) => {
        if (entry.id !== requestId) return entry;
        return {
          ...entry,
          status: 'Rejected',
          adminNote: String(draft.adminNote || entry.adminNote || '').trim(),
          reassignedDate: '',
          reassignedShiftType: '',
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
    const sourceShiftType = String(request.sourceShiftType || '').trim();
    const targetDate = String(draft.reassignedDate || request.reassignedDate || request.requestedDate || '').trim();
    const targetShiftType = String(draft.reassignedShiftType || request.reassignedShiftType || request.requestedShiftType || '').trim();
    const adminNote = String(draft.adminNote || request.adminNote || '').trim();

    if (!sourceDate || !sourceShiftType) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Cannot approve: source shift is missing in this request.' }));
      return;
    }
    if (!targetDate || !targetShiftType) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Select reassigned date and shift before approval.' }));
      return;
    }
    if (!SHIFT_ORDER.includes(targetShiftType)) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Selected reassigned shift is invalid.' }));
      return;
    }
    if (targetDate < cycle.startDate || targetDate > cycle.endDate) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Reassignment date is outside the current cycle.' }));
      return;
    }

    const blockedDateSet = new Set(cycle.blockedDates || []);
    const blockedSlotSet = new Set(cycle.blockedSlots || []);
    if (blockedDateSet.has(targetDate) || blockedSlotSet.has(`${targetDate}:${targetShiftType}`)) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Selected reassignment slot is blocked.' }));
      return;
    }

    const sourceIndex = results.assignments.findIndex((assignment) =>
      assignment.memberId === request.memberId
      && assignment.date === sourceDate
      && assignment.shiftType === sourceShiftType);
    if (sourceIndex < 0) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Cannot approve: source assignment no longer exists.' }));
      return;
    }

    const conflictingIndex = results.assignments.findIndex((assignment, idx) =>
      idx !== sourceIndex
      && assignment.date === targetDate
      && assignment.shiftType === targetShiftType);
    if (conflictingIndex >= 0) {
      setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Selected reassignment slot is already assigned. Pick an open slot.' }));
      return;
    }

    setResults((prev) => {
      if (!prev?.assignments || !Array.isArray(prev.assignments)) return prev;
      const prevSourceIndex = prev.assignments.findIndex((assignment) =>
        assignment.memberId === request.memberId
        && assignment.date === sourceDate
        && assignment.shiftType === sourceShiftType);
      if (prevSourceIndex < 0) return prev;
      const prevConflict = prev.assignments.findIndex((assignment, idx) =>
        idx !== prevSourceIndex
        && assignment.date === targetDate
        && assignment.shiftType === targetShiftType);
      if (prevConflict >= 0) return prev;
      const nextAssignments = [...prev.assignments];
      nextAssignments[prevSourceIndex] = {
        ...nextAssignments[prevSourceIndex],
        date: targetDate,
        shiftType: targetShiftType,
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
        reassignedShiftType: targetShiftType,
        resolvedAt: new Date().toISOString(),
      };
    }));
    setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, [adminShiftDrafts, shiftChangeRequests, results, cycle]);

  const originalChoiceMarks = useMemo(() => {
    const marks = {};
    Object.entries(preferences).forEach(([memberId, pref]) => {
      if (!pref?.submitted) return;
      (pref.wholeShare || []).forEach((wholeShare) => {
        const shiftType = wholeShare.shiftType || (wholeShare.slotKey === 'NS' ? 'NS' : wholeShare.slotKey === 'DAY2' ? 'DS2' : 'DS1');
        if (wholeShare.firstChoiceDate) {
          const key = `${wholeShare.firstChoiceDate}:${shiftType}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} 1st`);
        }
        if (wholeShare.secondChoiceDate) {
          const key = `${wholeShare.secondChoiceDate}:${shiftType}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} 2nd`);
        }
      });
      (pref.fractional || []).forEach((fractional, idx) => {
        const shiftType = fractional.shiftType || 'DS1';
        if (fractional.firstChoiceDate) {
          const key = `${fractional.firstChoiceDate}:${shiftType}`;
          if (!marks[key]) marks[key] = [];
          marks[key].push(`${memberId} F${idx + 1} 1st`);
        }
        if (fractional.secondChoiceDate) {
          const key = `${fractional.secondChoiceDate}:${shiftType}`;
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
          ...sampleWholeShare(1, '2026-03-03', '2026-03-10', 'DS2', 'DS2'),
          ...sampleWholeShare(2, '2026-03-24', '2026-03-31'),
          ...sampleWholeShare(3, '2026-04-14', '2026-04-21'),
        ],
        fractional: [],
        submitted: true,
      },
      Duke: {
        wholeShare: [
          ...sampleWholeShare(1, '2026-03-03', '2026-03-05'),
        ],
        fractional: [],
        submitted: true,
      },
      UGA: {
        wholeShare: [
          ...sampleWholeShare(1, '2026-03-03', '2026-03-07'),
          ...sampleWholeShare(2, '2026-03-24', '2026-04-01'),
        ],
        fractional: [
          { shiftType: 'DS1', firstChoiceDate: '2026-04-07', secondChoiceDate: '2026-04-08' },
        ],
        submitted: true,
      },
      Emory: {
        wholeShare: [
          ...sampleWholeShare(1, '2026-03-10', '2026-03-17'),
        ],
        fractional: [
          { shiftType: 'DS2', firstChoiceDate: '2026-04-07', secondChoiceDate: '2026-04-09' },
        ],
        submitted: true,
      },
      MUSC: {
        wholeShare: [],
        fractional: [
          { shiftType: 'DS1', firstChoiceDate: '2026-03-20', secondChoiceDate: '2026-03-21' },
          { shiftType: 'DS1', firstChoiceDate: '2026-03-27', secondChoiceDate: '2026-03-28' },
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
    registrationForm,
    setRegistrationForm,
    registrationSuccess,
    setRegistrationSuccess,
    registrationRequests,
    setRegistrationRequests,
    memberAccessAccounts,
    setMemberAccessAccounts,
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
    memberScheduleView,
    setMemberScheduleView,
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
    handleRegister,
    handleSignOut,
    updatePreference,
    updateMember,
    setRegistrationApprovalDraft,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    toggleDateBlocked,
    toggleSlotBlocked,
    addMember,
    runEngine,
    publishSchedule,
    markScheduleDraft,
    submittedCount,
    activeMembers,
    pendingMembers,
    registrationInstitutions,
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
    registrationForm,
    registrationSuccess,
    registrationRequests,
    memberAccessAccounts,
    registrationApprovalDrafts,
    registrationActionErrors,
    currentView,
    memberTab,
    adminTab,
    memberStatusFilter,
    newMemberForm,
    schedulePublication,
    engineProgress,
    memberScheduleView,
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
    handleRegister,
    handleSignOut,
    updatePreference,
    updateMember,
    setRegistrationApprovalDraft,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    toggleDateBlocked,
    toggleSlotBlocked,
    addMember,
    runEngine,
    publishSchedule,
    markScheduleDraft,
    submittedCount,
    activeMembers,
    pendingMembers,
    registrationInstitutions,
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
