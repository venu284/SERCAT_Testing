import { pgTable, uuid, integer, date, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { cycles } from './cycles.js';
import { users } from './users.js';
import { institutions } from './institutions.js';

export const fractionalPreferences = pgTable('fractional_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  blockIndex: integer('block_index').notNull(),
  fractionalHours: decimal('fractional_hours', { precision: 5, scale: 2 }).notNull(),
  choice1Date: date('choice_1_date'),
  choice2Date: date('choice_2_date'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('fractional_preferences_cycle_id_pi_id_idx').on(table.cycleId, table.piId),
]);
