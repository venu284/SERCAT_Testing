import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  cycles,
  preferences,
  fractionalPreferences,
  users,
  institutions,
  eq,
  and,
  sendEmail,
  preferenceConfirmationEmail,
  createNotification,
} = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  },
  cycles: {
    id: 'cycles.id',
    name: 'cycles.name',
    status: 'cycles.status',
    preferenceDeadline: 'cycles.preferenceDeadline',
  },
  preferences: {
    id: 'preferences.id',
    cycleId: 'preferences.cycleId',
    piId: 'preferences.piId',
    shareIndex: 'preferences.shareIndex',
    shift: 'preferences.shift',
    choice1Date: 'preferences.choice1Date',
    choice2Date: 'preferences.choice2Date',
    submittedAt: 'preferences.submittedAt',
    updatedAt: 'preferences.updatedAt',
  },
  fractionalPreferences: {
    id: 'fractionalPreferences.id',
    cycleId: 'fractionalPreferences.cycleId',
    piId: 'fractionalPreferences.piId',
    blockIndex: 'fractionalPreferences.blockIndex',
    fractionalHours: 'fractionalPreferences.fractionalHours',
    choice1Date: 'fractionalPreferences.choice1Date',
    choice2Date: 'fractionalPreferences.choice2Date',
    submittedAt: 'fractionalPreferences.submittedAt',
    updatedAt: 'fractionalPreferences.updatedAt',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
    institutionId: 'users.institutionId',
  },
  institutions: {
    id: 'institutions.id',
    name: 'institutions.name',
  },
  eq: vi.fn((...args) => ({ op: 'eq', args })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  sendEmail: vi.fn(),
  preferenceConfirmationEmail: vi.fn(() => ({
    subject: 'Preferences submitted',
    html: '<p>submitted</p>',
    text: 'submitted',
  })),
  createNotification: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({ eq, and }));
vi.mock('../../../../db/index.js', () => ({ db }));
vi.mock('../../../../db/schema/cycles.js', () => ({ cycles }));
vi.mock('../../../../db/schema/preferences.js', () => ({ preferences }));
vi.mock('../../../../db/schema/fractional-preferences.js', () => ({ fractionalPreferences }));
vi.mock('../../../../db/schema/users.js', () => ({ users }));
vi.mock('../../../../db/schema/institutions.js', () => ({ institutions }));
vi.mock('../../../../lib/email.js', () => ({ sendEmail }));
vi.mock('../../../../lib/email-templates.js', () => ({ preferenceConfirmationEmail }));
vi.mock('../../../../lib/notifications.js', () => ({ createNotification }));
vi.mock('../../../../lib/middleware/with-auth.js', () => ({
  withAuth: (handler) => handler,
}));
vi.mock('../../../../lib/middleware/with-method.js', () => ({
  withMethod: (_methods, handler) => handler,
}));

import handler from './index.js';

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

function createSubmitRequest(body = {}) {
  return {
    method: 'POST',
    query: { id: 'cycle-1' },
    user: {
      userId: 'pi-1',
      role: 'member',
      email: 'pi@example.org',
      institutionId: 'inst-1',
    },
    body: {
      preferences: [
        {
          shareIndex: 1,
          shift: 'DS1',
          choice1Date: '2026-04-20',
          choice2Date: '2026-04-21',
        },
      ],
      fractionalPreferences: [],
      ...body,
    },
  };
}

function queueSelectResults(...results) {
  db.select.mockImplementation(() => {
    const result = results.shift() ?? [];
    const chain = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn().mockResolvedValue(result),
      orderBy: vi.fn().mockResolvedValue(result),
    };
    return chain;
  });
}

function queueWritePlans() {
  db.delete.mockImplementation(() => ({
    where: vi.fn().mockResolvedValue([]),
  }));
  db.insert.mockImplementation(() => ({
    values: vi.fn().mockResolvedValue([]),
  }));
}

describe('cycle preferences handler', () => {
  beforeEach(() => {
    db.select.mockReset();
    db.delete.mockReset();
    db.insert.mockReset();
    eq.mockClear();
    and.mockClear();
    sendEmail.mockReset();
    preferenceConfirmationEmail.mockClear();
    createNotification.mockReset();
    createNotification.mockResolvedValue(undefined);
    queueWritePlans();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects member preference submissions after the preference deadline', async () => {
    vi.setSystemTime(new Date('2026-04-29T12:00:00-04:00'));
    queueSelectResults([{
      id: 'cycle-1',
      name: 'Spring 2026',
      status: 'collecting',
      preferenceDeadline: '2026-04-28T00:00:00Z',
    }]);

    const res = createResponseRecorder();

    await handler(createSubmitRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({
      error: 'Preference deadline has passed',
      code: 'PREFERENCE_DEADLINE_PASSED',
    });
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('allows member preference submissions on the preference deadline date', async () => {
    vi.setSystemTime(new Date('2026-04-28T12:00:00-04:00'));
    queueSelectResults(
      [{
        id: 'cycle-1',
        name: 'Spring 2026',
        status: 'collecting',
        preferenceDeadline: '2026-04-28T00:00:00Z',
      }],
      [{
        id: 'pi-1',
        institutionId: 'inst-1',
        name: 'PI User',
        email: 'pi@example.org',
      }],
      [{
        shareIndex: 1,
        shift: 'DS1',
        choice1Date: '2026-04-20',
        choice2Date: '2026-04-21',
      }],
      [],
    );

    const res = createResponseRecorder();

    await handler(createSubmitRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(db.delete).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(res.payload.data.preferences).toEqual([
      {
        shareIndex: 1,
        shift: 'DS1',
        choice1Date: '2026-04-20',
        choice2Date: '2026-04-21',
      },
    ]);
  });

  it('keeps existing valid submit behavior before the preference deadline', async () => {
    vi.setSystemTime(new Date('2026-04-27T12:00:00-04:00'));
    queueSelectResults(
      [{
        id: 'cycle-1',
        name: 'Spring 2026',
        status: 'collecting',
        preferenceDeadline: '2026-04-28T00:00:00Z',
      }],
      [{
        id: 'pi-1',
        institutionId: 'inst-1',
        name: 'PI User',
        email: 'pi@example.org',
      }],
      [{
        shareIndex: 1,
        shift: 'DS1',
        choice1Date: '2026-04-20',
        choice2Date: '2026-04-21',
      }],
      [],
    );

    const res = createResponseRecorder();

    await handler(createSubmitRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'pi@example.org',
      subject: 'Preferences submitted',
    }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'pi-1',
      type: 'preference_confirmed',
    }));
  });
});
