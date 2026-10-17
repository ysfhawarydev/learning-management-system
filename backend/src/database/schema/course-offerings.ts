import {
  uuid,
  timestamp,
  pgTable,
  unique,
  integer,
  varchar,
  check,
} from 'drizzle-orm/pg-core';
import { courses } from './courses.js';
import { semesters } from './semesters.js';
import { instructors } from './instructors.js';
import { relations, sql } from 'drizzle-orm';
import { enrollments } from './enrollments.js';
import { assessments } from './assessments.js';
import { timetableSlots } from './timetable-slots.js';

export const courseOfferings = pgTable(
  'course_offerings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
      }),
    semesterId: uuid('semester_id')
      .notNull()
      .references(() => semesters.id, {
        onDelete: 'restrict',
      }),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructors.id, {
        onDelete: 'restrict',
      }),
    sectionCode: varchar('section_code', { length: 20 }).notNull(),
    capacity: integer('capacity'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'course_offerings_capacity_check',
      sql`${table.capacity} IS NULL OR ${table.capacity} > 0`,
    ),

    unique('course_offerings_course_id_semester_id_section_code_unique').on(
      table.courseId,
      table.semesterId,
      table.sectionCode,
    ),
  ],
);

export const courseOfferingsRelations = relations(
  courseOfferings,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [courseOfferings.courseId],
      references: [courses.id],
    }),

    semester: one(semesters, {
      fields: [courseOfferings.semesterId],
      references: [semesters.id],
    }),

    instructor: one(instructors, {
      fields: [courseOfferings.instructorId],
      references: [instructors.id],
    }),

    enrollments: many(enrollments),
    assessments: many(assessments),
    timetableSlots: many(timetableSlots),
  }),
);
