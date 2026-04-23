import { pgTable, uuid, integer, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { cycles } from './cycles.js';
import { users } from './users.js';
import { institutions } from './institutions.js';

export const shiftEnum = pgEnum('shift', ['DS1', 'DS2', 'NS']);

export const preferences = pgTable('preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  shareIndex: integer('share_index').notNull(),
  shift: shiftEnum('shift').notNull(),
  choice1Date: date('choice_1_date'),
  choice2Date: date('choice_2_date'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
