import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  users,
  institutions,
  masterShares,
  eq,
  ilike,
  and,
  ne,
  count,
  generateToken,
  tokenExpiresAt,
  hashToken,
  sendEmail,
  accountInviteEmail,
  logAudit,
} = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    name: 'users.name',
    role: 'users.role',
    institutionId: 'users.institutionId',
    isActive: 'users.isActive',
    isActivated: 'users.isActivated',
    passwordHash: 'users.passwordHash',
    lastLoginAt: 'users.lastLoginAt',
  },
  institutions: {
    id: 'institutions.id',
    name: 'institutions.name',
    abbreviation: 'institutions.abbreviation',
  },
  masterShares: {
    id: 'masterShares.id',
    piId: 'masterShares.piId',
  },
  eq: vi.fn((...args) => ({ op: 'eq', args })),
  ilike: vi.fn((...args) => ({ op: 'ilike', args })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  ne: vi.fn((...args) => ({ op: 'ne', args })),
  count: vi.fn(() => ({ op: 'count' })),
  generateToken: vi.fn(),
  tokenExpiresAt: vi.fn(),
  hashToken: vi.fn(),
  sendEmail: vi.fn(),
  accountInviteEmail: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('../db/index.js', () => ({ db }));
vi.mock('../db/schema/users.js', () => ({ users }));
vi.mock('../db/schema/institutions.js', () => ({ institutions }));
vi.mock('../db/schema/master-shares.js', () => ({ masterShares }));
vi.mock('drizzle-orm', () => ({ eq, ilike, and, ne, count }));
vi.mock('../lib/auth-utils.js', () => ({
  generateToken,
  tokenExpiresAt,
  hashToken,
}));
vi.mock('../lib/email.js', () => ({ sendEmail }));
vi.mock('../lib/email-templates.js', () => ({ accountInviteEmail }));
vi.mock('../lib/audit.js', () => ({ logAudit }));
vi.mock('../lib/pagination.js', () => ({
  parsePagination: () => ({ page: 1, limit: 50, offset: 0 }),
  paginatedResponse: (rows, total, page, limit) => ({ data: rows, meta: { total, page, limit } }),
}));
vi.mock('../lib/middleware/with-auth.js', () => ({
  withAuth: (handler) => handler,
}));
vi.mock('../lib/middleware/with-admin.js', () => ({
  withAdmin: (handler) => handler,
}));
vi.mock('../lib/middleware/with-method.js', () => ({
  withMethod: (_methods, handler) => handler,
}));

import usersIndexHandler from './users/index.js';
import resendInviteHandler from './users/[id]/resend-invite.js';
import updateUserHandler from './users/[id].js';
import sharesUploadHandler from './shares/upload.js';

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
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    };
  });
}

function queueInsertPlans(...plans) {
  const calls = [];

  db.insert.mockImplementation((table) => {
    const plan = plans.shift() ?? {};
    const record = {
      table,
      valuesArgs: [],
    };
    calls.push(record);

    const returning = vi.fn().mockResolvedValue(plan.returning ?? []);
    const values = vi.fn((payload) => {
      record.valuesArgs.push(payload);
      if (Object.prototype.hasOwnProperty.call(plan, 'returning')) {
        return { returning };
      }
      return Promise.resolve(plan.resolve);
    });

    return { values };
  });

  return calls;
}

function queueUpdatePlans(...plans) {
  const calls = [];

  db.update.mockImplementation((table) => {
    const plan = plans.shift() ?? {};
    const record = {
      table,
      setArgs: [],
      whereArgs: [],
      returningArgs: [],
    };
    calls.push(record);

    const returning = vi.fn((fields) => {
      record.returningArgs.push(fields);
      return Promise.resolve(plan.returning ?? []);
    });
    const where = vi.fn((condition) => {
      record.whereArgs.push(condition);
      if (Object.prototype.hasOwnProperty.call(plan, 'returning')) {
        return { returning };
      }
      return Promise.resolve(plan.resolve);
    });
    const set = vi.fn((payload) => {
      record.setArgs.push(payload);
      return { where };
    });

    return { set };
  });

  return calls;
}

