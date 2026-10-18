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
  instructors,
  roles,
  semesters,
  students,
  userRoles,
  users,
} from '../src/database/schema.js';
import argon2 from 'argon2';

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

describe('Course Offerings (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let createdOfferingIds: string[];
  let createdEnrollmentIds: string[];
  let createdAssessmentIds: string[];
  let createdCourseIds: string[];
  let createdSemesterIds: string[];
  let createdInstructorIds: string[];
  let createdDepartmentIds: string[];
  let createdStudentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdOfferingIds = [];
    createdEnrollmentIds = [];
    createdAssessmentIds = [];
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

      // Student profiles reference departments, so remove them first.
      for (const id of createdStudentIds) {
        await database.db.delete(students).where(eq(students.id, id));
      }

      for (const id of createdDepartmentIds) {
        await database.db.delete(departments).where(eq(departments.id, id));
      }

      // Remove registered student profiles before deleting users.
      for (const email of createdEmails) {
        const [user] = await database.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (user) {
          await database.db
            .delete(students)
            .where(eq(students.userId, user.id));
        }
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
    const email = `offerings-${randomUUID()}@example.com`;
    createdEmails.push(email);

    const [department] = await database.db
      .insert(departments)
      .values({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Registration Department',
      })
      .returning({ id: departments.id });
    if (!department) throw new Error('Failed to create E2E department');

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'Test',
        lastName: 'Student',
        departmentId: department.id,
        number: `E2E-${randomUUID().slice(0, 8)}`,
        birth: '2005-05-15',
      })
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
        name: 'E2E Offering Department',
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id);
    return response;
  }

  async function createCourse(token: string, departmentId: string) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        departmentId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        title: 'E2E Offering Course',
        creditValue: 3,
      })
      .expect(201);

    createdCourseIds.push(response.body.id);
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
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        semesterId,
        instructorId,
        sectionCode: 'A',
        capacity: 30,
        ...overrides,
      })
      .expect(201);

    createdOfferingIds.push(response.body.id);
    return response;
  }

  async function setupOfferingDependencies() {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const course = await createCourse(admin.token, department.body.id);
    const semester = await createSemester();
    const instructor = await createInstructor(admin.id, department.body.id);

    return {
      admin,
      department,
      course,
      semester,
      instructor,
    };
  }

  async function createUnregisteredAccount(roleName: 'student' | 'admin') {
    const email = `e2e-${randomUUID()}@example.com`;
    createdEmails.push(email);

    const passwordHash = await argon2.hash(password);
    const [user] = await database.db
      .insert(users)
      .values({ email, passwordHash, status: 'active' })
      .returning({ id: users.id });

    if (!user) throw new Error('Failed to create E2E user');

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) throw new Error(`Required role "${roleName}" was not found`);

    await database.db
      .insert(userRoles)
      .values({ userId: user.id, roleId: role.id });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      id: user.id,
      token: response.body.accessToken as string,
    };
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/course-offerings').expect(401);

    await request(app.getHttpServer())
      .post('/course-offerings')
      .send({})
      .expect(401);
  });

  it('forbids students from managing course offerings', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/course-offerings')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create an offering', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    const response = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
      { sectionCode: ' a ' },
    );

    expect(response.body).toMatchObject({
      courseId: course.body.id,
      semesterId: semester.id,
      instructorId: instructor.id,
      sectionCode: 'A',
      capacity: 30,
    });
    expect(response.body.id).toEqual(expect.any(String));
  });

  it('allows an omitted capacity', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    const response = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
      { sectionCode: 'B', capacity: undefined },
    );

    expect(response.body.capacity).toBeNull();
  });

  it('rejects duplicate section codes for the same course and semester', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
    );

    const response = await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseId: course.body.id,
        semesterId: semester.id,
        instructorId: instructor.id,
        sectionCode: 'a',
        capacity: 25,
      })
      .expect(409);

    expect(response.body.message).toContain('already exists');
  });

  it('rejects nonexistent related records', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseId: randomUUID(),
        semesterId: semester.id,
        instructorId: instructor.id,
        sectionCode: 'B',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseId: course.body.id,
        semesterId: semester.id,
        instructorId: randomUUID(),
        sectionCode: 'C',
      })
      .expect(400);
  });

  it('rejects invalid payloads and unexpected properties', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    const payload = {
      courseId: course.body.id,
      semesterId: semester.id,
      instructorId: instructor.id,
      sectionCode: 'A',
    };

    await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, capacity: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, sectionCode: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, unexpected: true })
      .expect(400);
  });

  it('allows an admin to list and retrieve offerings', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    const created = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
    );

    const list = await request(app.getHttpServer())
      .get('/course-offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          sectionCode: 'A',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/course-offerings/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.body.id);
      });
  });

  it('allows an admin to update an offering', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    const created = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
    );

    const response = await request(app.getHttpServer())
      .patch(`/course-offerings/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ sectionCode: ' b ', capacity: 40 })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      sectionCode: 'B',
      capacity: 40,
    });
  });

  it('rejects empty updates and malformed IDs', async () => {
    const { admin } = await setupOfferingDependencies();

    await request(app.getHttpServer())
      .patch(`/course-offerings/${randomUUID()}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .get('/course-offerings/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('returns 404 for nonexistent offerings', async () => {
    const { admin } = await setupOfferingDependencies();
    const id = randomUUID();

    await request(app.getHttpServer())
      .get(`/course-offerings/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/course-offerings/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ sectionCode: 'B' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/course-offerings/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('allows an admin to delete an offering', async () => {
    const { admin, course, semester, instructor } =
      await setupOfferingDependencies();

    const created = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
    );

    await request(app.getHttpServer())
      .delete(`/course-offerings/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ id: created.body.id });
      });

    createdOfferingIds = createdOfferingIds.filter(
      (id) => id !== created.body.id,
    );
  });

  it('prevents deleting an offering referenced by an enrollment', async () => {
    const { admin, course, semester, instructor, department } =
      await setupOfferingDependencies();

    const student = await createUnregisteredAccount('student');

    const studentResponse = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: student.id,
        departmentId: department.body.id,
        number: `STU-${randomUUID().slice(0, 8)}`,
        firstName: 'E2E',
        lastName: 'Student',
        birth: '2005-05-15',
      })
      .expect(201);

    createdStudentIds.push(studentResponse.body.id as string);

    const offering = await createOffering(
      admin.token,
      course.body.id,
      semester.id,
      instructor.id,
    );

    const [enrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: studentResponse.body.id,
        courseOfferingId: offering.body.id,
        status: 'enrolled',
      })
      .returning();

    if (!enrollment) {
      throw new Error('Failed to create test enrollment');
    }

    createdEnrollmentIds.push(enrollment.id);

    const response = await request(app.getHttpServer())
      .delete(`/course-offerings/${offering.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body.message).toContain('Cannot delete');

    await request(app.getHttpServer())
      .get(`/course-offerings/${offering.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
