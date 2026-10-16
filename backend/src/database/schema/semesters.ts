import { relations, sql } from 'drizzle-orm';
import {
  uuid,
  timestamp,
  pgTable,
  pgEnum,
  date,
  unique,
  check,
  varchar,
} from 'drizzle-orm/pg-core';
import { courseOfferings } from './course-offerings.js';

export const semesterTerm = pgEnum('semester_term', [
  'spring',
  'summer',
  'fall',
  'winter',
]);

export const semesterStatus = pgEnum('semester_status', [
  'planned',
  'active',
  'completed',
  'cancelled',
]);

export const semesters = pgTable(
  'semesters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    academicYear: varchar('academic_year', { length: 50 }).notNull(),
    term: semesterTerm('term').notNull(),
    status: semesterStatus('status').default('planned').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'semesters_start_date_end_date_check',
      sql`${table.startDate} <= ${table.endDate}`,
    ),

    unique('semesters_academic_year_term_unique').on(
      table.academicYear,
      table.term,
    ),
  ],
);

export const semestersRelations = relations(semesters, ({ many }) => ({
  courseOfferings: many(courseOfferings),
}));
