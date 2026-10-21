import {
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { assessments } from './assessments.js';
import { enrollments } from './enrollments.js';

export interface QuizAnswer {
  questionId: string;
  optionId: string;
}

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'restrict' }),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'restrict' }),
    answers: jsonb('answers').$type<QuizAnswer[]>().notNull(),
    score: numeric('score', { precision: 6, scale: 2 }).notNull(),
    totalQuestions: integer('total_questions').notNull(),
    correctAnswers: integer('correct_answers').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('quiz_attempts_enrollment_assessment_unique').on(
      table.enrollmentId,
      table.assessmentId,
    ),
    check(
      'quiz_attempts_total_questions_positive',
      sql`${table.totalQuestions} > 0`,
    ),
    check(
      'quiz_attempts_correct_answers_range',
      sql`${table.correctAnswers} >= 0 AND ${table.correctAnswers} <= ${table.totalQuestions}`,
    ),
    check('quiz_attempts_score_non_negative', sql`${table.score} >= 0`),
  ],
);

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  assessment: one(assessments, {
    fields: [quizAttempts.assessmentId],
    references: [assessments.id],
  }),
  enrollment: one(enrollments, {
    fields: [quizAttempts.enrollmentId],
    references: [enrollments.id],
  }),
}));
