CREATE TABLE "assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "assessment_id" uuid NOT NULL,
  "instructions" text NOT NULL,
  "due_at" timestamp
  with
    time zone NOT NULL,
    "allow_late_submissions" boolean DEFAULT false NOT NULL,
    "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "assignments_assessment_id_unique" UNIQUE ("assessment_id"),
    CONSTRAINT "assignments_instructions_not_empty_check" CHECK (length (btrim ("assignments"."instructions")) > 0)
);

--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "assignment_id" uuid NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "content" text,
  "submission_url" varchar(2048),
  "submitted_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "feedback" text,
    "reviewed_at" timestamp
  with
    time zone,
    "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "assignment_submissions_assignment_id_enrollment_id_unique" UNIQUE ("assignment_id", "enrollment_id"),
    CONSTRAINT "assignment_submissions_content_or_url_check" CHECK (
      (
        (
          "assignment_submissions"."content" IS NOT NULL
          AND length (btrim ("assignment_submissions"."content")) > 0
        )
        OR (
          "assignment_submissions"."submission_url" IS NOT NULL
          AND length (btrim ("assignment_submissions"."submission_url")) > 0
        )
      )
    ),
    CONSTRAINT "assignment_submissions_review_consistency_check" CHECK (
      (
        "assignment_submissions"."feedback" IS NULL
        AND "assignment_submissions"."reviewed_at" IS NULL
      )
      OR (
        "assignment_submissions"."reviewed_at" IS NOT NULL
      )
    )
);

--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments" ("id") ON DELETE restrict ON UPDATE no action;