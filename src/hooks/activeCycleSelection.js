const ACTIVE_CYCLE_STATUSES = ['collecting', 'scheduling', 'published', 'setup'];

function normalizeCycleStatus(status) {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function selectActiveCycle(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return null;
  }

  for (const status of ACTIVE_CYCLE_STATUSES) {
    const match = cycles.find((cycle) => normalizeCycleStatus(cycle?.status) === status);
    if (match) {
      return match;
    }
  }

  return null;
}
