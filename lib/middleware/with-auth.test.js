import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getSessionCookie,
  verifyToken,
  signToken,
  setSessionCookie,
} = vi.hoisted(() => ({
  getSessionCookie: vi.fn(),
  verifyToken: vi.fn(),
  signToken: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock('../auth-utils.js', () => ({
  getSessionCookie,
  verifyToken,
  signToken,
  setSessionCookie,
}));

import { withAuth } from './with-auth.js';

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

describe('withAuth', () => {
  beforeEach(() => {
    getSessionCookie.mockReset();
    verifyToken.mockReset();
    signToken.mockReset();
    setSessionCookie.mockReset();
  });

  it('preserves loginAt when renewing a session', async () => {
    const downstream = vi.fn((req, res) => res.status(204).json({ ok: true }));

    getSessionCookie.mockReturnValue('session-cookie');
    verifyToken.mockReturnValue({
      userId: 'user-1',
      role: 'admin',
      email: 'admin@example.org',
      institutionId: 'inst-1',
      loginAt: 1_234_567,
    });
    signToken.mockReturnValue('renewed-token');

    const req = { headers: {} };
    const res = createResponseRecorder();

    await withAuth(downstream)(req, res);

    expect(signToken).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'admin',
      email: 'admin@example.org',
      institutionId: 'inst-1',
      loginAt: 1_234_567,
    });
    expect(setSessionCookie).toHaveBeenCalledWith(res, 'renewed-token');
    expect(req.user).toEqual({
      userId: 'user-1',
      role: 'admin',
      email: 'admin@example.org',
      institutionId: 'inst-1',
    });
    expect(downstream).toHaveBeenCalledWith(req, res);
  });
});
