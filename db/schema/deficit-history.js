import { pgTable, uuid, decimal, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { institutions } from './institutions.js';
import { cycles } from './cycles.js';
import { slotKeyEnum } from './preferences.js';

export const deficitHistory = pgTable('deficit_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  slotKey: slotKeyEnum('slot_key').notNull(),
  deficitScore: decimal('deficit_score', { precision: 10, scale: 4 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
