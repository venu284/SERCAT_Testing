import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_log_user_id_idx').on(table.userId),
]);
