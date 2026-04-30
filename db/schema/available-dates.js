import { pgTable, uuid, date, boolean, index } from 'drizzle-orm/pg-core';
import { cycles } from './cycles.js';

export const availableDates = pgTable('available_dates', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  date: date('date').notNull(),
  isAvailable: boolean('is_available').notNull().default(true),
  ds1Available: boolean('ds1_available').notNull().default(true),
  ds2Available: boolean('ds2_available').notNull().default(true),
  nsAvailable: boolean('ns_available').notNull().default(true),
}, (table) => [
  index('available_dates_cycle_id_idx').on(table.cycleId),
]);
