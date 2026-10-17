import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  courseOfferings,
  courses,
  departments,
  instructors,
  roles,
  semesters,
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

describe('Courses (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let createdCourseIds: string[];
  let createdDepartmentIds: string[];
  let createdOfferingIds: string[];
  let createdInstructorIds: string[];
  let createdSemesterIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdCourseIds = [];
    createdDepartmentIds = [];
    createdOfferingIds = [];
    createdInstructorIds = [];
    createdSemesterIds = [];

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
      // Remove dependent records before their referenced records.
      for (const offeringId of createdOfferingIds) {
        await database.db
          .delete(courseOfferings)
          .where(eq(courseOfferings.id, offeringId));
      }

      for (const courseId of createdCourseIds) {
        await database.db.delete(courses).where(eq(courses.id, courseId));
      }

      for (const instructorId of createdInstructorIds) {
        await database.db
          .delete(instructors)
          .where(eq(instructors.id, instructorId));
      }

      for (const semesterId of createdSemesterIds) {
        await database.db.delete(semesters).where(eq(semesters.id, semesterId));
      }

      for (const departmentId of createdDepartmentIds) {
        await database.db
          .delete(departments)
          .where(eq(departments.id, departmentId));
      }

      for (const email of createdEmails) {
        const [user] = await database.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          continue;
        }

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
    const email = `courses-${randomUUID()}@example.com`;
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

    if (!user) {
      throw new Error(`Test user "${email}" was not found`);
    }

    await database.db
      .update(users)
      .set({ status: 'active' })
      .where(eq(users.id, user.id));

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new Error(`Required role "${roleName}" was not found`);
    }

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
        name: 'E2E Course Department',
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id);

    return response;
  }

  async function createCourse(
    token: string,
    departmentId: string,
    overrides: {
      code?: string;
      title?: string;
      description?: string;
      creditValue?: number;
      departmentId?: string;
    } = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        departmentId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        title: 'E2E Introduction to Computing',
        description: 'Course created for E2E tests',
        creditValue: 3,
        ...overrides,
      })
      .expect(201);

    createdCourseIds.push(response.body.id);

    return response;
  }

  it('rejects unauthenticated course requests', async () => {
    await request(app.getHttpServer()).get('/courses').expect(401);

    await request(app.getHttpServer()).post('/courses').send({}).expect(401);
  });

  it('forbids students from managing courses', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/courses')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create a course', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);

    const response = await createCourse(admin.token, department.body.id, {
      code: 'CS101',
      title: 'Introduction to Computer Science',
      description: 'Fundamental computing concepts',
      creditValue: 3,
    });

    expect(response.body).toMatchObject({
      departmentId: department.body.id,
      code: 'CS101',
      title: 'Introduction to Computer Science',
      description: 'Fundamental computing concepts',
      creditValue: 3,
    });

    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toBeDefined();
  });

  it('normalizes course codes and trims text fields', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);

    const response = await createCourse(admin.token, department.body.id, {
      code: ' math101 ',
      title: ' Mathematics ',
      description: ' Basic mathematics ',
    });

    expect(response.body).toMatchObject({
      code: 'MATH101',
      title: 'Mathematics',
      description: 'Basic mathematics',
    });
  });

  it('rejects duplicate course codes', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);

    await createCourse(admin.token, department.body.id, {
      code: 'DUP101',
      title: 'First Course',
    });

    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        departmentId: department.body.id,
        code: 'DUP101',
        title: 'Second Course',
        creditValue: 3,
      })
      .expect(409);

    expect(response.body.message).toBe(
      'A course with this code already exists',
    );
  });

  it('rejects invalid input and unexpected properties', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const authorization = `Bearer ${admin.token}`;

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', authorization)
      .send({
        departmentId: department.body.id,
        code: 'C',
        title: 'Computer Science',
        creditValue: 3,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', authorization)
      .send({
        departmentId: department.body.id,
        code: 'CS101',
        title: 'Computer Science',
        creditValue: 0,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', authorization)
      .send({
        departmentId: department.body.id,
        code: 'CS101',
        title: 'Computer Science',
        creditValue: 3,
        role: 'admin',
      })
      .expect(400);
  });

  it('rejects a nonexistent department', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        departmentId: randomUUID(),
        code: 'CS101',
        title: 'Computer Science',
        creditValue: 3,
      })
      .expect(400);
  });

  it('allows an admin to list and retrieve courses', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const created = await createCourse(admin.token, department.body.id, {
      code: 'LIST101',
      title: 'Listed Course',
    });

    const listResponse = await request(app.getHttpServer())
      .get('/courses')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          code: 'LIST101',
          title: 'Listed Course',
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/courses/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: created.body.id,
      code: 'LIST101',
      title: 'Listed Course',
      departmentId: department.body.id,
    });
  });

  it('allows an admin to update a course', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const created = await createCourse(admin.token, department.body.id);

    const response = await request(app.getHttpServer())
      .patch(`/courses/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        code: 'updated101',
        title: 'Updated Course',
        creditValue: 4,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      code: 'UPDATED101',
      title: 'Updated Course',
      creditValue: 4,
    });
  });

  it('rejects empty course updates', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const created = await createCourse(admin.token, department.body.id);

    await request(app.getHttpServer())
      .patch(`/courses/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);
  });

  it('returns 404 for a nonexistent course', async () => {
    const admin = await createAccount('admin');
    const missingId = randomUUID();

    await request(app.getHttpServer())
      .get(`/courses/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/courses/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Updated Course' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/courses/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('rejects malformed course IDs', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .get('/courses/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('allows an admin to delete a course', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const created = await createCourse(admin.token, department.body.id);

    const response = await request(app.getHttpServer())
      .delete(`/courses/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.message).toBe('Course deleted successfully');

    await request(app.getHttpServer())
      .get(`/courses/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    createdCourseIds = createdCourseIds.filter((id) => id !== created.body.id);
  });

  it('prevents deleting a course that has course offerings', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);

    const course = await createCourse(admin.token, department.body.id);

    const [semester] = await database.db
      .insert(semesters)
      .values({
        academicYear: 'E2E-2026-2027',
        term: 'fall',
        startDate: '2026-09-01',
        endDate: '2027-01-31',
      })
      .returning();

    if (!semester) {
      throw new Error('Failed to create the E2E semester');
    }

    createdSemesterIds.push(semester.id);

    const [instructor] = await database.db
      .insert(instructors)
      .values({
        userId: admin.id,
        departmentId: department.body.id,
        employeeNumber: `E2E-${randomUUID().slice(0, 8)}`,
        firstName: 'E2E',
        lastName: 'Instructor',
      })
      .returning();

    if (!instructor) {
      throw new Error('Failed to create the E2E instructor');
    }

    createdInstructorIds.push(instructor.id);

    const [offering] = await database.db
      .insert(courseOfferings)
      .values({
        courseId: course.body.id,
        semesterId: semester.id,
        instructorId: instructor.id,
        sectionCode: 'A',
        capacity: 30,
      })
      .returning();

    if (!offering) {
      throw new Error('Failed to create the E2E course offering');
    }

    createdOfferingIds.push(offering.id);

    const response = await request(app.getHttpServer())
      .delete(`/courses/${course.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body.message).toBe(
      'Cannot delete a course that has course offerings',
    );

    await request(app.getHttpServer())
      .get(`/courses/${course.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
