import {
  uuid,
  varchar,
  timestamp,
  pgTable,
  text,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', [
  'active',
  'suspended',
  'pending',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  status: userStatus('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
