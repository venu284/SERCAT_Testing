const attempts = new Map(); // key: email, value: { count, firstAttemptAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function cleanExpiredMap(map) {
  const now = Date.now();
  for (const [key, value] of map) {
    if (now - value.firstAttemptAt > WINDOW_MS) {
      map.delete(key);
    }
  }
}

export function checkRateLimit(email) {
  cleanExpiredMap(attempts);
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

const tokenAttempts = new Map(); // key: IP, value: { count, firstAttemptAt }
const TOKEN_MAX_ATTEMPTS = 10;

export function checkTokenRateLimit(ip) {
  cleanExpiredMap(tokenAttempts);
  const key = String(ip || 'unknown').toLowerCase();
  const record = tokenAttempts.get(key);

  if (!record) {
    tokenAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return { allowed: true, remaining: TOKEN_MAX_ATTEMPTS - 1 };
  }

  if (Date.now() - record.firstAttemptAt > WINDOW_MS) {
    tokenAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return { allowed: true, remaining: TOKEN_MAX_ATTEMPTS - 1 };
  }

  if (record.count >= TOKEN_MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (Date.now() - record.firstAttemptAt);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  record.count += 1;
  return { allowed: true, remaining: TOKEN_MAX_ATTEMPTS - record.count };
}
