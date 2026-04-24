import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runPreviewAuthReadinessCheck } = vi.hoisted(() => ({
  runPreviewAuthReadinessCheck: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({
  db: {},
}));

vi.mock('../lib/preview-auth-readiness.js', () => ({
  runPreviewAuthReadinessCheck,
}));

import healthHandler from './health.js';

function createResponseRecorder() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

describe('health handler', () => {
  beforeEach(() => {
    runPreviewAuthReadinessCheck.mockReset();
  });

  it('returns a hard failure with explicit auth readiness checks', async () => {
    runPreviewAuthReadinessCheck.mockResolvedValue({
      ok: false,
      statusCode: 500,
      error: 'Preview auth readiness check failed',
      code: 'PREVIEW_AUTH_NOT_READY',
      checks: [
        { name: 'JWT_SECRET', ok: false, detail: 'Missing required environment variable' },
      ],
    });

    const res = createResponseRecorder();

    await healthHandler({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({
      error: 'Preview auth readiness check failed',
      code: 'PREVIEW_AUTH_NOT_READY',
      checks: [
        { name: 'JWT_SECRET', ok: false, detail: 'Missing required environment variable' },
      ],
    });
  });

  it('returns the readiness details when preview auth is healthy', async () => {
    runPreviewAuthReadinessCheck.mockResolvedValue({
      ok: true,
      statusCode: 200,
      timestamp: '2026-04-23T12:00:00.000Z',
      checks: [
        { name: 'JWT_SECRET', ok: true, detail: 'Configured' },
      ],
    });

    const res = createResponseRecorder();

    await healthHandler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      data: {
        status: 'ok',
        database: 'connected',
        timestamp: '2026-04-23T12:00:00.000Z',
        checks: [
          { name: 'JWT_SECRET', ok: true, detail: 'Configured' },
        ],
      },
    });
  });
});
