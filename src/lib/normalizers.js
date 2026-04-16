import { SHIFT_ORDER } from './constants.js';
import { normalizeEmail } from './auth.js';
import { computeEntitlements } from './entitlements.js';

function legacySlotKeyToShift(slotKey) {
  if (slotKey === 'NS') return 'NS';
  if (slotKey === 'DAY2') return 'DS2';
  return 'DS1';
}

function normalizeWholePreferenceEntry(entry = {}, shareIndex, shift) {
  const resolvedShift = entry.shift || entry.shiftType || legacySlotKeyToShift(entry.slotKey || shift);
  return {
    shareIndex,
    shift: resolvedShift,
    choice1Date: entry.choice1Date || entry.firstChoiceDate || '',
    choice2Date: entry.choice2Date || entry.secondChoiceDate || '',
  };
}

function normalizeFractionalPreferenceEntry(entry = {}, blockIndex, fractionalHours) {
  return {
    blockIndex,
    fractionalHours,
    choice1Date: entry.choice1Date || entry.firstChoiceDate || '',
    choice2Date: entry.choice2Date || entry.secondChoiceDate || '',
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

export function normalizeMemberPreferences(
  member,
  prefs = { wholeShare: [], fractionalPreferences: [], submitted: false, notes: '' },
) {
  const entitlement = computeEntitlements([member])[0] || { wholeShares: 0, fractionalHours: 0 };
  const sourceWhole = Array.isArray(prefs.wholeShare) ? prefs.wholeShare : [];
  const sourceFractional = Array.isArray(prefs.fractionalPreferences)
    ? prefs.fractionalPreferences
    : (Array.isArray(prefs.fractional) ? prefs.fractional : []);

  const wholeShare = [];
  for (let i = 0; i < entitlement.wholeShares; i += 1) {
    const shareIndex = i + 1;
    SHIFT_ORDER.forEach((shift) => {
      const existing = sourceWhole.find(
        (entry) => entry.shareIndex === shareIndex
          && (entry.shift || legacySlotKeyToShift(entry.slotKey || 'DS1')) === shift,
      ) || {};
      wholeShare.push(normalizeWholePreferenceEntry(existing, shareIndex, shift));
    });
  }

  const fractionalPreferences = [];
  let remainingHours = entitlement.fractionalHours;
  let blockIndex = 1;
  while (remainingHours > 0.0001) {
    const hours = Math.min(6, roundTo2(remainingHours));
    const existing = sourceFractional[blockIndex - 1] || {};
    fractionalPreferences.push(normalizeFractionalPreferenceEntry(existing, blockIndex, hours));
    remainingHours = roundTo2(remainingHours - hours);
    blockIndex += 1;
  }

  return {
    wholeShare,
    fractionalPreferences,
    submitted: Boolean(prefs.submitted),
    notes: String(prefs.notes || ''),
  };
}

function roundTo2(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function sampleWholeShare(shareIndex, firstChoiceDate, secondChoiceDate) {
  return SHIFT_ORDER.map((shift) => ({
    shareIndex,
    shift,
    choice1Date: firstChoiceDate,
    choice2Date: secondChoiceDate,
  }));
}
