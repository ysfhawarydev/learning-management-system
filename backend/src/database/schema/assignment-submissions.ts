import { relations, sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { assignments } from './assignments.js';
import { enrollments } from './enrollments.js';

export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'restrict' }),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'restrict' }),
    content: text('content'),
    submissionUrl: varchar('submission_url', { length: 2048 }),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    feedback: text('feedback'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('assignment_submissions_assignment_id_enrollment_id_unique').on(
      table.assignmentId,
      table.enrollmentId,
    ),
    check(
      'assignment_submissions_content_or_url_check',
      sql`(
        (${table.content} IS NOT NULL AND length(btrim(${table.content})) > 0)
        OR
        (${table.submissionUrl} IS NOT NULL AND length(btrim(${table.submissionUrl})) > 0)
      )`,
    ),
    check(
      'assignment_submissions_review_consistency_check',
      sql`(${table.feedback} IS NULL AND ${table.reviewedAt} IS NULL)
        OR (${table.reviewedAt} IS NOT NULL)`,
    ),
  ],
);

export const assignmentSubmissionsRelations = relations(
  assignmentSubmissions,
  ({ one }) => ({
    assignment: one(assignments, {
      fields: [assignmentSubmissions.assignmentId],
      references: [assignments.id],
    }),
    enrollment: one(enrollments, {
      fields: [assignmentSubmissions.enrollmentId],
      references: [enrollments.id],
    }),
  }),
);
