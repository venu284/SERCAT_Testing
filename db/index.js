import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as institutions from './schema/institutions.js';
import * as users from './schema/users.js';
import * as cycles from './schema/cycles.js';
import * as masterShares from './schema/master-shares.js';
import * as cycleShares from './schema/cycle-shares.js';
import * as availableDates from './schema/available-dates.js';
import * as preferences from './schema/preferences.js';
import * as fractionalPreferences from './schema/fractional-preferences.js';
import * as schedules from './schema/schedules.js';
import * as scheduleAssignments from './schema/schedule-assignments.js';
import * as swapRequests from './schema/swap-requests.js';
import * as deficitHistory from './schema/deficit-history.js';
import * as preferenceHistory from './schema/preference-history.js';
import * as runAnalytics from './schema/run-analytics.js';
import * as notifications from './schema/notifications.js';
import * as comments from './schema/comments.js';
import * as auditLog from './schema/audit-log.js';
import { getRequiredDatabaseUrl } from '../lib/env.js';

const schema = {
  ...institutions,
  ...users,
  ...cycles,
  ...masterShares,
  ...cycleShares,
  ...availableDates,
  ...preferences,
  ...fractionalPreferences,
  ...schedules,
  ...scheduleAssignments,
  ...swapRequests,
  ...deficitHistory,
  ...preferenceHistory,
  ...runAnalytics,
  ...notifications,
  ...comments,
  ...auditLog,
};

let dbInstance;

function createDb() {
  const sql = neon(getRequiredDatabaseUrl());

  return drizzle(sql, {
    schema,
  });
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDb();
  }

  return dbInstance;
}

export const db = new Proxy({}, {
  get(_target, property) {
    const instance = getDb();
    const value = instance[property];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
