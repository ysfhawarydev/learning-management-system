import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { assessments } from './assessments.js';

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'restrict' }),
    instructions: text('instructions').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    allowLateSubmissions: boolean('allow_late_submissions')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('assignments_assessment_id_unique').on(table.assessmentId),
    check(
      'assignments_instructions_not_empty_check',
      sql`length(btrim(${table.instructions})) > 0`,
    ),
  ],
);

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assignments.assessmentId],
    references: [assessments.id],
  }),
}));
