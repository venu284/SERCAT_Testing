export const toDateStr = (d) => d.toISOString().split('T')[0];
export const fromDateStr = (s) => new Date(`${s}T12:00:00`);
export const daysBetween = (a, b) => Math.round(Math.abs(fromDateStr(a) - fromDateStr(b)) / 86400000);
export const daysBetweenSigned = (from, to) => Math.round((fromDateStr(to) - fromDateStr(from)) / 86400000);

export function addDays(dateStr, n) {
  const d = fromDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function localTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatCalendarDate(dateStr) {
  if (!dateStr) return 'N/A';
  return fromDateStr(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateDateRange(start, end) {
  const dates = [];
  let cur = fromDateStr(start);
  const endD = fromDateStr(end);
  while (cur <= endD) {
    dates.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
