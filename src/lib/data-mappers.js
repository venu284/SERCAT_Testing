import { ensureMemberPalette } from './theme';
import { normalizeEmail } from './auth';
import { normalizeMemberPreferences } from './normalizers';

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

export function mapPreferencesToMock(apiPrefs, members) {
  const result = {};

  if (!Array.isArray(members)) return result;

  const piIdToMember = {};
  members.forEach((m) => {
    if (m._piUserId) {
      piIdToMember[m._piUserId] = m;
    }
  });

  const grouped = {};
  if (Array.isArray(apiPrefs)) {
    apiPrefs.forEach((p) => {
      const member = piIdToMember[p.piId];
      if (!member) return;
      if (!grouped[member.id]) grouped[member.id] = { member, rows: [], submitted: false };
      grouped[member.id].rows.push(p);
      if (p.submittedAt) grouped[member.id].submitted = true;
    });
  }

  members.forEach((member) => {
    const group = grouped[member.id];
    const wholeShare = group
      ? group.rows.map((p) => ({
        shareIndex: p.shareIndex,
        slotKey: p.slotKey,
        shiftType: p.slotKey === 'NS' ? 'NS' : '',
        firstChoiceDate: p.choice1Date || '',
        secondChoiceDate: p.choice2Date || '',
      }))
      : [];

    result[member.id] = normalizeMemberPreferences(member, {
      wholeShare,
      fractional: [],
      submitted: Boolean(group?.submitted),
      notes: '',
    });
  });

  return result;
}
