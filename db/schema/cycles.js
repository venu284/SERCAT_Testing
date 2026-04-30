import { pgTable, uuid, text, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const cycleStatusEnum = pgEnum('cycle_status', [
  'setup', 'collecting', 'scheduling', 'published', 'archived'
]);

export const cycles = pgTable('cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  preferenceDeadline: timestamp('preference_deadline', { withTimezone: true }).notNull(),
  status: cycleStatusEnum('status').notNull().default('setup'),
  notes: text('notes'),
  shiftTimingOverrides: text('shift_timing_overrides'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
