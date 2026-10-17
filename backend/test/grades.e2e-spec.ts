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

describe('Grades (e2e)', () => {
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
    const email = `grades-${randomUUID()}@example.com`;
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
        name: 'E2E Grades Department',
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
        title: 'E2E Grades Course',
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

    return { admin, department, offering };
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

  async function setupGrade() {
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

    return { admin, department, offering, student, enrollment, assessment };
  }

  async function createGrade(
    token: string,
    enrollmentId: string,
    assessmentId: string,
    score?: number,
  ) {
    const payload: Record<string, unknown> = { enrollmentId, assessmentId };

    if (score !== undefined) payload.score = score;

    const response = await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    createdGradeIds.push(response.body.id as string);
    return response;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/grades').expect(401);

    await request(app.getHttpServer()).post('/grades').send({}).expect(401);
  });

  it('forbids students from managing grades', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/grades')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create, list, retrieve, update, and delete a grade', async () => {
    const { admin, enrollment, assessment } = await setupGrade();

    const created = await createGrade(
      admin.token,
      enrollment.body.id,
      assessment.body.id,
      85,
    );

    expect(created.body).toMatchObject({
      enrollmentId: enrollment.body.id,
      assessmentId: assessment.body.id,
      score: '85.00',
    });
    expect(created.body.gradedAt).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/grades/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
      });

    await request(app.getHttpServer())
      .patch(`/grades/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ score: 90 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.score).toBe('90.00');
        expect(body.gradedAt).toBeTruthy();
      });

    await request(app.getHttpServer())
      .delete(`/grades/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ id: created.body.id });
      });

    createdGradeIds = createdGradeIds.filter((id) => id !== created.body.id);
  });

  it('supports ungraded records, zero scores, and clearing a score', async () => {
    const { admin, enrollment, assessment } = await setupGrade();

    const ungraded = await createGrade(
      admin.token,
      enrollment.body.id,
      assessment.body.id,
    );

    expect(ungraded.body.score).toBeNull();
    expect(ungraded.body.gradedAt).toBeNull();

    const zero = await createGrade(
      admin.token,
      enrollment.body.id,
      (
        await createAssessment(admin.token, assessment.body.courseOfferingId, {
          name: 'Quiz Zero',
          type: 'quiz',
        })
      ).body.id,
      0,
    );

    expect(zero.body.score).toBe('0.00');
    expect(zero.body.gradedAt).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/grades/${zero.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ score: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.score).toBeNull();
        expect(body.gradedAt).toBeNull();
      });
  });

  it('rejects duplicate grades for the same enrollment and assessment', async () => {
    const { admin, enrollment, assessment } = await setupGrade();

    await createGrade(admin.token, enrollment.body.id, assessment.body.id, 70);

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        enrollmentId: enrollment.body.id,
        assessmentId: assessment.body.id,
        score: 80,
      })
      .expect(409);
  });

  it('rejects scores above the assessment maximum', async () => {
    const { admin, enrollment, assessment } = await setupGrade();

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        enrollmentId: enrollment.body.id,
        assessmentId: assessment.body.id,
        score: 100.01,
      })
      .expect(400);

    const grade = await createGrade(
      admin.token,
      enrollment.body.id,
      assessment.body.id,
      80,
    );

    await request(app.getHttpServer())
      .patch(`/grades/${grade.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ score: 101 })
      .expect(400);
  });

  it('rejects enrollment and assessment combinations from different offerings', async () => {
    const { admin, department, offering, enrollment } = await setupGrade();

    const secondCourse = await createCourse(admin.token, department.body.id);
    const secondSemester = await createSemester();
    const secondInstructorUser = await createAccount('admin');

    const secondInstructor = await createInstructor(
      secondInstructorUser.id,
      department.body.id,
    );
    const secondOffering = await createOffering(
      admin.token,
      secondCourse.body.id,
      secondSemester.id,
      secondInstructor.id,
    );
    const otherAssessment = await createAssessment(
      admin.token,
      secondOffering.body.id,
      { name: 'Other Quiz', type: 'quiz' },
    );

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        enrollmentId: enrollment.body.id,
        assessmentId: otherAssessment.body.id,
        score: 50,
      })
      .expect(400);

    expect(offering.body.id).not.toBe(secondOffering.body.id);
  });

  it('rejects invalid payloads and malformed IDs', async () => {
    const { admin, enrollment, assessment } = await setupGrade();
    const payload = {
      enrollmentId: enrollment.body.id,
      assessmentId: assessment.body.id,
      score: 50,
    };

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, enrollmentId: 'not-a-uuid' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, score: -1 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, score: 10.123 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, unexpected: true })
      .expect(400);

    await request(app.getHttpServer())
      .get('/grades/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    const grade = await createGrade(
      admin.token,
      enrollment.body.id,
      assessment.body.id,
      50,
    );

    await request(app.getHttpServer())
      .patch(`/grades/${grade.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/grades/${grade.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ unexpected: true })
      .expect(400);
  });

  it('rejects nonexistent enrollment and assessment IDs', async () => {
    const { admin } = await setupDependencies();

    await request(app.getHttpServer())
      .post('/grades')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        enrollmentId: randomUUID(),
        assessmentId: randomUUID(),
        score: 50,
      })
      .expect(404);
  });

  it('returns 404 for nonexistent grades', async () => {
    const { admin } = await setupDependencies();
    const id = randomUUID();

    await request(app.getHttpServer())
      .get(`/grades/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/grades/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ score: 50 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/grades/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });
});
