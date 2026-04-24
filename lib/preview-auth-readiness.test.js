import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('preview auth readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
  });

  it('fails fast with explicit missing auth env checks', async () => {
    const { runPreviewAuthReadinessCheck } = await import('./preview-auth-readiness.js');

    const result = await runPreviewAuthReadinessCheck({
      db: {
        execute: vi.fn(),
        select: vi.fn(),
      },
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 500,
      error: 'Preview auth readiness check failed',
      code: 'PREVIEW_AUTH_NOT_READY',
      checks: [
        {
          name: 'DATABASE_URL',
          ok: false,
          detail: 'Missing required environment variable',
        },
        {
          name: 'JWT_SECRET',
          ok: false,
          detail: 'Missing required environment variable',
        },
      ],
    });
  });

  it('fails when the seeded preview admin account is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@example.com/db?sslmode=require';
    process.env.JWT_SECRET = 'x'.repeat(64);

    const { runPreviewAuthReadinessCheck } = await import('./preview-auth-readiness.js');

    const result = await runPreviewAuthReadinessCheck({
      db: {
        execute: vi.fn().mockResolvedValue({ rows: [{ now: '2026-04-23T12:00:00.000Z' }] }),
        select: vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        })),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('PREVIEW_AUTH_NOT_READY');
    expect(result.checks).toEqual([
      {
        name: 'DATABASE_URL',
        ok: true,
        detail: 'Configured',
      },
      {
        name: 'JWT_SECRET',
        ok: true,
        detail: 'Configured',
      },
      {
        name: 'databaseConnection',
        ok: true,
        detail: 'Connected',
      },
      {
        name: 'seededAdmin',
        ok: false,
        detail: 'admin@sercat.org was not found in users',
      },
    ]);
  });

  it('passes when env, database, and seeded admin are all ready', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@example.com/db?sslmode=require';
    process.env.JWT_SECRET = 'x'.repeat(64);

    const { runPreviewAuthReadinessCheck } = await import('./preview-auth-readiness.js');

    const result = await runPreviewAuthReadinessCheck({
      db: {
        execute: vi.fn().mockResolvedValue({ rows: [{ now: '2026-04-23T12:00:00.000Z' }] }),
        select: vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{
            email: 'admin@sercat.org',
            isActive: true,
            isActivated: true,
          }]),
        })),
      },
    });

    expect(result).toEqual({
      ok: true,
      statusCode: 200,
      checks: [
        {
          name: 'DATABASE_URL',
          ok: true,
          detail: 'Configured',
        },
        {
          name: 'JWT_SECRET',
          ok: true,
          detail: 'Configured',
        },
        {
          name: 'databaseConnection',
          ok: true,
          detail: 'Connected',
        },
        {
          name: 'seededAdmin',
          ok: true,
          detail: 'admin@sercat.org is active and activated',
        },
      ],
      timestamp: '2026-04-23T12:00:00.000Z',
    });
  });
});