describe('invite token storage hardening', () => {
  beforeEach(() => {
    db.select.mockReset();
    db.insert.mockReset();
    db.update.mockReset();
    eq.mockClear();
    ilike.mockClear();
    and.mockClear();
    ne.mockClear();
    count.mockClear();
    generateToken.mockReset();
    tokenExpiresAt.mockReset();
    hashToken.mockReset();
    sendEmail.mockReset();
    accountInviteEmail.mockReset();
    logAudit.mockReset();

    generateToken.mockReturnValue('raw-invite-token');
    tokenExpiresAt.mockReturnValue(new Date('2026-04-26T12:00:00Z'));
    hashToken.mockImplementation((token) => `hashed:${token}`);
    accountInviteEmail.mockReturnValue({
      subject: 'Invite',
      html: '<p>invite</p>',
      text: 'invite',
    });
    logAudit.mockResolvedValue(undefined);
  });

  it('hashes activation tokens before storing newly created users', async () => {
    queueSelectResults([]);
    const insertCalls = queueInsertPlans({
      returning: [{
        id: 'user-1',
        email: 'pi@example.org',
        name: 'PI User',
        role: 'pi',
        institutionId: null,
        isActive: true,
        isActivated: false,
      }],
    });

    const req = {
      method: 'POST',
      user: { userId: 'admin-1', role: 'admin' },
      body: {
        email: 'pi@example.org',
        name: 'PI User',
        role: 'pi',
      },
    };
    const res = createResponseRecorder();

    await usersIndexHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('raw-invite-token');
    expect(insertCalls[0].valuesArgs[0]).toEqual(expect.objectContaining({
      email: 'pi@example.org',
      activationTokenHash: 'hashed:raw-invite-token',
      activationTokenExpiresAt: new Date('2026-04-26T12:00:00Z'),
    }));
    expect(insertCalls[0].valuesArgs[0]).not.toHaveProperty('activationToken');
    expect(accountInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      activationToken: 'raw-invite-token',
    }));
    expect(res.payload.data.activationToken).toBe('raw-invite-token');
  });

  it('hashes activation tokens when resending invites', async () => {
    queueSelectResults([{
      id: 'user-1',
      email: 'pi@example.org',
      name: 'PI User',
      isActivated: false,
    }]);
    const updateCalls = queueUpdatePlans({ resolve: [] });

    const req = {
      method: 'POST',
      user: { userId: 'admin-1', role: 'admin' },
      query: { id: 'user-1' },
      body: {},
    };
    const res = createResponseRecorder();

    await resendInviteHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('raw-invite-token');
    expect(updateCalls[0].setArgs[0]).toEqual(expect.objectContaining({
      activationTokenHash: 'hashed:raw-invite-token',
      activationTokenExpiresAt: new Date('2026-04-26T12:00:00Z'),
      updatedAt: expect.any(Date),
    }));
    expect(updateCalls[0].setArgs[0]).not.toHaveProperty('activationToken');
    expect(res.payload.data.activationToken).toBe('raw-invite-token');
  });

  it('hashes activation tokens when resetting a pending invite through the user update endpoint', async () => {
    queueSelectResults([{
      id: 'user-1',
      email: 'pi@example.org',
      name: 'PI User',
      role: 'pi',
      institutionId: 'inst-1',
      isActive: true,
      isActivated: true,
    }]);
    const updateCalls = queueUpdatePlans({
      returning: [{
        id: 'user-1',
        email: 'pi@example.org',
        name: 'PI User',
        role: 'pi',
        institutionId: 'inst-1',
        isActive: true,
        isActivated: false,
      }],
    });

    const req = {
      method: 'PUT',
      user: { userId: 'admin-1', role: 'admin' },
      query: { id: 'user-1' },
      body: { resetActivation: true },
    };
    const res = createResponseRecorder();

    await updateUserHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('raw-invite-token');
    expect(updateCalls[0].setArgs[0]).toEqual(expect.objectContaining({
      activationTokenHash: 'hashed:raw-invite-token',
      activationTokenExpiresAt: new Date('2026-04-26T12:00:00Z'),
      isActivated: false,
      passwordHash: null,
      lastLoginAt: null,
      updatedAt: expect.any(Date),
    }));
    expect(updateCalls[0].setArgs[0]).not.toHaveProperty('activationToken');
    expect(res.payload.data.activationToken).toBe('raw-invite-token');
  });

  it('hashes activation tokens when uploading and inviting a new PI', async () => {
    queueSelectResults([], [], []);
    const insertCalls = queueInsertPlans(
      { returning: [{ id: 'inst-1', name: 'Example Institution', abbreviation: 'EX' }] },
      {
        returning: [{
          id: 'user-1',
          email: 'pi@example.org',
          name: 'PI User',
          institutionId: 'inst-1',
        }],
      },
      { resolve: undefined },
    );

    const req = {
      method: 'POST',
      user: { userId: 'admin-1', role: 'admin' },
      body: {
        rows: [{
          institutionName: 'Example Institution',
          abbreviation: 'EX',
          piName: 'PI User',
          piEmail: 'pi@example.org',
          wholeShares: 2,
          fractionalShares: 0.5,
        }],
      },
    };
    const res = createResponseRecorder();

    await sharesUploadHandler(req, res);

    expect(hashToken).toHaveBeenCalledWith('raw-invite-token');
    expect(insertCalls[1].valuesArgs[0]).toEqual(expect.objectContaining({
      email: 'pi@example.org',
      activationTokenHash: 'hashed:raw-invite-token',
      activationTokenExpiresAt: new Date('2026-04-26T12:00:00Z'),
    }));
    expect(insertCalls[1].valuesArgs[0]).not.toHaveProperty('activationToken');
    expect(accountInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      activationToken: 'raw-invite-token',
    }));
    expect(res.payload.data.inviteTokens).toEqual([{
      email: 'pi@example.org',
      name: 'PI User',
      token: 'raw-invite-token',
    }]);
  });
});
