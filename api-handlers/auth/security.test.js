import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  users,
  institutions,
  eq,
  and,
  gt,
  checkRateLimit,
  resetRateLimit,
  verifyPassword,
  signToken,
  setSessionCookie,
  hashPassword,
  hashToken,
  generateToken,
  tokenExpiresAt,
  sendEmail,
  passwordResetEmail,
} = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    passwordHash: 'users.passwordHash',
    name: 'users.name',
    role: 'users.role',
    institutionId: 'users.institutionId',
    isActive: 'users.isActive',
    isActivated: 'users.isActivated',
    activationTokenHash: 'users.activationTokenHash',
    activationTokenExpiresAt: 'users.activationTokenExpiresAt',
    resetTokenHash: 'users.resetTokenHash',
    resetTokenExpiresAt: 'users.resetTokenExpiresAt',
  },
  institutions: {
    id: 'institutions.id',
    name: 'institutions.name',
    abbreviation: 'institutions.abbreviation',
  },
  eq: vi.fn((...args) => ({ op: 'eq', args })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  gt: vi.fn((...args) => ({ op: 'gt', args })),
  checkRateLimit: vi.fn(),
  resetRateLimit: vi.fn(),
  verifyPassword: vi.fn(),
  signToken: vi.fn(),
  setSessionCookie: vi.fn(),
  hashPassword: vi.fn(),
  hashToken: vi.fn(),
  generateToken: vi.fn(),
  tokenExpiresAt: vi.fn(),
  sendEmail: vi.fn(),
  passwordResetEmail: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({ db }));
vi.mock('../../db/schema/users.js', () => ({ users }));
vi.mock('../../db/schema/institutions.js', () => ({ institutions }));
vi.mock('drizzle-orm', () => ({ eq, and, gt }));
vi.mock('../../lib/middleware/with-method.js', () => ({
  withMethod: (_methods, handler) => handler,
}));
vi.mock('../../lib/middleware/with-rate-limit.js', () => ({
  checkRateLimit,
  resetRateLimit,
}));
vi.mock('../../lib/auth-utils.js', () => ({
  verifyPassword,
  signToken,
  setSessionCookie,
  hashPassword,
  hashToken,
  generateToken,
  tokenExpiresAt,
}));
vi.mock('../../lib/email.js', () => ({ sendEmail }));
vi.mock('../../lib/email-templates.js', () => ({ passwordResetEmail }));

import loginHandler from './login.js';
import activateHandler from './activate.js';
import resetPasswordHandler from './reset-password.js';
import setPasswordHandler from './set-password.js';

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
    setHeader() {},
  };
}

function queueSelectResults(...results) {
  db.select.mockImplementation(() => {
    const result = results.shift() ?? [];
    return {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
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

describe('auth handler security hardening', () => {
  beforeEach(() => {
    db.select.mockReset();
    db.update.mockReset();
    eq.mockClear();
    and.mockClear();
    gt.mockClear();
    checkRateLimit.mockReset();
    resetRateLimit.mockReset();
    verifyPassword.mockReset();
    signToken.mockReset();
    setSessionCookie.mockReset();
    hashPassword.mockReset();
    hashToken.mockReset();
    generateToken.mockReset();
    tokenExpiresAt.mockReset();
    sendEmail.mockReset();
    passwordResetEmail.mockReset();

    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    verifyPassword.mockResolvedValue(true);
    signToken.mockReturnValue('signed-session');
    hashPassword.mockResolvedValue('password-hash');
    hashToken.mockImplementation((token) => `hashed:${token}`);
    generateToken.mockReturnValue('raw-reset-token');
    tokenExpiresAt.mockReturnValue(new Date('2026-04-23T13:00:00Z'));
    passwordResetEmail.mockReturnValue({
      subject: 'Reset password',
      html: '<p>reset</p>',
      text: 'reset',
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes loginAt when signing a session token during login', async () => {
    queueSelectResults([{
      id: 'user-1',
      email: 'admin@example.org',
      passwordHash: 'stored-password-hash',
      name: 'Admin User',
      role: 'admin',
      institutionId: 'inst-1',
      institutionName: 'Example Institution',
      institutionAbbreviation: 'EX',
      isActive: true,
      isActivated: true,
    }]);
    mockUpdate();

    const req = {
      method: 'POST',
      body: {
        email: 'admin@example.org',
        password: 'Password1!',
      },
    };
    const res = createResponseRecorder();

    await loginHandler(req, res);

    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      role: 'admin',
      email: 'admin@example.org',
      institutionId: 'inst-1',
      loginAt: Math.floor(Date.now() / 1000),
    }));
    expect(setSessionCookie).toHaveBeenCalledWith(res, 'signed-session');
    expect(res.statusCode).toBe(200);
  });

  it('rejects activation passwords that are missing a special character', async () => {
    queueSelectResults([]);

    const req = {
      method: 'POST',
      body: {
        token: 'invite-token',
        password: 'Password1',
        confirmPassword: 'Password1',
      },
    };
    const res = createResponseRecorder();

    await activateHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      code: 'VALIDATION_ERROR',
      error: expect.stringMatching(/special/i),
    });
  });

  it('hashes activation tokens before lookup and clears hashed activation fields', async () => {
    queueSelectResults([{
      id: 'user-1',
      email: 'pi@example.org',
      name: 'PI User',
      role: 'pi',
      institutionId: null,
    }]);
    const { set } = mockUpdate();

    const req = {
      method: 'POST',
      body: {
        token: 'invite-token',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      },
    };
    const res = createResponseRecorder();

    await activateHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('invite-token');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: 'password-hash',
      isActivated: true,
      activationTokenHash: null,
      activationTokenExpiresAt: null,
    }));
    expect(res.statusCode).toBe(200);
  });

  it('stores password reset tokens in dedicated hashed columns', async () => {
    queueSelectResults([{
      id: 'user-1',
      email: 'pi@example.org',
      name: 'PI User',
      isActive: true,
      isActivated: true,
    }]);
    const { set } = mockUpdate();

    const req = {
      method: 'POST',
      body: {
        email: 'pi@example.org',
      },
    };
    const res = createResponseRecorder();

    await resetPasswordHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('raw-reset-token');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      resetTokenHash: 'hashed:raw-reset-token',
      resetTokenExpiresAt: new Date('2026-04-23T13:00:00Z'),
      updatedAt: expect.any(Date),
    }));
    expect(set.mock.calls[0][0]).not.toHaveProperty('activationToken');
    expect(passwordResetEmail).toHaveBeenCalledWith(expect.objectContaining({
      resetToken: 'raw-reset-token',
    }));
    expect(sendEmail).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('hashes reset tokens before lookup and clears reset token fields after password set', async () => {
    queueSelectResults([{
      id: 'user-1',
      email: 'pi@example.org',
    }]);
    const { set } = mockUpdate();

    const req = {
      method: 'POST',
      body: {
        token: 'reset-token',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      },
    };
    const res = createResponseRecorder();

    await setPasswordHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('reset-token');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: 'password-hash',
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    }));
    expect(set.mock.calls[0][0]).not.toHaveProperty('activationToken');
    expect(res.statusCode).toBe(200);
  });
});
