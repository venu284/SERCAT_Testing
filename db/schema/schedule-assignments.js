import { pgTable, uuid, integer, date, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { schedules } from './schedules.js';
import { users } from './users.js';
import { institutions } from './institutions.js';
import { slotKeyEnum } from './preferences.js';

export const shiftTypeEnum = pgEnum('shift_type', ['DS1', 'DS2', 'NS']);

export const scheduleAssignments = pgTable('schedule_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').notNull().references(() => schedules.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  shareIndex: integer('share_index').notNull(),
  slotKey: slotKeyEnum('slot_key').notNull(),
  assignedDate: date('assigned_date').notNull(),
  shiftType: shiftTypeEnum('shift_type').notNull(),
  isManualOverride: boolean('is_manual_override').notNull().default(false),
  choiceRank: integer('choice_rank'),
});
