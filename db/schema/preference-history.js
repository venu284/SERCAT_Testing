import { pgTable, uuid, date, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { cycles } from './cycles.js';
import { slotKeyEnum } from './preferences.js';

export const preferenceHistory = pgTable('preference_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  slotKey: slotKeyEnum('slot_key').notNull(),
  choice1Date: date('choice_1_date'),
  choice2Date: date('choice_2_date'),
  assignedDate: date('assigned_date'),
  choiceRank: integer('choice_rank'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
