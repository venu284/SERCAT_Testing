import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  db,
  cycles,
  cycleShares,
  preferences,
  fractionalPreferences,
  users,
  eq,
  and,
  isNotNull,
  sendEmail,
  deadlineReminderEmail,
  createNotification,
  getRequiredEnv,
} = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
  },
  cycles: {
    id: 'cycles.id',
    status: 'cycles.status',
  },
  cycleShares: {
    cycleId: 'cycleShares.cycleId',
    piId: 'cycleShares.piId',
  },
  preferences: {
    cycleId: 'preferences.cycleId',
    piId: 'preferences.piId',
    submittedAt: 'preferences.submittedAt',
  },
  fractionalPreferences: {
    cycleId: 'fractionalPreferences.cycleId',
    piId: 'fractionalPreferences.piId',
    submittedAt: 'fractionalPreferences.submittedAt',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
  },
  eq: vi.fn((...args) => ({ op: 'eq', args })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  isNotNull: vi.fn((...args) => ({ op: 'isNotNull', args })),
  sendEmail: vi.fn(),
  deadlineReminderEmail: vi.fn(() => ({
    subject: 'Reminder',
    html: '<p>Reminder</p>',
    text: 'Reminder',
  })),
  createNotification: vi.fn(),
  getRequiredEnv: vi.fn(() => 'cron-secret'),
}));

vi.mock('drizzle-orm', () => ({ eq, and, isNotNull }));
vi.mock('../../db/index.js', () => ({ db }));
vi.mock('../../db/schema/cycles.js', () => ({ cycles }));
vi.mock('../../db/schema/cycle-shares.js', () => ({ cycleShares }));
vi.mock('../../db/schema/preferences.js', () => ({ preferences }));
vi.mock('../../db/schema/fractional-preferences.js', () => ({ fractionalPreferences }));
vi.mock('../../db/schema/users.js', () => ({ users }));
vi.mock('../../lib/email.js', () => ({ sendEmail }));
vi.mock('../../lib/email-templates.js', () => ({ deadlineReminderEmail }));
vi.mock('../../lib/notifications.js', () => ({ createNotification }));
vi.mock('../../lib/env.js', () => ({ getRequiredEnv }));

import handler from './send-reminders.js';

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

function queueSelectResult(finalMethod, result) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
  };

  chain[finalMethod].mockResolvedValue(result);
  db.select.mockImplementationOnce(() => chain);
}

describe('send reminders cron handler', () => {
  beforeEach(() => {
    db.select.mockReset();
    eq.mockClear();
    and.mockClear();
    isNotNull.mockClear();
    sendEmail.mockReset();
    deadlineReminderEmail.mockClear();
    createNotification.mockReset();
    getRequiredEnv.mockClear();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not remind a PI who submitted only fractional preferences', async () => {
    queueSelectResult('where', [{
      id: 'cycle-1',
      name: 'Spring 2026',
      status: 'collecting',
      preferenceDeadline: '2026-04-30T00:00:00.000Z',
    }]);
    queueSelectResult('where', [{
      piId: 'pi-1',
      piName: 'PI User',
      piEmail: 'pi@example.org',
    }]);
    queueSelectResult('groupBy', []);
    queueSelectResult('groupBy', [{ piId: 'pi-1' }]);

    const req = {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    };
    const res = createResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
