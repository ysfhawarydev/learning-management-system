CREATE TYPE "public"."attendance_status" AS ENUM ('present', 'absent', 'late', 'excused');

--> statement-breakpoint
CREATE TABLE "attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "session_date" date NOT NULL,
  "status" "attendance_status" NOT NULL,
  "notes" varchar(500),
  "recorded_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "attendance_enrollment_id_session_date_unique" UNIQUE ("enrollment_id", "session_date")
);

--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "attendance_session_date_idx" ON "attendance" USING btree ("session_date");

--> statement-breakpoint
CREATE INDEX "attendance_enrollment_id_idx" ON "attendance" USING btree ("enrollment_id");