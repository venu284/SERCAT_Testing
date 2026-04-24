import { eq, sql } from 'drizzle-orm';
import { users } from '../db/schema/users.js';
import { getRequiredDatabaseUrl } from './env.js';

const SEEDED_ADMIN_EMAIL = 'admin@sercat.org';

function okCheck(name, detail) {
  return { name, ok: true, detail };
}

function failedCheck(name, detail) {
  return { name, ok: false, detail };
}

function readTrimmedEnv(env, name) {
  const value = env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildFailure(checks) {
  return {
    ok: false,
    statusCode: 500,
    error: 'Preview auth readiness check failed',
    code: 'PREVIEW_AUTH_NOT_READY',
    checks,
  };
}

export async function runPreviewAuthReadinessCheck({ db, env = process.env } = {}) {
  const checks = [];

  try {
    getRequiredDatabaseUrl();
    checks.push(okCheck('DATABASE_URL', 'Configured'));
  } catch (error) {
    const detail = String(error?.message || '').includes('Missing required environment variable')
      ? 'Missing required environment variable'
      : 'Invalid PostgreSQL connection string';
    checks.push(failedCheck('DATABASE_URL', detail));
  }

  if (readTrimmedEnv(env, 'JWT_SECRET')) {
    checks.push(okCheck('JWT_SECRET', 'Configured'));
  } else {
    checks.push(failedCheck('JWT_SECRET', 'Missing required environment variable'));
  }

  if (checks.some((check) => !check.ok)) {
    return buildFailure(checks);
  }

  let timestamp = new Date().toISOString();

  try {
    const result = await db.execute(sql`SELECT NOW() as now`);
    timestamp = result.rows?.[0]?.now || timestamp;
    checks.push(okCheck('databaseConnection', 'Connected'));
  } catch (error) {
    checks.push(failedCheck('databaseConnection', error?.message || 'Failed to connect to the database'));
    return buildFailure(checks);
  }

  try {
    const [admin] = await db
      .select({
        email: users.email,
        isActive: users.isActive,
        isActivated: users.isActivated,
      })
      .from(users)
      .where(eq(users.email, SEEDED_ADMIN_EMAIL))
      .limit(1);

    if (!admin) {
      checks.push(failedCheck('seededAdmin', `${SEEDED_ADMIN_EMAIL} was not found in users`));
      return buildFailure(checks);
    }

    if (!admin.isActive) {
      checks.push(failedCheck('seededAdmin', `${SEEDED_ADMIN_EMAIL} is deactivated`));
      return buildFailure(checks);
    }

    if (!admin.isActivated) {
      checks.push(failedCheck('seededAdmin', `${SEEDED_ADMIN_EMAIL} is not activated`));
      return buildFailure(checks);
    }

    checks.push(okCheck('seededAdmin', `${SEEDED_ADMIN_EMAIL} is active and activated`));
  } catch (error) {
    checks.push(failedCheck('seededAdmin', error?.message || `Unable to query ${SEEDED_ADMIN_EMAIL}`));
    return buildFailure(checks);
  }

  return {
    ok: true,
    statusCode: 200,
    checks,
    timestamp,
  };
}

export { SEEDED_ADMIN_EMAIL };
