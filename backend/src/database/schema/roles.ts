import { uuid, timestamp, pgTable, pgEnum } from 'drizzle-orm/pg-core';

export const roleName = pgEnum('role_name', ['student', 'admin', 'instructor']);

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: roleName('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
