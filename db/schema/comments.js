import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const commentStatusEnum = pgEnum('comment_status', ['sent', 'read', 'replied']);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: commentStatusEnum('status').notNull().default('sent'),
  readAt: timestamp('read_at', { withTimezone: true }),
  adminReply: text('admin_reply'),
  adminReplyBy: uuid('admin_reply_by').references(() => users.id),
  adminReplyAt: timestamp('admin_reply_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
