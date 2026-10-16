import { relations } from 'drizzle-orm';
import { uuid, timestamp, pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { instructors } from './instructors.js';
import { students } from './students.js';

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  instructors: many(instructors),
  students: many(students),
}));
