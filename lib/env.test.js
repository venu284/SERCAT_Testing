import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('env helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TEST_VALUE;
    delete process.env.DATABASE_URL;
  });

  it('trims required environment variables', async () => {
    process.env.TEST_VALUE = '  keep-me  ';

    const { getRequiredEnv } = await import('./env.js');

    expect(getRequiredEnv('TEST_VALUE')).toBe('keep-me');
  });

  it('rejects blank required environment variables with a clear error', async () => {
    process.env.TEST_VALUE = '   ';

    const { getRequiredEnv } = await import('./env.js');

    expect(() => getRequiredEnv('TEST_VALUE')).toThrow(/TEST_VALUE/);
  });

  it('validates database urls after trimming', async () => {
    process.env.DATABASE_URL = '  postgresql://user:pass@example.com/db?sslmode=require  ';

    const { getRequiredDatabaseUrl } = await import('./env.js');

    expect(getRequiredDatabaseUrl()).toBe('postgresql://user:pass@example.com/db?sslmode=require');
  });
});
