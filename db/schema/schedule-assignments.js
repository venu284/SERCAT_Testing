import { pgTable, uuid, integer, date, boolean, text, decimal, index } from 'drizzle-orm/pg-core';
import { schedules } from './schedules.js';
import { users } from './users.js';
import { institutions } from './institutions.js';
import { shiftEnum } from './preferences.js';

export const scheduleAssignments = pgTable('schedule_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').notNull().references(() => schedules.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  shareIndex: integer('share_index').notNull(),
  blockIndex: integer('block_index'),
  assignedDate: date('assigned_date').notNull(),
  shift: shiftEnum('shift').notNull(),
  isManualOverride: boolean('is_manual_override').notNull().default(false),
  choiceRank: integer('choice_rank'),
  assignmentReason: text('assignment_reason').notNull().default('auto_assigned'),
  hours: decimal('hours', { precision: 5, scale: 2 }).notNull().default('6'),
  fractionalHours: decimal('fractional_hours', { precision: 5, scale: 2 }),
  isShared: boolean('is_shared').notNull().default(false),
  sharedWithPiId: uuid('shared_with_pi_id').references(() => users.id),
}, (table) => [
  index('schedule_assignments_schedule_id_idx').on(table.scheduleId),
  index('schedule_assignments_pi_id_idx').on(table.piId),
  index('schedule_assignments_institution_id_idx').on(table.institutionId),
]);
