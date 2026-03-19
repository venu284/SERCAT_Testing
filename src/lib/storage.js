export const STORAGE_KEY = 'sercat-ui-state-v2-current-run';

export function loadStoredSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Failed to parse stored SERCAT UI state.', error);
    return null;
  }
}

export function saveStoredSnapshot(snapshot) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.error('Failed to save SERCAT UI state.', error);
    return false;
  }
}

export function clearStoredSnapshot() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
