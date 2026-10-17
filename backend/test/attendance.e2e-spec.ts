import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  attendance,
  courseOfferings,
  courses,
  departments,
  enrollments,
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

describe('Attendance (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;

  let createdEmails: string[];
  let createdAttendanceIds: string[];
  let createdEnrollmentIds: string[];
  let createdOfferingIds: string[];
  let createdCourseIds: string[];
  let createdInstructorIds: string[];
  let createdSemesterIds: string[];
  let createdStudentIds: string[];
  let createdDepartmentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdAttendanceIds = [];
    createdEnrollmentIds = [];
    createdOfferingIds = [];
    createdCourseIds = [];
    createdInstructorIds = [];
    createdSemesterIds = [];
    createdStudentIds = [];
    createdDepartmentIds = [];

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
      for (const id of createdAttendanceIds) {
        await database.db.delete(attendance).where(eq(attendance.id, id));
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
    const email = `attendance-${randomUUID()}@example.com`;
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
        name: 'E2E Attendance Department',
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
        title: 'E2E Attendance Course',
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

  async function createStudent(token: string, departmentId: string) {
    const account = await createAccount('student');

    const response = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${token}`)
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
    token: string,
    studentId: string,
    courseOfferingId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId, courseOfferingId })
      .expect(201);

    createdEnrollmentIds.push(response.body.id as string);
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

    const student = await createStudent(admin.token, department.body.id);
    const enrollment = await createEnrollment(
      admin.token,
      student.body.id,
      offering.body.id,
    );

    return { admin, department, offering, enrollment };
  }

  async function createAttendance(
    token: string,
    enrollmentId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enrollmentId,
        sessionDate: '2026-10-17',
        status: 'present',
        ...overrides,
      })
      .expect(201);

    createdAttendanceIds.push(response.body.id as string);
    return response;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/attendance').expect(401);

    await request(app.getHttpServer()).post('/attendance').send({}).expect(401);
  });

  it('forbids students from managing attendance', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/attendance')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create, list, retrieve, update, and delete attendance', async () => {
    const { admin, enrollment } = await setupDependencies();

    const created = await createAttendance(
      admin.token,
      enrollment.body.id as string,
      { notes: 'On time' },
    );

    expect(created.body).toMatchObject({
      enrollmentId: enrollment.body.id,
      sessionDate: '2026-10-17',
      status: 'present',
      notes: 'On time',
    });
    expect(created.body.id).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/attendance/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
      });

    await request(app.getHttpServer())
      .patch(`/attendance/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'late', notes: 'Arrived late' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('late');
        expect(body.notes).toBe('Arrived late');
      });

    await request(app.getHttpServer())
      .delete(`/attendance/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ id: created.body.id });
      });

    createdAttendanceIds = createdAttendanceIds.filter(
      (id) => id !== created.body.id,
    );
  });

  it('rejects duplicate attendance for the same enrollment and date', async () => {
    const { admin, enrollment } = await setupDependencies();

    await createAttendance(admin.token, enrollment.body.id as string);

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        enrollmentId: enrollment.body.id,
        sessionDate: '2026-10-17',
        status: 'absent',
      })
      .expect(409);
  });

  it('rejects invalid payloads and malformed IDs', async () => {
    const { admin, enrollment } = await setupDependencies();
    const payload = {
      enrollmentId: enrollment.body.id,
      sessionDate: '2026-10-17',
      status: 'present',
    };

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, enrollmentId: 'not-a-uuid' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, sessionDate: 'not-a-date' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, status: 'unknown' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, notes: 'x'.repeat(501) })
      .expect(400);

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, unexpected: true })
      .expect(400);

    const record = await createAttendance(
      admin.token,
      enrollment.body.id as string,
    );

    await request(app.getHttpServer())
      .get('/attendance/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/attendance/${record.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/attendance/${record.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ unexpected: true })
      .expect(400);
  });

  it('rejects nonexistent enrollment IDs', async () => {
    const { admin } = await setupDependencies();

    await request(app.getHttpServer())
      .post('/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        enrollmentId: randomUUID(),
        sessionDate: '2026-10-17',
        status: 'present',
      })
      .expect(404);
  });

  it('returns 404 for nonexistent attendance records', async () => {
    const { admin } = await setupDependencies();
    const id = randomUUID();

    await request(app.getHttpServer())
      .get(`/attendance/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/attendance/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'absent' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/attendance/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });
});
