const attempts = new Map(); // key: email, value: { count, firstAttemptAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function cleanExpired() {
  const now = Date.now();
  for (const [key, value] of attempts) {
    if (now - value.firstAttemptAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function checkRateLimit(email) {
  cleanExpired();
  const key = email.toLowerCase().trim();
  const record = attempts.get(key);

  if (!record) {
    attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (Date.now() - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (Date.now() - record.firstAttemptAt);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  record.count += 1;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
}

export function resetRateLimit(email) {
  attempts.delete(email.toLowerCase().trim());
}
