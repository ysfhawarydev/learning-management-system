import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
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

describe('Assessments (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let createdGradeIds: string[];
  let createdAssessmentIds: string[];
  let createdEnrollmentIds: string[];
  let createdOfferingIds: string[];
  let createdCourseIds: string[];
  let createdSemesterIds: string[];
  let createdInstructorIds: string[];
  let createdDepartmentIds: string[];
  let createdStudentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdGradeIds = [];
    createdAssessmentIds = [];
    createdEnrollmentIds = [];
    createdOfferingIds = [];
    createdCourseIds = [];
    createdSemesterIds = [];
    createdInstructorIds = [];
    createdDepartmentIds = [];
    createdStudentIds = [];

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
      for (const id of createdGradeIds) {
        await database.db.delete(grades).where(eq(grades.id, id));
      }

      for (const id of createdAssessmentIds) {
        await database.db.delete(assessments).where(eq(assessments.id, id));
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

        await database.db
          .delete(userRoles)
          .where(eq(userRoles.userId, user.id));

        await database.db.delete(users).where(eq(users.id, user.id));
      }
    } finally {
      await app.close();
    }
  });

  async function createAccount(roleName: 'student' | 'admin') {
    const email = `assessments-${randomUUID()}@example.com`;
    createdEmails.push(email);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) throw new Error(`Test user "${email}" was not found`);

    await database.db
      .update(users)
      .set({ status: 'active' })
      .where(eq(users.id, user.id));

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) throw new Error(`Required role "${roleName}" was not found`);

    await database.db
      .insert(userRoles)
      .values({ userId: user.id, roleId: role.id })
      .onConflictDoNothing();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      id: user.id,
      token: response.body.accessToken as string,
    };
  }

  async function createDepartment(token: string) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Assessment Department',
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id as string);
    return response;
  }

  async function createCourse(token: string, departmentId: string) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        departmentId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        title: 'E2E Assessment Course',
        creditValue: 3,
      })
      .expect(201);

    createdCourseIds.push(response.body.id as string);
    return response;
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
    token: string,
    courseId: string,
    semesterId: string,
    instructorId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        semesterId,
        instructorId,
        sectionCode: `A-${randomUUID().slice(0, 6)}`,
      })
      .expect(201);

    createdOfferingIds.push(response.body.id as string);
    return response;
  }

  async function setupDependencies() {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const course = await createCourse(admin.token, department.body.id);
    const semester = await createSemester();
    const instructor = await createInstructor(admin.id, department.body.id);
    const offering = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
    );

    return { admin, department, course, semester, instructor, offering };
  }

  async function createStudentForAdmin(
    adminToken: string,
    departmentId: string,
  ) {
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
    return response;
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
    return response;
  }

  async function createAssessment(
    token: string,
    courseOfferingId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseOfferingId,
        name: 'Midterm Exam',
        type: 'midterm',
        maxScore: 100,
        weight: 30,
        ...overrides,
      })
      .expect(201);

    createdAssessmentIds.push(response.body.id as string);
    return response;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/assessments').expect(401);

    await request(app.getHttpServer())
      .post('/assessments')
      .send({})
      .expect(401);
  });

  it('forbids students from managing assessments', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/assessments')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create, list, retrieve, update, and delete an assessment', async () => {
    const { admin, offering } = await setupDependencies();
    const created = await createAssessment(admin.token, offering.body.id);

    expect(created.body).toMatchObject({
      courseOfferingId: offering.body.id,
      name: 'Midterm Exam',
      type: 'midterm',
      maxScore: '100.00',
      weight: '30.00',
    });

    const list = await request(app.getHttpServer())
      .get('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/assessments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
      });

    await request(app.getHttpServer())
      .patch(`/assessments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Updated Midterm', maxScore: 80, weight: 40 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'Updated Midterm',
          maxScore: '80.00',
          weight: '40.00',
        });
      });

    await request(app.getHttpServer())
      .delete(`/assessments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ id: created.body.id });
      });

    createdAssessmentIds = createdAssessmentIds.filter(
      (id) => id !== created.body.id,
    );
  });

  it('trims assessment names and accepts supported assessment types', async () => {
    const { admin, offering } = await setupDependencies();

    const assessment = await createAssessment(admin.token, offering.body.id, {
      name: '  Quiz One  ',
      type: 'quiz',
    });

    expect(assessment.body.name).toBe('Quiz One');
    expect(assessment.body.type).toBe('quiz');
  });

  it('rejects invalid assessment payloads and malformed IDs', async () => {
    const { admin, offering } = await setupDependencies();
    const basePayload = {
      courseOfferingId: offering.body.id,
      name: 'Valid Assessment',
      type: 'quiz',
      maxScore: 10,
      weight: 10,
    };

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, courseOfferingId: 'not-a-uuid' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, name: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, name: 'x'.repeat(51) })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, type: 'attendance' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, maxScore: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, maxScore: 10000 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, weight: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, weight: 100.01 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, weight: 10.123 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...basePayload, unexpected: true })
      .expect(400);

    await request(app.getHttpServer())
      .get('/assessments/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('rejects creation with a nonexistent course offering', async () => {
    const { admin } = await setupDependencies();

    await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseOfferingId: randomUUID(),
        name: 'Quiz One',
        type: 'quiz',
        maxScore: 10,
        weight: 10,
      })
      .expect(400);
  });

  it('returns 404 for nonexistent assessments', async () => {
    const { admin } = await setupDependencies();
    const id = randomUUID();

    await request(app.getHttpServer())
      .get(`/assessments/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/assessments/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Updated Assessment' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/assessments/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('rejects empty updates and invalid update fields', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.body.id);

    await request(app.getHttpServer())
      .patch(`/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ weight: 101 })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ unexpected: true })
      .expect(400);
  });

  it('rejects updates referencing a nonexistent course offering', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.body.id);

    await request(app.getHttpServer())
      .patch(`/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ courseOfferingId: randomUUID() })
      .expect(400);
  });

  it('prevents deleting an assessment that has associated grades', async () => {
    const { admin, department, offering } = await setupDependencies();
    const student = await createStudentForAdmin(
      admin.token,
      department.body.id,
    );
    const enrollment = await createEnrollment(
      admin.token,
      student.body.id,
      offering.body.id,
    );
    const assessment = await createAssessment(admin.token, offering.body.id);

    const [grade] = await database.db
      .insert(grades)
      .values({
        enrollmentId: enrollment.body.id,
        assessmentId: assessment.body.id,
        score: '85.00',
        gradedAt: new Date(),
      })
      .returning();

    if (!grade) throw new Error('Failed to create E2E grade');
    createdGradeIds.push(grade.id);

    const response = await request(app.getHttpServer())
      .delete(`/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body.message).toContain('associated grades');
  });
});
