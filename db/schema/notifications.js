import { pgTable, uuid, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notificationTypeEnum = pgEnum('notification_type', [
  'schedule_published', 'preference_confirmed', 'deadline_reminder', 'swap_update', 'admin_alert'
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
]);
