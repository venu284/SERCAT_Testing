import { pgTable, uuid, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { institutions } from './institutions.js';
import { users } from './users.js';

export const masterShares = pgTable('master_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  piId: uuid('pi_id').notNull().references(() => users.id),
  wholeShares: integer('whole_shares').notNull().default(0),
  fractionalShares: decimal('fractional_shares', { precision: 5, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('master_shares_institution_id_idx').on(table.institutionId),
  index('master_shares_pi_id_idx').on(table.piId),
]);
