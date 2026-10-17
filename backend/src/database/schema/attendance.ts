import {
  uuid,
  date,
  timestamp,
  varchar,
  pgTable,
  pgEnum,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { enrollments } from './enrollments.js';

export const attendanceStatus = pgEnum('attendance_status', [
  'present',
  'absent',
  'late',
  'excused',
]);

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, {
        onDelete: 'restrict',
      }),

    sessionDate: date('session_date', { mode: 'string' }).notNull(),

    status: attendanceStatus('status').notNull(),

    notes: varchar('notes', { length: 500 }),

    recordedAt: timestamp('recorded_at', { withTimezone: true })
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
    unique('attendance_enrollment_id_session_date_unique').on(
      table.enrollmentId,
      table.sessionDate,
    ),

    index('attendance_session_date_idx').on(table.sessionDate),

    index('attendance_enrollment_id_idx').on(table.enrollmentId),
  ],
);

export const attendanceRelations = relations(attendance, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [attendance.enrollmentId],
    references: [enrollments.id],
  }),
}));
