import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const commentStatusEnum = pgEnum('comment_status', ['sent', 'read', 'replied', 'resolved']);

export const messageRoleEnum = pgEnum('message_role', ['pi', 'admin']);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id'),
  subject: text('subject').notNull(),
  status: commentStatusEnum('status').notNull().default('sent'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('comments_pi_id_idx').on(table.piId),
]);

export const commentMessages = pgTable('comment_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  role: messageRoleEnum('role').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
