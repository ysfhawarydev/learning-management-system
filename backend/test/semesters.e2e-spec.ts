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

describe('Semesters (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let createdSemesterIds: string[];
  let createdOfferingIds: string[];
  let createdCourseIds: string[];
  let createdInstructorIds: string[];
  let createdDepartmentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdSemesterIds = [];
    createdOfferingIds = [];
    createdCourseIds = [];
    createdInstructorIds = [];
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
    const email = `semesters-${randomUUID()}@example.com`;
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

  function semesterPayload(overrides: Record<string, unknown> = {}) {
    return {
      academicYear: `E2E-${randomUUID().slice(0, 8)}`,
      term: 'fall',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      ...overrides,
    };
  }

  async function createSemester(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', `Bearer ${token}`)
      .send(semesterPayload(overrides))
      .expect(201);

    createdSemesterIds.push(response.body.id);
    return response;
  }

  async function createDepartment(token: string) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Semester Department',
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
        title: 'E2E Semester Course',
        creditValue: 3,
      })
      .expect(201);

    createdCourseIds.push(response.body.id);
    return response;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/semesters').expect(401);
    await request(app.getHttpServer()).post('/semesters').send({}).expect(401);
  });

  it('forbids students from managing semesters', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/semesters')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', `Bearer ${student.token}`)
      .send(semesterPayload())
      .expect(403);
  });

  it('allows an admin to create a semester with the default status', async () => {
    const admin = await createAccount('admin');

    const response = await createSemester(admin.token, {
      academicYear: '  2026-2027  ',
      term: 'fall',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
    });

    expect(response.body).toMatchObject({
      academicYear: '2026-2027',
      term: 'fall',
      status: 'planned',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toBeDefined();
  });

  it('rejects duplicate academic year and term combinations', async () => {
    const admin = await createAccount('admin');
    const payload = {
      academicYear: '2026-2027',
      term: 'fall',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
    };

    await createSemester(admin.token, payload);

    const response = await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(payload)
      .expect(409);

    expect(response.body.message).toBe(
      'A semester with this academic year and term already exists',
    );
  });

  it('rejects invalid input and unexpected properties', async () => {
    const admin = await createAccount('admin');
    const authorization = `Bearer ${admin.token}`;

    await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', authorization)
      .send(semesterPayload({ academicYear: '   ' }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', authorization)
      .send(semesterPayload({ term: 'autumn' }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', authorization)
      .send(semesterPayload({ startDate: 'not-a-date' }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', authorization)
      .send(semesterPayload({ role: 'admin' }))
      .expect(400);
  });

  it('rejects a semester whose end date precedes its start date', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .post('/semesters')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(
        semesterPayload({
          startDate: '2026-12-31',
          endDate: '2026-09-01',
        }),
      )
      .expect(400);
  });

  it('allows an admin to list and retrieve semesters', async () => {
    const admin = await createAccount('admin');
    const created = await createSemester(admin.token, {
      academicYear: `LIST-${randomUUID().slice(0, 8)}`,
    });

    const listResponse = await request(app.getHttpServer())
      .get('/semesters')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          academicYear: created.body.academicYear,
          term: 'fall',
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/semesters/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: created.body.id,
      academicYear: created.body.academicYear,
      term: 'fall',
    });
  });

  it('allows an admin to update a semester', async () => {
    const admin = await createAccount('admin');
    const created = await createSemester(admin.token);

    const response = await request(app.getHttpServer())
      .patch(`/semesters/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        status: 'active',
        academicYear: '2027-2028',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      status: 'active',
      academicYear: '2027-2028',
    });
  });

  it('rejects empty updates', async () => {
    const admin = await createAccount('admin');
    const created = await createSemester(admin.token);

    await request(app.getHttpServer())
      .patch(`/semesters/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);
  });

  it('rejects updates that produce an invalid date range', async () => {
    const admin = await createAccount('admin');
    const created = await createSemester(admin.token);

    await request(app.getHttpServer())
      .patch(`/semesters/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ startDate: '2027-01-01' })
      .expect(400);
  });

  it('returns 404 for a nonexistent semester', async () => {
    const admin = await createAccount('admin');
    const missingId = randomUUID();

    await request(app.getHttpServer())
      .get(`/semesters/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/semesters/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'active' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/semesters/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('rejects malformed semester IDs', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .get('/semesters/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('allows an admin to delete a semester', async () => {
    const admin = await createAccount('admin');
    const created = await createSemester(admin.token);

    const response = await request(app.getHttpServer())
      .delete(`/semesters/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.message).toBe('Semester deleted successfully');

    await request(app.getHttpServer())
      .get(`/semesters/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    createdSemesterIds = createdSemesterIds.filter(
      (id) => id !== created.body.id,
    );
  });

  it('prevents deleting a semester referenced by a course offering', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const course = await createCourse(admin.token, department.body.id);
    const semester = await createSemester(admin.token);

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
        semesterId: semester.body.id,
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
      .delete(`/semesters/${semester.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body.message).toBe(
      'Cannot delete a semester that has course offerings',
    );

    await request(app.getHttpServer())
      .get(`/semesters/${semester.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
