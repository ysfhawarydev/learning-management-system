CREATE TYPE "public"."day_of_week" AS ENUM (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);

--> statement-breakpoint
CREATE TABLE "timetable_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "course_offering_id" uuid NOT NULL,
  "day_of_week" "day_of_week" NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "room" varchar(100),
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "timetable_slots_start_end_time_check" CHECK (
      "timetable_slots"."start_time" < "timetable_slots"."end_time"
    )
);

--> statement-breakpoint
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "timetable_slots_course_offering_id_idx" ON "timetable_slots" USING btree ("course_offering_id");

--> statement-breakpoint
CREATE INDEX "timetable_slots_day_of_week_idx" ON "timetable_slots" USING btree ("day_of_week");