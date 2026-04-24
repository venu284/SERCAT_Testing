import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dotenvConfig: vi.fn(),
  neon: vi.fn((url) => ({ url })),
  drizzle: vi.fn((_sql, _options) => ({
    select: vi.fn(() => 'select-called'),
  })),
}));

vi.mock('dotenv', () => ({
  default: {
    config: state.dotenvConfig,
  },
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: state.neon,
}));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: state.drizzle,
}));

describe('db bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    state.dotenvConfig.mockReset();
    state.neon.mockClear();
    state.drizzle.mockClear();
    delete process.env.DATABASE_URL;
  });

  it('does not initialize the database during module import', async () => {
    const module = await import('./index.js');

    expect(state.neon).not.toHaveBeenCalled();
    expect(state.drizzle).not.toHaveBeenCalled();
    expect(() => module.db.select()).toThrow(/DATABASE_URL/);
  });

  it('trims DATABASE_URL before initializing neon', async () => {
    process.env.DATABASE_URL = '  postgresql://user:pass@example.com/db?sslmode=require  ';

    const module = await import('./index.js');

    expect(module.db.select()).toBe('select-called');
    expect(state.neon).toHaveBeenCalledWith('postgresql://user:pass@example.com/db?sslmode=require');
    expect(state.drizzle).toHaveBeenCalledTimes(1);
  });
});
