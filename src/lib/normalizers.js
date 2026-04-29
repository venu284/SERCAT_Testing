import { WHOLE_SLOT_ORDER } from './constants.js';
import { computeEntitlements } from './entitlements.js';
import { normalizeWholeShareEntriesForDoubleNight } from './whole-share.js';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function legacyShiftToSlotKey(shift) {
  if (shift === 'NS') return 'NS';
  if (shift === 'DS2') return 'DAY2';
  return 'DAY1';
}

function normalizeWholePreferenceEntry(entry = {}, shareIndex, slotKey) {
  const shiftType = slotKey === 'NS'
    ? 'NS'
    : (typeof (entry.shiftType || entry.shift) === 'string' ? (entry.shiftType || entry.shift || '') : '');
  return {
    shareIndex,
    slotKey,
    shiftType,
    firstChoiceDate: entry.firstChoiceDate || entry.choice1Date || '',
    secondChoiceDate: entry.secondChoiceDate || entry.choice2Date || '',
  };
}

function normalizeFractionalPreferenceEntry(entry = {}, blockIndex, fractionalHours) {
  return {
    blockIndex,
    fractionalHours,
    shiftType: typeof entry.shiftType === 'string' ? entry.shiftType : '',
    firstChoiceDate: entry.firstChoiceDate || entry.choice1Date || '',
    secondChoiceDate: entry.secondChoiceDate || entry.choice2Date || '',
  };
}

export function normalizeMemberRecord(raw) {
  const member = raw || {};
  const status = ['ACTIVE', 'INVITED', 'DEACTIVATED'].includes(member.status) ? member.status : 'ACTIVE';
  return {
    piName: '',
    piEmail: '',
    piPhone: '',
    piRole: '',
    inviteToken: null,
    invitedAt: null,
    activatedAt: status === 'ACTIVE' ? '2026-01-01T00:00:00Z' : null,
    registrationEnabled: member.registrationEnabled !== false,
    ...member,
    status,
    piName: String(member.piName || '').trim(),
    piEmail: normalizeEmail(member.piEmail || ''),
    piPhone: String(member.piPhone || '').trim(),
    piRole: String(member.piRole || '').trim(),
    inviteToken: member.inviteToken ? String(member.inviteToken) : null,
    invitedAt: member.invitedAt ? String(member.invitedAt) : null,
    activatedAt: status === 'ACTIVE'
      ? String(member.activatedAt || '2026-01-01T00:00:00Z')
      : null,
  };
}

export function normalizeRegistrationRequest(raw, idx = 0) {
  const request = raw || {};
  const createdAt = request.createdAt ? String(request.createdAt) : new Date(Date.now() + idx).toISOString();
  const status = ['Pending', 'Approved', 'Rejected'].includes(request.status) ? request.status : 'Pending';
  return {
    id: String(request.id || `REG-${createdAt}-${idx}`),
    institutionMemberId: String(request.institutionMemberId || request.memberId || '').trim(),
    institutionLabel: String(request.institutionLabel || request.memberName || '').trim(),
    institutionalEmail: normalizeEmail(request.institutionalEmail || request.email || ''),
    requestedShares: parseFloat((Number(request.requestedShares) || 0).toFixed(2)),
    status,
    createdAt,
    resolvedAt: String(request.resolvedAt || '').trim(),
    adminNote: String(request.adminNote || '').trim(),
  };
}

export function normalizeRegistrationRequests(list) {
  if (!Array.isArray(list)) return [];
  return list.map((entry, idx) => normalizeRegistrationRequest(entry, idx));
}

export function normalizeMemberAccessAccount(raw, idx = 0) {
  const account = raw || {};
  const createdAt = account.createdAt ? String(account.createdAt) : new Date(Date.now() + idx).toISOString();
  const status = ['ACTIVE', 'INACTIVE'].includes(account.status) ? account.status : 'ACTIVE';
  const email = normalizeEmail(account.email || account.username || '');
  return {
    id: String(account.id || `ACC-${createdAt}-${idx}`),
    memberId: String(account.memberId || '').trim(),
    email,
    username: String(account.username || email).trim().toLowerCase(),
    password: String(account.password || ''),
    status,
    createdAt,
    approvedFromRequestId: String(account.approvedFromRequestId || account.requestId || '').trim(),
  };
}

export function normalizeMemberAccessAccounts(list) {
  if (!Array.isArray(list)) return [];
  return list.map((entry, idx) => normalizeMemberAccessAccount(entry, idx));
}

export function normalizeShiftChangeRequest(raw, idx = 0) {
  const request = raw || {};
  const sourceDate = String(request.sourceDate || request.fromDate || '').trim();
  const sourceShift = String(request.sourceShift || request.sourceShiftType || request.fromShift || '').trim();
  const requestedDate = String(request.requestedDate || '').trim();
  const requestedShift = String(request.requestedShift || request.requestedShiftType || '').trim();
  const reassignedDate = String(request.reassignedDate || '').trim();
  const reassignedShift = String(request.reassignedShift || request.reassignedShiftType || '').trim();
  const status = ['Pending', 'Approved', 'Rejected'].includes(request.status) ? request.status : 'Pending';
  const createdAt = request.createdAt ? String(request.createdAt) : new Date(Date.now() + idx).toISOString();
  return {
    id: String(request.id || `SCR-LEGACY-${createdAt}-${idx}`),
    memberId: String(request.memberId || '').trim(),
    createdAt,
    status,
    reason: String(request.reason || '').trim(),
    sourceDate,
    sourceShift,
    requestedDate,
    requestedShift,
    reassignedDate,
    reassignedShift,
    adminNote: String(request.adminNote || '').trim(),
    resolvedAt: String(request.resolvedAt || '').trim(),
    _swapId: String(request._swapId || '').trim(),
    _scheduleId: String(request._scheduleId || '').trim(),
    _targetAssignmentId: String(request._targetAssignmentId || '').trim(),
  };
}

