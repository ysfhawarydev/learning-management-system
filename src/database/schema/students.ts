import {
  uuid,
  timestamp,
  pgTable,
  varchar,
  pgEnum,
  date,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { relations } from 'drizzle-orm';
import { departments } from './departments.js';
import { enrollments } from './enrollments.js';

export const studentStatus = pgEnum('student_status', [
  'applicant',
  'enrolled',
  'on_leave',
  'probation',
  'graduated',
  'withdrawn',
]);

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'restrict' }),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => departments.id, {
      onDelete: 'restrict',
    }),
  number: varchar('number', { length: 30 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  birth: date('birth', { mode: 'string' }).notNull(),
  status: studentStatus('status').default('applicant').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),

  department: one(departments, {
    fields: [students.departmentId],
    references: [departments.id],
  }),

  enrollments: many(enrollments),
}));
