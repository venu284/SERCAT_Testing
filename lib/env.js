const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

function readEnv(name) {
  const value = process.env[name];
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getOptionalEnv(name) {
  return readEnv(name);
}

export function getEnvOrDefault(name, defaultValue) {
  return getOptionalEnv(name) ?? defaultValue;
}

export function getRequiredEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getRequiredDatabaseUrl(name = 'DATABASE_URL') {
  const value = getRequiredEnv(name);

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`Invalid ${name}: expected a PostgreSQL connection string`);
  }

  if (!POSTGRES_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`Invalid ${name}: expected a PostgreSQL connection string`);
  }

  return value;
}
