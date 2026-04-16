export const toDateStr = (d) => d.toISOString().split('T')[0];
export const fromDateStr = (s) => new Date(`${s}T12:00:00`);
export const daysBetween = (a, b) => Math.round(Math.abs(fromDateStr(a) - fromDateStr(b)) / 86400000);

export function addDays(dateStr, n) {
  const d = fromDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
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
