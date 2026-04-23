import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { institutions } from './institutions.js';

export const userRoleEnum = pgEnum('user_role', ['admin', 'pi']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('pi'),
  institutionId: uuid('institution_id').references(() => institutions.id),
  isActive: boolean('is_active').notNull().default(true),
  activationToken: text('activation_token'),
  activationTokenExpiresAt: timestamp('activation_token_expires_at', { withTimezone: true }),
  isActivated: boolean('is_activated').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
