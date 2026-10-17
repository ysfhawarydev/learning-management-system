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

describe('Enrollments (e2e)', () => {
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
    const email = `enrollments-${randomUUID()}@example.com`;
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
        name: 'E2E Enrollment Department',
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
        title: 'E2E Enrollment Course',
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

  async function createStudent(
    token: string,
    userId: string,
    departmentId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId,
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

  async function createOffering(
    token: string,
    courseId: string,
    semesterId: string,
    instructorId: string,
    capacity: number | null = 30,
  ) {
    const response = await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        semesterId,
        instructorId,
        sectionCode: 'A',
        ...(capacity === null ? {} : { capacity }),
      })
      .expect(201);

    createdOfferingIds.push(response.body.id as string);
    return response;
  }

  async function setupDependencies(capacity: number | null = 30) {
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
      capacity,
    );

    return { admin, department, course, semester, instructor, offering };
  }

  async function createStudentForAdmin(adminToken: string) {
    const account = await createAccount('student');
    const [department] = await database.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, createdDepartmentIds[0]!))
      .limit(1);

    if (!department) throw new Error('Test department was not found');

    const student = await createStudent(adminToken, account.id, department.id);

    return { account, student };
  }

  async function createEnrollment(
    adminToken: string,
    studentId: string,
    courseOfferingId: string,
    status: 'enrolled' | 'dropped' | 'completed' | 'withdrawn' = 'enrolled',
  ) {
    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId, courseOfferingId, status })
      .expect(201);

    createdEnrollmentIds.push(response.body.id as string);
    return response;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/enrollments').expect(401);

    await request(app.getHttpServer())
      .post('/enrollments')
      .send({})
      .expect(401);
  });

  it('forbids students from managing enrollments', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/enrollments')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create, list, and retrieve an enrollment', async () => {
    const { admin, offering } = await setupDependencies();
    const { student } = await createStudentForAdmin(admin.token);

    const created = await createEnrollment(
      admin.token,
      student.body.id,
      offering.body.id,
    );

    expect(created.body).toMatchObject({
      studentId: student.body.id,
      courseOfferingId: offering.body.id,
      status: 'enrolled',
    });
    expect(created.body.id).toEqual(expect.any(String));

    const list = await request(app.getHttpServer())
      .get('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/enrollments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
      });
  });

  it('defaults the status to enrolled', async () => {
    const { admin, offering } = await setupDependencies();
    const { student } = await createStudentForAdmin(admin.token);

    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: student.body.id,
        courseOfferingId: offering.body.id,
      })
      .expect(201);

    createdEnrollmentIds.push(response.body.id as string);
    expect(response.body.status).toBe('enrolled');
  });

  it('rejects duplicate enrollments for the same student and offering', async () => {
    const { admin, offering } = await setupDependencies();
    const { student } = await createStudentForAdmin(admin.token);

    await createEnrollment(admin.token, student.body.id, offering.body.id);

    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: student.body.id,
        courseOfferingId: offering.body.id,
      })
      .expect(409);

    expect(response.body.message).toContain('already has an enrollment');
  });

  it('rejects enrollment when capacity is full', async () => {
    const { admin, offering } = await setupDependencies(1);
    const first = await createStudentForAdmin(admin.token);
    const second = await createStudentForAdmin(admin.token);

    await createEnrollment(
      admin.token,
      first.student.body.id,
      offering.body.id,
    );

    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: second.student.body.id,
        courseOfferingId: offering.body.id,
      })
      .expect(409);

    expect(response.body.message).toContain('capacity');
  });

  it('allows enrollment when offering capacity is unlimited', async () => {
    const { admin, offering } = await setupDependencies(null);
    const first = await createStudentForAdmin(admin.token);
    const second = await createStudentForAdmin(admin.token);

    await createEnrollment(
      admin.token,
      first.student.body.id,
      offering.body.id,
    );
    await createEnrollment(
      admin.token,
      second.student.body.id,
      offering.body.id,
    );
  });

  it('does not count dropped enrollments against capacity', async () => {
    const { admin, offering } = await setupDependencies(1);
    const first = await createStudentForAdmin(admin.token);
    const second = await createStudentForAdmin(admin.token);

    await createEnrollment(
      admin.token,
      first.student.body.id,
      offering.body.id,
      'dropped',
    );

    await createEnrollment(
      admin.token,
      second.student.body.id,
      offering.body.id,
    );
  });

  it('allows status updates and enforces capacity when re-enrolling', async () => {
    const { admin, offering } = await setupDependencies(1);
    const first = await createStudentForAdmin(admin.token);
    const second = await createStudentForAdmin(admin.token);

    const firstEnrollment = await createEnrollment(
      admin.token,
      first.student.body.id,
      offering.body.id,
      'dropped',
    );

    const secondEnrollment = await createEnrollment(
      admin.token,
      second.student.body.id,
      offering.body.id,
    );

    await request(app.getHttpServer())
      .patch(`/enrollments/${firstEnrollment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'enrolled' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/enrollments/${secondEnrollment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'completed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/enrollments/${firstEnrollment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'enrolled' })
      .expect(200);
  });

  it('rejects invalid payloads and malformed IDs', async () => {
    const { admin, offering } = await setupDependencies();
    const { student } = await createStudentForAdmin(admin.token);

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: 'not-a-uuid',
        courseOfferingId: offering.body.id,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: student.body.id,
        courseOfferingId: offering.body.id,
        status: 'invalid-status',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: student.body.id,
        courseOfferingId: offering.body.id,
        unexpected: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/enrollments/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('returns 404 for nonexistent enrollments', async () => {
    const { admin } = await setupDependencies();
    const id = randomUUID();

    await request(app.getHttpServer())
      .get(`/enrollments/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/enrollments/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'completed' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/enrollments/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('allows an admin to delete an enrollment without grades', async () => {
    const { admin, offering } = await setupDependencies();
    const { student } = await createStudentForAdmin(admin.token);

    const enrollment = await createEnrollment(
      admin.token,
      student.body.id,
      offering.body.id,
    );

    await request(app.getHttpServer())
      .delete(`/enrollments/${enrollment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ id: enrollment.body.id });
      });

    createdEnrollmentIds = createdEnrollmentIds.filter(
      (id) => id !== enrollment.body.id,
    );
  });

  it('blocks deletion when an enrollment has associated grades', async () => {
    const { admin, offering } = await setupDependencies();
    const { student } = await createStudentForAdmin(admin.token);

    const enrollment = await createEnrollment(
      admin.token,
      student.body.id,
      offering.body.id,
    );

    const [assessment] = await database.db
      .insert(assessments)
      .values({
        courseOfferingId: offering.body.id,
        name: 'E2E Assessment',
        type: 'quiz',
        maxScore: '100',
        weight: '20',
      })
      .returning();

    if (!assessment) throw new Error('Failed to create E2E assessment');
    createdAssessmentIds.push(assessment.id);

    const [grade] = await database.db
      .insert(grades)
      .values({
        enrollmentId: enrollment.body.id,
        assessmentId: assessment.id,
      })
      .returning();

    if (!grade) throw new Error('Failed to create E2E grade');
    createdGradeIds.push(grade.id);

    const response = await request(app.getHttpServer())
      .delete(`/enrollments/${enrollment.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body.message).toContain('associated grades');
  });
});
