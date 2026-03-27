import { WHOLE_SLOT_ORDER } from './constants';

function matchesWholeShareEntry(entry, shareIndex, memberId = '') {
  return entry.shareIndex === shareIndex && (!memberId || entry.memberId === memberId);
}

export function isDoubleNightWholeShare(entries = [], shareIndex, memberId = '') {
  return entries.some(
    (entry) =>
      matchesWholeShareEntry(entry, shareIndex, memberId)
      && entry.slotKey === 'DAY1'
      && entry.shiftType === 'NS',
  );
}

export function getActiveWholeSlotKeysForShare(entries = [], shareIndex, memberId = '') {
  return isDoubleNightWholeShare(entries, shareIndex, memberId) ? ['DAY1', 'NS'] : WHOLE_SLOT_ORDER;
}

export function countWholeShareSlots(entries = [], wholeShares = 0, memberId = '') {
  let total = 0;
  for (let shareIndex = 1; shareIndex <= wholeShares; shareIndex += 1) {
    total += getActiveWholeSlotKeysForShare(entries, shareIndex, memberId).length;
  }
  return total;
}

export function countRemainingWholeShareSlots(entries = [], wholeShares = 0, roundHint = 1, memberId = '') {
  let total = 0;
  for (let shareIndex = roundHint; shareIndex <= wholeShares; shareIndex += 1) {
    total += getActiveWholeSlotKeysForShare(entries, shareIndex, memberId).length;
  }
  return total;
}

export function normalizeWholeShareEntriesForDoubleNight(entries = []) {
  const doubleNightKeys = new Set(
    entries
      .filter((entry) => entry.slotKey === 'DAY1' && entry.shiftType === 'NS')
      .map((entry) => `${entry.memberId || ''}:${entry.shareIndex}`),
  );

  return entries.map((entry) => {
    const shareKey = `${entry.memberId || ''}:${entry.shareIndex}`;
    if (!doubleNightKeys.has(shareKey) || entry.slotKey !== 'DAY2') return entry;
    return {
      ...entry,
      shiftType: '',
      firstChoiceDate: '',
      secondChoiceDate: '',
    };
  });
}
