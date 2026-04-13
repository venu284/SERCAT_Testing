import { pgTable, uuid, integer, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { cycles } from './cycles.js';
import { users } from './users.js';

export const slotKeyEnum = pgEnum('slot_key', ['DAY1', 'DAY2', 'NS']);

export const preferences = pgTable('preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  shareIndex: integer('share_index').notNull(),
  slotKey: slotKeyEnum('slot_key').notNull(),
  choice1Date: date('choice_1_date'),
  choice2Date: date('choice_2_date'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
