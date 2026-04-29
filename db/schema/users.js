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
  activationTokenHash: text('activation_token_hash'),
  activationTokenExpiresAt: timestamp('activation_token_expires_at', { withTimezone: true }),
  resetTokenHash: text('reset_token_hash'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at', { withTimezone: true }),
  phone: text('phone'),
  roleTitle: text('role_title'),
  pendingEmail: text('pending_email'),
  emailVerifyTokenHash: text('email_verify_token_hash'),
  emailVerifyTokenExpiresAt: timestamp('email_verify_token_expires_at', { withTimezone: true }),
  isActivated: boolean('is_activated').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
