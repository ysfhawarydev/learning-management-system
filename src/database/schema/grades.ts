import {
  uuid,
  timestamp,
  numeric,
  check,
  pgTable,
  unique,
} from 'drizzle-orm/pg-core';
import { enrollments } from './enrollments.js';
import { assessments } from './assessments.js';
import { relations, sql } from 'drizzle-orm';

export const grades = pgTable(
  'grades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, {
        onDelete: 'restrict',
      }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, {
        onDelete: 'restrict',
      }),
    score: numeric('score', { precision: 5, scale: 2 }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('grades_score_non_negative_check', sql`${table.score} >= 0`),

    check(
      'grades_score_graded_at_consistency',
      sql`(${table.score} IS NULL AND ${table.gradedAt} IS NULL)
        OR (${table.score} IS NOT NULL AND ${table.gradedAt} IS NOT NULL)`,
    ),

    unique('grades_enrollment_id_assessment_id_unique').on(
      table.enrollmentId,
      table.assessmentId,
    ),
  ],
);

export const gradesRelations = relations(grades, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [grades.enrollmentId],
    references: [enrollments.id],
  }),

  assessment: one(assessments, {
    fields: [grades.assessmentId],
    references: [assessments.id],
  }),
}));
