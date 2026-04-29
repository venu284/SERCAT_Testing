import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  users,
  eq,
  and,
  ilike,
  ne,
  withAuth,
  hashToken,
  generateToken,
  tokenExpiresAt,
  sendEmail,
  emailVerifyEmail,
  logAudit,
} = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    name: 'users.name',
    role: 'users.role',
    pendingEmail: 'users.pendingEmail',
    emailVerifyTokenHash: 'users.emailVerifyTokenHash',
    emailVerifyTokenExpiresAt: 'users.emailVerifyTokenExpiresAt',
  },
  eq: vi.fn((...args) => ({ op: 'eq', args })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  ilike: vi.fn((...args) => ({ op: 'ilike', args })),
  ne: vi.fn((...args) => ({ op: 'ne', args })),
  withAuth: vi.fn((_fn) => _fn),
  hashToken: vi.fn(),
  generateToken: vi.fn(),
  tokenExpiresAt: vi.fn(),
  sendEmail: vi.fn(),
  emailVerifyEmail: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('../../../db/index.js', () => ({ db }));
vi.mock('../../../db/schema/users.js', () => ({ users }));
vi.mock('drizzle-orm', () => ({ eq, and, ilike, ne }));
vi.mock('../../../lib/middleware/with-auth.js', () => ({ withAuth }));
vi.mock('../../../lib/middleware/with-method.js', () => ({
  withMethod: (_method, handler) => handler,
}));
vi.mock('../../../lib/auth-utils.js', () => ({ hashToken, generateToken, tokenExpiresAt }));
vi.mock('../../../lib/email.js', () => ({ sendEmail }));
vi.mock('../../../lib/email-templates.js', () => ({ emailVerifyEmail }));
vi.mock('../../../lib/audit.js', () => ({ logAudit }));
vi.mock('../../../lib/validation.js', () => ({
  getZodMessage: (err) => err.errors?.[0]?.message ?? 'Validation error',
}));
vi.mock('../../../lib/env.js', () => ({
  getEnvOrDefault: (_key, fallback) => fallback,
}));

import handler from './request-email-change.js';

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

describe('request-email-change handler', () => {
  beforeEach(() => {
    db.select.mockReset();
    db.update.mockReset();
    hashToken.mockImplementation((t) => `hashed:${t}`);
    generateToken.mockReturnValue('raw-verify-token');
    tokenExpiresAt.mockReturnValue(new Date('2026-04-29T12:00:00Z'));
    sendEmail.mockResolvedValue({ ok: true });
    emailVerifyEmail.mockReturnValue({ subject: 'Confirm email', html: '<p>confirm</p>', text: 'confirm' });
    logAudit.mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when non-admin targets another user', async () => {
    const req = {
      method: 'POST',
      query: { id: 'other-user' },
      user: { userId: 'self-user', role: 'pi' },
      body: { email: 'new@example.org' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('FORBIDDEN');
  });

  it('returns 404 when user does not exist', async () => {
    queueSelectResults([]);
    const req = {
      method: 'POST',
      query: { id: 'self-user' },
      user: { userId: 'self-user', role: 'pi' },
      body: { email: 'new@example.org' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when new email matches current email', async () => {
    queueSelectResults([{ id: 'self-user', email: 'current@example.org', name: 'Ada' }]);
    const req = {
      method: 'POST',
      query: { id: 'self-user' },
      user: { userId: 'self-user', role: 'pi' },
      body: { email: 'current@example.org' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('SAME_EMAIL');
  });

  it('returns 409 when new email already belongs to another user', async () => {
    queueSelectResults(
      [{ id: 'self-user', email: 'current@example.org', name: 'Ada' }],
      [{ id: 'other-user', email: 'taken@example.org' }],
    );
    const req = {
      method: 'POST',
      query: { id: 'self-user' },
      user: { userId: 'self-user', role: 'pi' },
      body: { email: 'taken@example.org' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('DUPLICATE');
  });

  it('stores hashed token and sends verification email on success', async () => {
    queueSelectResults(
      [{ id: 'self-user', email: 'current@example.org', name: 'Ada' }],
      [],
    );
    const { set } = mockUpdate();

    const req = {
      method: 'POST',
      query: { id: 'self-user' },
      user: { userId: 'self-user', role: 'pi' },
      body: { email: 'new@example.org' },
    };
    const res = createRes();

    await handler(req, res);

    expect(generateToken).toHaveBeenCalled();
    expect(hashToken).toHaveBeenCalledWith('raw-verify-token');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      pendingEmail: 'new@example.org',
      emailVerifyTokenHash: 'hashed:raw-verify-token',
      emailVerifyTokenExpiresAt: new Date('2026-04-29T12:00:00Z'),
    }));
    expect(emailVerifyEmail).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ada',
      verifyUrl: expect.stringContaining('raw-verify-token'),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'new@example.org',
    }));
    expect(logAudit).toHaveBeenCalledWith('self-user', 'user.email_change_requested', expect.any(Object));
    expect(res.statusCode).toBe(200);
  });
});
