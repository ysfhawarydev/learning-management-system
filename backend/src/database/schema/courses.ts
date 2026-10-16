import {
  uuid,
  varchar,
  timestamp,
  pgTable,
  text,
  integer,
  check,
} from 'drizzle-orm/pg-core';
import { departments } from './departments.js';
import { relations, sql } from 'drizzle-orm';
import { courseOfferings } from './course-offerings.js';

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, {
        onDelete: 'restrict',
      }),
    code: varchar('code', { length: 20 }).notNull().unique(),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description'),
    creditValue: integer('credit_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('courses_credit_value_check', sql`${table.creditValue} > 0`),
  ],
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  department: one(departments, {
    fields: [courses.departmentId],
    references: [departments.id],
  }),

  courseOfferings: many(courseOfferings),
}));
