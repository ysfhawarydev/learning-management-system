CREATE TYPE "public"."user_status" AS ENUM ('active', 'suspended', 'pending');

--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM ('student', 'admin', 'instructor');

--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM (
  'applicant',
  'enrolled',
  'on_leave',
  'probation',
  'graduated',
  'withdrawn'
);

--> statement-breakpoint
CREATE TYPE "public"."semester_status" AS ENUM ('planned', 'active', 'completed', 'cancelled');

--> statement-breakpoint
CREATE TYPE "public"."semester_term" AS ENUM ('spring', 'summer', 'fall', 'winter');

--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM ('enrolled', 'dropped', 'completed', 'withdrawn');

--> statement-breakpoint
CREATE TYPE "public"."assessment_type" AS ENUM (
  'assignment',
  'quiz',
  'midterm',
  'final',
  'project'
);

--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "email" varchar(255) NOT NULL,
  "password_hash" text NOT NULL,
  "status" "user_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE ("email")
);

--> statement-breakpoint
CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "name" "role_name" NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "roles_name_unique" UNIQUE ("name")
);

--> statement-breakpoint
CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY ("user_id", "role_id")
);

--> statement-breakpoint
CREATE TABLE "departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "departments_code_unique" UNIQUE ("code")
);

--> statement-breakpoint
CREATE TABLE "students" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "user_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "number" varchar(30) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "phone" varchar(50),
  "birth" date NOT NULL,
  "status" "student_status" DEFAULT 'applicant' NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "students_user_id_unique" UNIQUE ("user_id"),
    CONSTRAINT "students_number_unique" UNIQUE ("number")
);

--> statement-breakpoint
CREATE TABLE "instructors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "user_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "employee_number" varchar(30) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "phone" varchar(50),
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "instructors_user_id_unique" UNIQUE ("user_id"),
    CONSTRAINT "instructors_employee_number_unique" UNIQUE ("employee_number")
);

--> statement-breakpoint
CREATE TABLE "courses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "department_id" uuid NOT NULL,
  "code" varchar(20) NOT NULL,
  "title" varchar(150) NOT NULL,
  "description" text,
  "credit_value" integer NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "courses_code_unique" UNIQUE ("code"),
    CONSTRAINT "courses_credit_value_check" CHECK ("courses"."credit_value" > 0)
);

--> statement-breakpoint
CREATE TABLE "semesters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "academic_year" varchar(50) NOT NULL,
  "term" "semester_term" NOT NULL,
  "status" "semester_status" DEFAULT 'planned' NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "semesters_academic_year_term_unique" UNIQUE ("academic_year", "term"),
    CONSTRAINT "semesters_start_date_end_date_check" CHECK (
      "semesters"."start_date" <= "semesters"."end_date"
    )
);

--> statement-breakpoint
CREATE TABLE "course_offerings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "course_id" uuid NOT NULL,
  "semester_id" uuid NOT NULL,
  "instructor_id" uuid NOT NULL,
  "section_code" varchar(20) NOT NULL,
  "capacity" integer,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "course_offerings_course_id_semester_id_section_code_unique" UNIQUE ("course_id", "semester_id", "section_code"),
    CONSTRAINT "course_offerings_capacity_check" CHECK (
      "course_offerings"."capacity" IS NULL
      OR "course_offerings"."capacity" > 0
    )
);

--> statement-breakpoint
CREATE TABLE "enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "student_id" uuid NOT NULL,
  "course_offering_id" uuid NOT NULL,
  "status" "enrollment_status" DEFAULT 'enrolled' NOT NULL,
  "enrolled_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "enrollments_student_id_course_offerings_id_unique" UNIQUE ("student_id", "course_offering_id")
);

--> statement-breakpoint
CREATE TABLE "assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "course_offering_id" uuid NOT NULL,
  "name" varchar(50) NOT NULL,
  "type" "assessment_type" NOT NULL,
  "max_score" numeric(6, 2) NOT NULL,
  "weight" numeric(5, 2) NOT NULL,
  "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "assessments_max_score_check" CHECK ("assessments"."max_score" > 0),
    CONSTRAINT "assessments_weight_check" CHECK (
      "assessments"."weight" > 0
      AND "assessments"."weight" <= 100
    )
);

--> statement-breakpoint
CREATE TABLE "grades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "assessment_id" uuid NOT NULL,
  "score" numeric(5, 2),
  "graded_at" timestamp
  with
    time zone,
    "created_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    "updated_at" timestamp
  with
    time zone DEFAULT now () NOT NULL,
    CONSTRAINT "grades_enrollment_id_assessment_id_unique" UNIQUE ("enrollment_id", "assessment_id"),
    CONSTRAINT "grades_score_non_negative_check" CHECK ("grades"."score" >= 0),
    CONSTRAINT "grades_score_graded_at_consistency" CHECK (
      (
        "grades"."score" IS NULL
        AND "grades"."graded_at" IS NULL
      )
      OR (
        "grades"."score" IS NOT NULL
        AND "grades"."graded_at" IS NOT NULL
      )
    )
);

--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments" ("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments" ("id") ON DELETE restrict ON UPDATE no action;