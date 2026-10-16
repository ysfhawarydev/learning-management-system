import { uuid, timestamp, pgTable, pgEnum, unique } from 'drizzle-orm/pg-core';
import { students } from './students.js';
import { courseOfferings } from './course_offerings.js';
import { relations } from 'drizzle-orm';

export const enrollmentStatus = pgEnum('enrollment_status', [
  'enrolled',
  'dropped',
  'completed',
  'withdrawn',
]);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, {
        onDelete: 'restrict',
      }),
    courseOfferingId: uuid('course_offering_id')
      .notNull()
      .references(() => courseOfferings.id, {
        onDelete: 'restrict',
      }),
    status: enrollmentStatus('status').default('enrolled').notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('enrollments_student_id_course_offerings_id_unique').on(
      table.studentId,
      table.courseOfferingId,
    ),
  ],
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),

  courseOffering: one(courseOfferings, {
    fields: [enrollments.courseOfferingId],
    references: [courseOfferings.id],
  }),
}));
