import { pgTable, uuid, date, boolean } from 'drizzle-orm/pg-core';
import { cycles } from './cycles.js';

export const availableDates = pgTable('available_dates', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleId: uuid('cycle_id').notNull().references(() => cycles.id),
  date: date('date').notNull(),
  isAvailable: boolean('is_available').notNull().default(true),
});
