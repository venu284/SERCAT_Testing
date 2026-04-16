import { ensureMemberPalette } from './theme.js';
import { normalizeEmail } from './auth.js';
import { normalizeMemberPreferences } from './normalizers.js';
import { SHIFT_ORDER } from './constants.js';

export function mapSharesToMembers(sharesData, usersData) {
  if (!Array.isArray(sharesData) || sharesData.length === 0) {
    return [];
  }

  const userMap = {};
  if (Array.isArray(usersData)) {
    usersData.forEach((u) => {
      userMap[u.id] = u;
    });
  }

  return sharesData.map((share, idx) => {
    const abbr = share.institutionAbbreviation || share.piEmail || `MEMBER${idx}`;
    const user = userMap[share.piId] || {};
    const wholeShares = Number(share.wholeShares) || 0;
    const fractionalShares = parseFloat(share.fractionalShares) || 0;
    const totalShares = parseFloat((wholeShares + fractionalShares).toFixed(2));

    let status = 'ACTIVE';
    if (!user.isActive) {
      status = 'DEACTIVATED';
    } else if (!user.isActivated) {
      status = 'INVITED';
    }

    ensureMemberPalette(abbr, idx);

    return {
      id: abbr,
      name: share.institutionName || abbr,
      shares: totalShares,
      status,
      piName: share.piName || user.name || '',
      piEmail: normalizeEmail(share.piEmail || user.email || ''),
      piPhone: '',
      piRole: '',
      inviteToken: null,
      invitedAt: null,
      activatedAt: status === 'ACTIVE'
        ? (user.lastLoginAt || user.createdAt || new Date().toISOString())
        : null,
      registrationEnabled: true,
      _piUserId: share.piId || user.id || null,
      _institutionUuid: share.institutionId || user.institutionId || null,
      _shareId: share.id || null,
      _wholeShares: wholeShares,
      _fractionalShares: fractionalShares,
    };
  });
}

export function mapCycleToMock(cycle, availableDates) {
  if (!cycle) return null;

  const blockedDates = [];
  if (Array.isArray(availableDates)) {
    availableDates.forEach((d) => {
      if (!d.isAvailable) {
        blockedDates.push(d.date);
      }
    });
  }

  let preferenceDeadline = cycle.preferenceDeadline || '';
  if (preferenceDeadline && preferenceDeadline.includes('T')) {
    preferenceDeadline = preferenceDeadline.split('T')[0];
  }

  return {
    id: cycle.name || cycle.id,
    startDate: cycle.startDate || '',
    endDate: cycle.endDate || '',
    preferenceDeadline,
    blockedDates: blockedDates.sort(),
    blockedSlots: [],
    _dbId: cycle.id,
    _status: cycle.status,
  };
}

function buildSubmissionMap(submissions = []) {
  const map = new Map();
  submissions.forEach((entry) => {
    if (entry?.piId) {
      map.set(entry.piId, entry.submittedAt || entry.updatedAt || '');
    }
  });
  return map;
}

function sortWholeRows(rows = []) {
  return [...rows].sort((left, right) => {
    const shareDelta = (left.shareIndex || 0) - (right.shareIndex || 0);
    if (shareDelta !== 0) return shareDelta;
    return SHIFT_ORDER.indexOf(left.shift) - SHIFT_ORDER.indexOf(right.shift);
  });
}

function sortFractionalRows(rows = []) {
  return [...rows].sort((left, right) => (left.blockIndex || 0) - (right.blockIndex || 0));
}

export function mapPreferencesToMock(apiPrefs, members) {
  const result = {};

  if (!Array.isArray(members)) return result;

  const payload = Array.isArray(apiPrefs)
    ? { preferences: apiPrefs, fractionalPreferences: [], submissions: [] }
    : (apiPrefs || {});

  const piIdToMember = {};
  members.forEach((m) => {
    if (m._piUserId) {
      piIdToMember[m._piUserId] = m;
    }
  });

  const grouped = {};
  const submissions = buildSubmissionMap(payload.submissions || []);

  (payload.preferences || []).forEach((p) => {
    const member = piIdToMember[p.piId];
    if (!member) return;
    if (!grouped[member.id]) grouped[member.id] = { member, wholeShare: [], fractionalPreferences: [] };
    grouped[member.id].wholeShare.push({
      shareIndex: p.shareIndex,
      shift: p.shift,
      choice1Date: p.choice1Date || '',
      choice2Date: p.choice2Date || '',
    });
  });

  (payload.fractionalPreferences || []).forEach((p) => {
    const member = piIdToMember[p.piId];
    if (!member) return;
    if (!grouped[member.id]) grouped[member.id] = { member, wholeShare: [], fractionalPreferences: [] };
    grouped[member.id].fractionalPreferences.push({
      blockIndex: p.blockIndex || p.shareIndex || grouped[member.id].fractionalPreferences.length + 1,
      fractionalHours: Number(p.fractionalHours) || 0,
      choice1Date: p.choice1Date || '',
      choice2Date: p.choice2Date || '',
    });
  });

  members.forEach((member) => {
    const group = grouped[member.id] || { wholeShare: [], fractionalPreferences: [] };
    result[member.id] = normalizeMemberPreferences(member, {
      wholeShare: sortWholeRows(group.wholeShare),
      fractionalPreferences: sortFractionalRows(group.fractionalPreferences),
      submitted: submissions.has(member._piUserId),
      notes: '',
    });
  });

  return result;
}
