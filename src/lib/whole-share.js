import { WHOLE_SLOT_ORDER } from './constants.js';

function matchesWholeShareEntry(entry, shareIndex) {
  return entry.shareIndex === shareIndex;
}

export function isDoubleNightWholeShare(entries = [], shareIndex) {
  return entries.some(
    (entry) =>
      matchesWholeShareEntry(entry, shareIndex)
      && entry.slotKey === 'DAY1'
      && entry.shiftType === 'NS',
  );
}

export function getActiveWholeSlotKeysForShare(entries = [], shareIndex) {
  return isDoubleNightWholeShare(entries, shareIndex) ? ['DAY1', 'NS'] : WHOLE_SLOT_ORDER;
}

export function countWholeShareSlots(entries = [], wholeShares = 0) {
  let total = 0;
  for (let shareIndex = 1; shareIndex <= wholeShares; shareIndex += 1) {
    total += getActiveWholeSlotKeysForShare(entries, shareIndex).length;
  }
  return total;
}

export function countRemainingWholeShareSlots(entries = [], wholeShares = 0, roundHint = 1) {
  let total = 0;
  for (let shareIndex = roundHint; shareIndex <= wholeShares; shareIndex += 1) {
    total += getActiveWholeSlotKeysForShare(entries, shareIndex).length;
  }
  return total;
}

export function normalizeWholeShareEntriesForDoubleNight(entries = []) {
  const doubleNightKeys = new Set(
    entries
      .filter((entry) => entry.slotKey === 'DAY1' && entry.shiftType === 'NS')
      .map((entry) => String(entry.shareIndex)),
  );

  return entries.map((entry) => {
    const shareKey = String(entry.shareIndex);
    if (!doubleNightKeys.has(shareKey) || entry.slotKey !== 'DAY2') return entry;
    return {
      ...entry,
      shiftType: '',
      firstChoiceDate: '',
      secondChoiceDate: '',
    };
  });
}
