CREATE TABLE "quiz_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "assessment_id" uuid NOT NULL,
  "prompt" varchar(2000) NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "quiz_questions_assessment_position_unique" UNIQUE ("assessment_id", "position")
);

--> statement-breakpoint
CREATE TABLE "quiz_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "question_id" uuid NOT NULL,
  "text" varchar(500) NOT NULL,
  "is_correct" boolean DEFAULT false NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "quiz_options_question_position_unique" UNIQUE ("question_id", "position")
);

--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "assessment_id" uuid NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "answers" jsonb NOT NULL,
  "score" numeric(6, 2) NOT NULL,
  "total_questions" integer NOT NULL,
  "correct_answers" integer NOT NULL,
  "submitted_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "quiz_attempts_enrollment_assessment_unique" UNIQUE ("enrollment_id", "assessment_id"),
    CONSTRAINT "quiz_attempts_total_questions_positive" CHECK ("quiz_attempts"."total_questions" > 0),
    CONSTRAINT "quiz_attempts_correct_answers_range" CHECK (
      "quiz_attempts"."correct_answers" >= 0
      AND "quiz_attempts"."correct_answers" <= "quiz_attempts"."total_questions"
    ),
    CONSTRAINT "quiz_attempts_score_non_negative" CHECK ("quiz_attempts"."score" >= 0)
);

--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments" ("id") ON DELETE restrict ON UPDATE no action;