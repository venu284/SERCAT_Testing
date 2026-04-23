import { pgTable, uuid, integer, decimal, timestamp } from 'drizzle-orm/pg-core';
import { institutions } from './institutions.js';
import { users } from './users.js';
import { cycles } from './cycles.js';

export const cycleShares = pgTable('cycle_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  wholeShares: integer('whole_shares').notNull().default(0),
  fractionalShares: decimal('fractional_shares', { precision: 5, scale: 2 }).notNull().default('0'),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
});
