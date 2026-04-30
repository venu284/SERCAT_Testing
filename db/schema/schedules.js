import { pgTable, uuid, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { cycles } from './cycles.js';
import { users } from './users.js';

export const scheduleStatusEnum = pgEnum('schedule_status', ['draft', 'published']);

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  version: integer('version').notNull().default(1),
  status: scheduleStatusEnum('status').notNull().default('draft'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  generatedBy: uuid('generated_by').notNull().references(() => users.id),
}, (table) => [
  index('schedules_cycle_id_idx').on(table.cycleId),
]);
