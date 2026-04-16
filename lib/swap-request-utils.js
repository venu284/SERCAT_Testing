const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateString(value) {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

export function serializePreferredDates(preferredDates) {
  if (!Array.isArray(preferredDates)) {
    return null;
  }

  const normalized = preferredDates
    .map((value) => String(value || '').trim())
    .filter((value) => isIsoDateString(value));

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export function parsePreferredDates(preferredDates) {
  if (Array.isArray(preferredDates)) {
    return preferredDates
      .map((value) => String(value || '').trim())
      .filter((value) => isIsoDateString(value));
  }

  if (typeof preferredDates !== 'string' || !preferredDates.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(preferredDates);
    return Array.isArray(parsed)
      ? parsed
        .map((value) => String(value || '').trim())
        .filter((value) => isIsoDateString(value))
      : [];
  } catch {
    return [];
  }
}
