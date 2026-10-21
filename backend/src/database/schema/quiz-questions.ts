import {
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { assessments } from './assessments.js';
import { quizOptions } from './quiz-options.js';

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'restrict' }),
    prompt: varchar('prompt', { length: 2000 }).notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('quiz_questions_assessment_position_unique').on(
      table.assessmentId,
      table.position,
    ),
  ],
);

export const quizQuestionsRelations = relations(
  quizQuestions,
  ({ one, many }) => ({
    assessment: one(assessments, {
      fields: [quizQuestions.assessmentId],
      references: [assessments.id],
    }),
    options: many(quizOptions),
  }),
);
