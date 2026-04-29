import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  users,
  eq,
  and,
  gt,
  hashToken,
  logAudit,
} = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    pendingEmail: 'users.pendingEmail',
    emailVerifyTokenHash: 'users.emailVerifyTokenHash',
    emailVerifyTokenExpiresAt: 'users.emailVerifyTokenExpiresAt',
  },
  eq: vi.fn((...args) => ({ op: 'eq', args })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  gt: vi.fn((...args) => ({ op: 'gt', args })),
  hashToken: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({ db }));
vi.mock('../../db/schema/users.js', () => ({ users }));
vi.mock('drizzle-orm', () => ({ eq, and, gt }));
vi.mock('../../lib/middleware/with-method.js', () => ({
  withMethod: (_method, handler) => handler,
}));
vi.mock('../../lib/auth-utils.js', () => ({ hashToken }));
vi.mock('../../lib/audit.js', () => ({ logAudit }));

import handler from './verify-email.js';

function createRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

function queueSelectResults(...results) {
  db.select.mockImplementation(() => {
    const result = results.shift() ?? [];
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
    };
  });
}

function mockUpdate() {
  const set = vi.fn(() => ({
    where: vi.fn().mockResolvedValue([]),
  }));
  db.update.mockReturnValue({ set });
  return { set };
}

describe('verify-email handler', () => {
  beforeEach(() => {
    db.select.mockReset();
    db.update.mockReset();
    hashToken.mockImplementation((t) => `hashed:${t}`);
    logAudit.mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when token query param is missing', async () => {
    const req = { method: 'GET', query: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('TOKEN_MISSING');
  });

  it('returns 400 when token does not match any user', async () => {
    queueSelectResults([]);
    const req = { method: 'GET', query: { token: 'bad-token' } };
    const res = createRes();

    await handler(req, res);

    expect(hashToken).toHaveBeenCalledWith('bad-token');
    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('TOKEN_INVALID');
  });

  it('returns 400 when matched user has no pendingEmail', async () => {
    queueSelectResults([{ id: 'user-1', pendingEmail: null }]);
    mockUpdate();
    const req = { method: 'GET', query: { token: 'valid-token' } };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('NO_PENDING_EMAIL');
  });

  it('applies email change and clears verify token fields on success', async () => {
    queueSelectResults([{ id: 'user-1', pendingEmail: 'new@example.org' }]);
    const { set } = mockUpdate();

    const req = { method: 'GET', query: { token: 'valid-token' } };
    const res = createRes();

    await handler(req, res);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.org',
      pendingEmail: null,
      emailVerifyTokenHash: null,
      emailVerifyTokenExpiresAt: null,
    }));
    expect(logAudit).toHaveBeenCalledWith('user-1', 'user.email_change_verified', { newEmail: 'new@example.org' });
    expect(res.statusCode).toBe(200);
    expect(res.payload.data.message).toBe('Email updated successfully.');
  });
});
