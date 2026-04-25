import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ensureMemberPalette } from '../lib/theme';
import { useActiveCycle } from './useActiveCycle';
import {
  useComments,
  useMasterShares,
  usePreferenceStatus,
  usePreferences,
  useSchedule,
  useSwapRequests,
  useUsers,
} from './useApiData';
import { extractRows } from '../lib/api';

function extractPreferenceStatusRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.status)) return payload.status;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.status)) return payload.data.status;
  return [];
}

function normalizePreferenceDeadline(activeCycle) {
  const deadline = activeCycle?.preferenceDeadline || '';
  if (!deadline) return '';
  return deadline.includes('T') ? deadline.split('T')[0] : deadline;
}

export function useAppShell() {
  const { user, loading: authLoading, logout } = useAuth();
  const [currentView, setCurrentView] = useState('admin');
  const [memberTab, setMemberTab] = useState('dashboard');
  const [adminTab, setAdminTab] = useState('dashboard');

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin';

  const cycleQuery = useActiveCycle({ enabled: isAuthenticated });
  const sharesQuery = useMasterShares({ enabled: isAuthenticated });
  const usersQuery = useUsers({ all: true }, { enabled: isAuthenticated });
  const prefStatusQuery = usePreferenceStatus(isAdmin ? cycleQuery.activeCycleId : null, { enabled: isAuthenticated && isAdmin });
  const memberPrefsQuery = usePreferences(!isAdmin ? cycleQuery.activeCycleId : null, { enabled: isAuthenticated && !isAdmin });
  const scheduleQuery = useSchedule(cycleQuery.activeCycleId, { enabled: isAuthenticated });
  const swapQuery = useSwapRequests({ enabled: isAuthenticated });
  const commentsQuery = useComments({ enabled: isAuthenticated });

  const shareRows = useMemo(() => extractRows(sharesQuery.data), [sharesQuery.data]);
  const userRows = useMemo(() => extractRows(usersQuery.data), [usersQuery.data]);

  const members = useMemo(() => {
    if (!Array.isArray(shareRows) || shareRows.length === 0) return [];

    const usersById = {};
    userRows.forEach((entry) => {
      if (entry?.id) usersById[entry.id] = entry;
    });

    return shareRows.map((share, index) => {
      const memberId = share?.institutionAbbreviation || share?.piEmail || `MEMBER${index + 1}`;
      const linkedUser = usersById[share?.piId] || {};
      const wholeShares = Number(share?.wholeShares) || 0;
      const fractionalShares = Number(share?.fractionalShares) || 0;

      let status = 'ACTIVE';
      if (linkedUser.isActive === false) status = 'DEACTIVATED';
      else if (linkedUser.isActivated === false) status = 'INVITED';

      ensureMemberPalette(memberId, index);

      return {
        id: memberId,
        name: share?.institutionName || memberId,
        shares: Number((wholeShares + fractionalShares).toFixed(2)),
        status,
        piName: share?.piName || linkedUser?.name || '',
        piEmail: String(share?.piEmail || linkedUser?.email || '').trim().toLowerCase(),
        _piUserId: share?.piId || linkedUser?.id || null,
        _institutionUuid: share?.institutionId || linkedUser?.institutionId || null,
        _shareId: share?.id || null,
        _wholeShares: wholeShares,
        _fractionalShares: fractionalShares,
      };
    });
  }, [shareRows, userRows]);

  const activeMember = useMemo(() => {
    if (!isAuthenticated) return null;
    if (isAdmin) {
      return members.find((member) => member.id === currentView) || null;
    }

    const memberId = user?.institutionAbbreviation || user?.institutionId || null;
    return members.find((member) => member.id === memberId)
      || members.find((member) => member._piUserId === user?.id)
      || null;
  }, [currentView, isAdmin, isAuthenticated, members, user]);

  const cycle = useMemo(() => {
    const activeCycle = cycleQuery.activeCycle;
    if (!activeCycle) {
      return { id: '', startDate: '', endDate: '', preferenceDeadline: '', _dbId: null, _status: '' };
    }

    return {
      id: activeCycle.name || activeCycle.id,
      startDate: activeCycle.startDate || '',
      endDate: activeCycle.endDate || '',
      preferenceDeadline: normalizePreferenceDeadline(activeCycle),
      _dbId: activeCycle.id,
      _status: activeCycle.status || '',
    };
  }, [cycleQuery.activeCycle]);

  const scheduleData = scheduleQuery.data || null;
  const hasGeneratedSchedule = Boolean(scheduleData?.assignments?.length);
  const scheduleStatus = scheduleData?.status || 'draft';

  const pendingRegistrationCount = useMemo(
    () => members.filter((member) => member.status === 'INVITED').length,
    [members],
  );

  const memberTabBadges = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const deadline = cycle.preferenceDeadline;
    const daysUntil = deadline
      ? Math.ceil((new Date(deadline).getTime() - new Date(today).getTime()) / 86400000)
      : 999;

    const adminPrefRows = extractPreferenceStatusRows(prefStatusQuery.data);
    const memberPrefPayload = memberPrefsQuery.data || {};
    const memberSubmissionRows = Array.isArray(memberPrefPayload.submissions) ? memberPrefPayload.submissions : [];
    const isSubmitted = (() => {
      if (!activeMember) return false;
      if (isAdmin) {
        return adminPrefRows.some((entry) => entry?.piId === activeMember._piUserId && entry?.hasSubmitted);
      }

      return Boolean(
        memberPrefPayload.submittedAt
          || memberSubmissionRows.some((entry) => entry?.piId === activeMember._piUserId && entry?.submittedAt),
      );
    })();

    const prefBadge = isSubmitted
      ? 'Done'
      : daysUntil < 0
        ? 'Late'
        : 'Action';

    const scheduleBadge = scheduleStatus === 'published' ? 'Published' : 'Pending';

    const swapRows = extractRows(swapQuery.data);
    const pendingSwapCount = activeMember
      ? swapRows.filter((entry) => entry?.requesterId === activeMember._piUserId && entry?.status === 'pending').length
      : 0;

    const commentRows = extractRows(commentsQuery.data);
    const repliedCommentCount = activeMember
      ? commentRows.filter((entry) => entry?.piId === activeMember._piUserId && String(entry?.status || '').toLowerCase() === 'replied').length
      : 0;

    return {
      dashboard: '',
      availability: cycle._status ? 'Live' : '',
      preferences: prefBadge,
      schedule: scheduleBadge,
      shiftChanges: pendingSwapCount > 0 ? `${pendingSwapCount}` : '',
      comments: repliedCommentCount > 0 ? `${repliedCommentCount}` : '',
      profile: '',
    };
  }, [
    activeMember,
    commentsQuery.data,
    cycle._status,
    cycle.preferenceDeadline,
    isAdmin,
    memberPrefsQuery.data,
    prefStatusQuery.data,
    scheduleStatus,
    swapQuery.data,
  ]);

  const dataReady = Boolean(sharesQuery.data && usersQuery.data);
  const dataLoading = Boolean(
    sharesQuery.isLoading
      || usersQuery.isLoading
      || cycleQuery.isLoading,
  );

  return {
    user,
    authLoading,
    logout,
    isAuthenticated,
    isAdmin,
    currentView,
    setCurrentView,
    memberTab,
    setMemberTab,
    adminTab,
    setAdminTab,
    cycle,
    activeCycleId: cycleQuery.activeCycleId,
    members,
    activeMember,
    hasGeneratedSchedule,
    pendingRegistrationCount,
    memberTabBadges,
    dataReady,
    dataLoading,
  };
}
