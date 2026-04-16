import { pgTable, uuid, date, integer, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { institutions } from './institutions.js';
import { cycles } from './cycles.js';
import { shiftEnum } from './preferences.js';

export const preferenceHistory = pgTable('preference_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  shareIndex: integer('share_index').notNull().default(0),
  shift: shiftEnum('shift').notNull(),
  choice1Date: date('choice_1_date'),
  choice2Date: date('choice_2_date'),
  assignedDate: date('assigned_date'),
  choiceRank: integer('choice_rank'),
  assignmentReason: text('assignment_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
