import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  time,
  varchar,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { courseOfferings } from './course-offerings.js';

export const dayOfWeek = pgEnum('day_of_week', [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const timetableSlots = pgTable(
  'timetable_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    courseOfferingId: uuid('course_offering_id')
      .notNull()
      .references(() => courseOfferings.id, {
        onDelete: 'restrict',
      }),

    dayOfWeek: dayOfWeek('day_of_week').notNull(),

    startTime: time('start_time').notNull(),

    endTime: time('end_time').notNull(),

    room: varchar('room', { length: 100 }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'timetable_slots_start_end_time_check',
      sql`${table.startTime} < ${table.endTime}`,
    ),

    index('timetable_slots_course_offering_id_idx').on(table.courseOfferingId),

    index('timetable_slots_day_of_week_idx').on(table.dayOfWeek),
  ],
);

export const timetableSlotsRelations = relations(timetableSlots, ({ one }) => ({
  courseOffering: one(courseOfferings, {
    fields: [timetableSlots.courseOfferingId],
    references: [courseOfferings.id],
  }),
}));
