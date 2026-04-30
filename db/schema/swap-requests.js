import { pgTable, uuid, text, jsonb, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { schedules } from './schedules.js';
import { users } from './users.js';
import { scheduleAssignments } from './schedule-assignments.js';

export const swapStatusEnum = pgEnum('swap_status', ['pending', 'approved', 'denied']);

export const swapRequests = pgTable('swap_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').notNull().references(() => schedules.id),
  requesterId: uuid('requester_id').notNull().references(() => users.id),
  targetAssignmentId: uuid('target_assignment_id').notNull().references(() => scheduleAssignments.id),
  preferredDates: jsonb('preferred_dates'),
  status: swapStatusEnum('status').notNull().default('pending'),
  adminNotes: text('admin_notes'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('swap_requests_requester_id_idx').on(table.requesterId),
  index('swap_requests_schedule_id_status_idx').on(table.scheduleId, table.status),
]);
