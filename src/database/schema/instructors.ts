import { uuid, timestamp, pgTable, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { departments } from './departments.js';
import { relations } from 'drizzle-orm';

export const instructors = pgTable('instructors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'restrict' }),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => departments.id, { onDelete: 'restrict' }),
  employeeNumber: varchar('employee_number', { length: 30 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const instructorsRelations = relations(instructors, ({ one }) => ({
  user: one(users, {
    fields: [instructors.userId],
    references: [users.id],
  }),

  department: one(departments, {
    fields: [instructors.departmentId],
    references: [departments.id],
  }),
}));