export function normalizeShiftChangeRequests(list) {
  if (!Array.isArray(list)) return [];
  return list.map((entry, idx) => normalizeShiftChangeRequest(entry, idx));
}

export function normalizeMemberComment(raw, memberId = '', idx = 0) {
  const comment = raw || {};
  const createdAt = comment.createdAt ? String(comment.createdAt) : new Date(Date.now() + idx).toISOString();
  const status = ['Sent', 'Read', 'Replied'].includes(comment.status) ? comment.status : 'Sent';
  const readAt = String(comment.readAt || '').trim();
  const adminReply = String(comment.adminReply || '').trim();
  const adminReplyAt = String(comment.adminReplyAt || '').trim();
  return {
    id: String(comment.id || `CMT-${memberId || 'member'}-${createdAt}-${idx}`),
    memberId: String(comment.memberId || memberId || '').trim(),
    subject: String(comment.subject || '').trim(),
    message: String(comment.message || '').trim(),
    status,
    createdAt,
    updatedAt: String(comment.updatedAt || adminReplyAt || readAt || createdAt),
    readAt,
    adminReply,
    adminReplyAt,
  };
}

export function normalizeMemberComments(rawComments, members = []) {
  const normalized = {};
  const source = rawComments && typeof rawComments === 'object' ? rawComments : {};
  const memberIds = new Set([
    ...Object.keys(source),
    ...members.map((member) => member.id),
  ]);

  memberIds.forEach((memberId) => {
    const list = Array.isArray(source[memberId]) ? source[memberId] : [];
    normalized[memberId] = list
      .map((entry, idx) => normalizeMemberComment(entry, memberId, idx))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  });

  return normalized;
}

export function buildMember(user, share) {
  if (!share) return null;
  const wholeShares = Number(share?.wholeShares) || 0;
  const fractionalShares = Number(share?.fractionalShares) || 0;
  return {
    id: share?.institutionAbbreviation || user?.institutionAbbreviation || 'PI',
    name: share?.institutionName || user?.institutionName || user?.name || 'Member',
    shares: Number((wholeShares + fractionalShares).toFixed(2)),
    status: 'ACTIVE',
    _piUserId: share?.piId || user?.id || null,
    _institutionUuid: share?.institutionId || user?.institutionId || null,
  };
}

export function normalizeMemberPreferences(
  member,
  prefs = { wholeShare: [], fractional: [], submitted: false, notes: '' },
) {
  const entitlement = computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 };
  const sourceWhole = Array.isArray(prefs.wholeShare) ? prefs.wholeShare : [];
  const sourceFractional = Array.isArray(prefs.fractional)
    ? prefs.fractional
    : (Array.isArray(prefs.fractionalPreferences) ? prefs.fractionalPreferences : []);

  const wholeShare = [];
  for (let i = 0; i < entitlement.wholeShares; i += 1) {
    const shareIndex = i + 1;
    WHOLE_SLOT_ORDER.forEach((slotKey) => {
      const existing = sourceWhole.find(
        (entry) => entry.shareIndex === shareIndex
          && (entry.slotKey === slotKey || legacyShiftToSlotKey(entry.shift || '') === slotKey),
      ) || {};
      wholeShare.push(normalizeWholePreferenceEntry(existing, shareIndex, slotKey));
    });
  }

  const normalizedWholeShare = normalizeWholeShareEntriesForDoubleNight(wholeShare);

  const fractional = [];
  let remainingHours = entitlement.fractionalHours;
  let blockIndex = 1;
  while (remainingHours > 0.0001) {
    const hours = Math.min(6, roundTo2(remainingHours));
    const existing = sourceFractional[blockIndex - 1] || {};
    fractional.push(normalizeFractionalPreferenceEntry(existing, blockIndex, hours));
    remainingHours = roundTo2(remainingHours - hours);
    blockIndex += 1;
  }

  return {
    wholeShare: normalizedWholeShare,
    fractional,
    submitted: Boolean(prefs.submitted),
    notes: String(prefs.notes || ''),
  };
}

function roundTo2(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function sampleWholeShare(shareIndex, firstChoiceDate, secondChoiceDate, day1Shift = 'DS1', day2Shift = 'DS2') {
  return [
    { shareIndex, slotKey: 'DAY1', shiftType: day1Shift, firstChoiceDate, secondChoiceDate },
    { shareIndex, slotKey: 'DAY2', shiftType: day2Shift, firstChoiceDate, secondChoiceDate },
    { shareIndex, slotKey: 'NS', shiftType: 'NS', firstChoiceDate, secondChoiceDate },
  ];
}
