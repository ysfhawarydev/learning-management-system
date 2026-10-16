import {
  uuid,
  timestamp,
  pgTable,
  pgEnum,
  varchar,
  check,
  numeric,
} from 'drizzle-orm/pg-core';
import { courseOfferings } from './course_offerings.js';
import { relations, sql } from 'drizzle-orm';
import { grades } from './grades.js';

export const assessmentType = pgEnum('assessment_type', [
  'assignment',
  'quiz',
  'midterm',
  'final',
  'project',
]);

export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseOfferingId: uuid('course_offering_id')
      .notNull()
      .references(() => courseOfferings.id, {
        onDelete: 'restrict',
      }),
    name: varchar('name', { length: 50 }).notNull(),
    type: assessmentType('type').notNull(),
    maxScore: numeric('max_score', { precision: 6, scale: 2 }).notNull(),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('assessments_max_score_check', sql`${table.maxScore}> 0`),

    check(
      'assessments_weight_check',
      sql`${table.weight} > 0 AND ${table.weight} <= 100`,
    ),
  ],
);

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  courseOffering: one(courseOfferings, {
    fields: [assessments.courseOfferingId],
    references: [courseOfferings.id],
  }),

  grades: many(grades),
}));
