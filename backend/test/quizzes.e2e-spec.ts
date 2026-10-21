import { randomUUID } from 'node:crypto';

import argon2 from 'argon2';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  assessments,
  courseOfferings,
  courses,
  departments,
  enrollments,
  grades,
  instructors,
  quizAttempts,
  quizOptions,
  quizQuestions,
  roles,
  semesters,
  students,
  userRoles,
  users,
} from '../src/database/schema.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running E2E tests');
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (databaseName !== 'student_management_test') {
  throw new Error(
    `E2E tests must use student_management_test, not "${databaseName}"`,
  );
}

describe('Quizzes (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;

  let createdEmails: string[];
  let createdDepartmentIds: string[];
  let createdStudentIds: string[];
  let createdInstructorIds: string[];
  let createdSemesterIds: string[];
  let createdCourseIds: string[];
  let createdOfferingIds: string[];
  let createdEnrollmentIds: string[];
  let createdAssessmentIds: string[];
  let createdQuestionIds: string[];
  let createdOptionIds: string[];
  let createdAttemptIds: string[];
  let createdGradeIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdDepartmentIds = [];
    createdStudentIds = [];
    createdInstructorIds = [];
    createdSemesterIds = [];
    createdCourseIds = [];
    createdOfferingIds = [];
    createdEnrollmentIds = [];
    createdAssessmentIds = [];
    createdQuestionIds = [];
    createdOptionIds = [];
    createdAttemptIds = [];
    createdGradeIds = [];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    database = app.get(DatabaseService);
  });

  afterEach(async () => {
    try {
      if (createdAttemptIds.length > 0) {
        await database.db
          .delete(quizAttempts)
          .where(inArray(quizAttempts.id, createdAttemptIds));
      }

      if (createdGradeIds.length > 0) {
        await database.db
          .delete(grades)
          .where(inArray(grades.id, createdGradeIds));
      }

      if (createdQuestionIds.length > 0) {
        await database.db
          .delete(quizOptions)
          .where(inArray(quizOptions.questionId, createdQuestionIds));

        await database.db
          .delete(quizQuestions)
          .where(inArray(quizQuestions.id, createdQuestionIds));
      }

      if (createdAssessmentIds.length > 0) {
        await database.db
          .delete(assessments)
          .where(inArray(assessments.id, createdAssessmentIds));
      }

      for (const id of createdEnrollmentIds) {
        await database.db.delete(enrollments).where(eq(enrollments.id, id));
      }

      for (const id of createdOfferingIds) {
        await database.db
          .delete(courseOfferings)
          .where(eq(courseOfferings.id, id));
      }

      for (const id of createdCourseIds) {
        await database.db.delete(courses).where(eq(courses.id, id));
      }

      for (const id of createdInstructorIds) {
        await database.db.delete(instructors).where(eq(instructors.id, id));
      }

      for (const id of createdSemesterIds) {
        await database.db.delete(semesters).where(eq(semesters.id, id));
      }

      for (const id of createdStudentIds) {
        await database.db.delete(students).where(eq(students.id, id));
      }

      for (const id of createdDepartmentIds) {
        await database.db.delete(departments).where(eq(departments.id, id));
      }

      for (const email of createdEmails) {
        const [user] = await database.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) continue;

        await database.db.delete(students).where(eq(students.userId, user.id));

        await database.db
          .delete(instructors)
          .where(eq(instructors.userId, user.id));

        await database.db
          .delete(userRoles)
          .where(eq(userRoles.userId, user.id));

        await database.db.delete(users).where(eq(users.id, user.id));
      }
    } finally {
      await app.close();
    }
  });

  async function createAccount(roleName: 'admin' | 'instructor' | 'student') {
    const email = `quizzes-${randomUUID()}@example.com`;
    createdEmails.push(email);

    const passwordHash = await argon2.hash(password);

    const [user] = await database.db
      .insert(users)
      .values({
        email,
        passwordHash,
        status: 'active',
      })
      .returning({ id: users.id });

    if (!user) throw new Error('Failed to create E2E user');

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) throw new Error(`Required role "${roleName}" was not found`);

    await database.db.insert(userRoles).values({
      userId: user.id,
      roleId: role.id,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      id: user.id,
      token: response.body.accessToken as string,
    };
  }

  async function createDepartment(adminToken: string) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Quiz Department',
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createCourse(adminToken: string, departmentId: string) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        title: 'E2E Quiz Course',
        creditValue: 3,
      })
      .expect(201);

    createdCourseIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createSemester() {
    const [semester] = await database.db
      .insert(semesters)
      .values({
        academicYear: `E2E-${randomUUID().slice(0, 8)}`,
        term: 'fall',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
      })
      .returning();

    if (!semester) throw new Error('Failed to create E2E semester');

    createdSemesterIds.push(semester.id);

    return semester;
  }

  async function createInstructor(userId: string, departmentId: string) {
    const [instructor] = await database.db
      .insert(instructors)
      .values({
        userId,
        departmentId,
        employeeNumber: `E2E-${randomUUID().slice(0, 8)}`,
        firstName: 'E2E',
        lastName: 'Instructor',
      })
      .returning();

    if (!instructor) throw new Error('Failed to create E2E instructor');

    createdInstructorIds.push(instructor.id);

    return instructor;
  }

  async function createOffering(
    adminToken: string,
    courseId: string,
    semesterId: string,
    instructorId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courseId,
        semesterId,
        instructorId,
        sectionCode: `A-${randomUUID().slice(0, 6)}`,
      })
      .expect(201);

    createdOfferingIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createStudent(adminToken: string, departmentId: string) {
    const account = await createAccount('student');

    const response = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: account.id,
        departmentId,
        number: `STU-${randomUUID().slice(0, 8)}`,
        firstName: 'E2E',
        lastName: 'Student',
        birth: '2005-05-15',
      })
      .expect(201);

    createdStudentIds.push(response.body.id as string);

    return {
      account,
      student: response.body as { id: string },
    };
  }

  async function createEnrollment(
    adminToken: string,
    studentId: string,
    courseOfferingId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId, courseOfferingId })
      .expect(201);

    createdEnrollmentIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createQuizAssessment(
    adminToken: string,
    courseOfferingId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courseOfferingId,
        name: `E2E Quiz ${randomUUID().slice(0, 6)}`,
        type: 'quiz',
        maxScore: 100,
        weight: 20,
      })
      .expect(201);

    createdAssessmentIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createQuiz(token: string, assessmentId: string) {
    const response = await request(app.getHttpServer())
      .post('/quizzes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assessmentId,
        questions: [
          {
            prompt: 'What is 2 + 2?',
            position: 0,
            options: [
              { text: 'Four', position: 0, isCorrect: true },
              { text: 'Five', position: 1, isCorrect: false },
            ],
          },
          {
            prompt: 'What is 3 + 3?',
            position: 1,
            options: [
              { text: 'Six', position: 0, isCorrect: true },
              { text: 'Seven', position: 1, isCorrect: false },
            ],
          },
        ],
      })
      .expect(201);

    for (const question of response.body.questions ?? []) {
      if (question.id) createdQuestionIds.push(question.id as string);

      for (const option of question.options ?? []) {
        if (option.id) createdOptionIds.push(option.id as string);
      }
    }

    // Track created rows directly from PostgreSQL as a reliable cleanup fallback.
    const questions = await database.db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.assessmentId, assessmentId));

    for (const question of questions) {
      if (!createdQuestionIds.includes(question.id)) {
        createdQuestionIds.push(question.id);
      }
    }

    const options = await database.db
      .select({ id: quizOptions.id })
      .from(quizOptions)
      .innerJoin(quizQuestions, eq(quizOptions.questionId, quizQuestions.id))
      .where(eq(quizQuestions.assessmentId, assessmentId));

    for (const option of options) {
      if (!createdOptionIds.includes(option.id)) {
        createdOptionIds.push(option.id);
      }
    }

    return response;
  }

  async function setupDependencies() {
    const admin = await createAccount('admin');
    const instructorAccount = await createAccount('instructor');
    const department = await createDepartment(admin.token);
    const course = await createCourse(admin.token, department.id);
    const semester = await createSemester();
    const instructor = await createInstructor(
      instructorAccount.id,
      department.id,
    );
    const offering = await createOffering(
      admin.token,
      course.id,
      semester.id,
      instructor.id,
    );

    return { admin, instructorAccount, department, offering };
  }

  it('rejects unauthenticated quiz requests', async () => {
    await request(app.getHttpServer()).get('/quizzes').expect(401);

    await request(app.getHttpServer()).post('/quizzes').send({}).expect(401);
  });

  it('allows an admin to create a quiz and prevents students from seeing correct answers', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createQuizAssessment(admin.token, offering.id);
    const created = await createQuiz(admin.token, assessment.id);

    expect(created.body.questions).toHaveLength(2);

    const { account, student } = await createStudent(
      admin.token,
      (await createDepartment(admin.token)).id,
    );
    await createEnrollment(admin.token, student.id, offering.id);

    const response = await request(app.getHttpServer())
      .get(`/quizzes/${assessment.id}`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200);

    expect(response.body.questions).toHaveLength(2);

    for (const question of response.body.questions) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty('isCorrect');
      }
    }
  });

  it('allows the assigned instructor to create a quiz', async () => {
    const { admin, instructorAccount, offering } = await setupDependencies();
    const assessment = await createQuizAssessment(admin.token, offering.id);

    const created = await createQuiz(instructorAccount.token, assessment.id);

    expect(created.body.assessmentId).toBe(assessment.id);
  });

  it('prevents an instructor from creating a quiz for another instructor offering', async () => {
    const { admin, instructorAccount } = await setupDependencies();
    const otherInstructorAccount = await createAccount('instructor');
    const department = await createDepartment(admin.token);
    const course = await createCourse(admin.token, department.id);
    const semester = await createSemester();

    const otherInstructor = await createInstructor(
      otherInstructorAccount.id,
      department.id,
    );

    const otherOffering = await createOffering(
      admin.token,
      course.id,
      semester.id,
      otherInstructor.id,
    );

    const assessment = await createQuizAssessment(
      admin.token,
      otherOffering.id,
    );

    await request(app.getHttpServer())
      .post('/quizzes')
      .set('Authorization', `Bearer ${instructorAccount.token}`)
      .send({
        assessmentId: assessment.id,
        questions: [
          {
            prompt: 'Question?',
            position: 0,
            options: [
              { text: 'Correct', position: 0, isCorrect: true },
              { text: 'Incorrect', position: 1, isCorrect: false },
            ],
          },
        ],
      })
      .expect(403);
  });

  it('allows a student to submit a quiz and view their attempt', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createQuizAssessment(admin.token, offering.id);
    const quiz = await createQuiz(admin.token, assessment.id);

    const department = await createDepartment(admin.token);
    const { account, student } = await createStudent(
      admin.token,
      department.id,
    );
    await createEnrollment(admin.token, student.id, offering.id);

    const questions = quiz.body.questions as Array<{
      id: string;
      options: Array<{ id: string; text: string }>;
    }>;

    const answers = questions.map((question) => ({
      questionId: question.id,
      optionId: question.options[0]!.id,
    }));

    const submission = await request(app.getHttpServer())
      .post(`/quizzes/${assessment.id}/attempts`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ answers })
      .expect(201);

    expect(submission.body.attempt).toMatchObject({
      assessmentId: assessment.id,
      totalQuestions: 2,
      correctAnswers: 2,
      score: '100.00',
    });

    expect(submission.body.grade).toMatchObject({
      assessmentId: assessment.id,
      score: '100.00',
    });

    createdAttemptIds.push(submission.body.attempt.id as string);
    createdGradeIds.push(submission.body.grade.id as string);

    await request(app.getHttpServer())
      .get(`/quizzes/${assessment.id}/my-attempt`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          assessmentId: assessment.id,
          score: '100.00',
          totalQuestions: 2,
          correctAnswers: 2,
        });
        expect(body).not.toHaveProperty('answers');
      });
  });

  it('rejects duplicate quiz submissions', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createQuizAssessment(admin.token, offering.id);
    const quiz = await createQuiz(admin.token, assessment.id);

    const department = await createDepartment(admin.token);
    const { account, student } = await createStudent(
      admin.token,
      department.id,
    );
    await createEnrollment(admin.token, student.id, offering.id);

    const questions = quiz.body.questions as Array<{
      id: string;
      options: Array<{ id: string }>;
    }>;

    const answers = questions.map((question) => ({
      questionId: question.id,
      optionId: question.options[0]!.id,
    }));

    const first = await request(app.getHttpServer())
      .post(`/quizzes/${assessment.id}/attempts`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ answers })
      .expect(201);

    createdAttemptIds.push(first.body.attempt.id as string);
    createdGradeIds.push(first.body.grade.id as string);

    await request(app.getHttpServer())
      .post(`/quizzes/${assessment.id}/attempts`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ answers })
      .expect(409);
  });

  it('prevents students without enrollment from accessing or submitting a quiz', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createQuizAssessment(admin.token, offering.id);
    const quiz = await createQuiz(admin.token, assessment.id);

    const department = await createDepartment(admin.token);
    const { account } = await createStudent(admin.token, department.id);

    await request(app.getHttpServer())
      .get(`/quizzes/${assessment.id}`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(403);

    const questions = quiz.body.questions as Array<{
      id: string;
      options: Array<{ id: string }>;
    }>;

    const answers = questions.map((question) => ({
      questionId: question.id,
      optionId: question.options[0]!.id,
    }));

    await request(app.getHttpServer())
      .post(`/quizzes/${assessment.id}/attempts`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ answers })
      .expect(403);
  });

  it('rejects malformed quiz payloads', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createQuizAssessment(admin.token, offering.id);

    await request(app.getHttpServer())
      .post('/quizzes')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        assessmentId: 'not-a-uuid',
        questions: [],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/quizzes')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        assessmentId: assessment.id,
        questions: [
          {
            prompt: 'Question?',
            position: 0,
            options: [
              { text: 'Only one option', position: 0, isCorrect: true },
            ],
          },
        ],
      })
      .expect(400);
  });
});
