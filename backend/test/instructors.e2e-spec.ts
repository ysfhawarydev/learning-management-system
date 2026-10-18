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

describe('Instructors (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let createdInstructorIds: string[];
  let createdDepartmentIds: string[];
  let createdOfferingIds: string[];
  let createdCourseIds: string[];
  let createdSemesterIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdInstructorIds = [];
    createdDepartmentIds = [];
    createdOfferingIds = [];
    createdCourseIds = [];
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
      for (const offeringId of createdOfferingIds) {
        await database.db
          .delete(courseOfferings)
          .where(eq(courseOfferings.id, offeringId));
      }

      for (const instructorId of createdInstructorIds) {
        await database.db
          .delete(instructors)
          .where(eq(instructors.id, instructorId));
      }

      for (const courseId of createdCourseIds) {
        await database.db.delete(courses).where(eq(courses.id, courseId));
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
    const email = `instructors-${randomUUID()}@example.com`;
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

  async function createDepartment(token: string) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `IE-${randomUUID().slice(0, 8)}`,
        name: 'E2E Instructor Department',
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id);

    return response;
  }

  async function createInstructor(
    token: string,
    userId: string,
    departmentId: string,
    overrides: {
      employeeNumber?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      userId?: string;
      departmentId?: string;
    } = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId,
        departmentId,
        employeeNumber: `IE${randomUUID().replaceAll('-', '').slice(0, 10)}`,
        firstName: 'John',
        lastName: 'Doe',
        phone: '123456789',
        ...overrides,
      })
      .expect(201);

    createdInstructorIds.push(response.body.id);

    return response;
  }

  async function createInstructorAccount(
    token: string,
    departmentId: string,
    overrides: {
      email?: string;
      password?: string;
      employeeNumber?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      departmentId?: string;
    } = {},
  ) {
    const email = overrides.email ?? `instructor-${randomUUID()}@example.com`;
    createdEmails.push(email);

    const response = await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email,
        password,
        departmentId,
        employeeNumber: `EMP${randomUUID().replaceAll('-', '').slice(0, 10)}`,
        firstName: 'John',
        lastName: 'Doe',
        ...overrides,
      })
      .expect(201);

    createdInstructorIds.push(response.body.id);

    return { email, response };
  }

  it('rejects unauthenticated instructor requests', async () => {
    await request(app.getHttpServer()).get('/instructors').expect(401);

    await request(app.getHttpServer())
      .post('/instructors')
      .send({})
      .expect(401);
  });

  it('forbids students from managing instructors', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/instructors')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create an instructor', async () => {
    const admin = await createAccount('admin');
    const instructorAccount = await createAccount('student');
    const department = await createDepartment(admin.token);

    const response = await createInstructor(
      admin.token,
      instructorAccount.id,
      department.body.id,
      {
        employeeNumber: 'EMP10001',
        firstName: 'Alice',
        lastName: 'Johnson',
      },
    );

    expect(response.body).toMatchObject({
      userId: instructorAccount.id,
      departmentId: department.body.id,
      employeeNumber: 'EMP10001',
      firstName: 'Alice',
      lastName: 'Johnson',
      phone: '123456789',
    });

    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toBeDefined();

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'instructor'))
      .limit(1);

    expect(role).toBeDefined();

    const assignment = await database.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.userId, instructorAccount.id));

    expect(assignment.length).toBeGreaterThan(0);
  });

  it('trims instructor text fields', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);

    const response = await createInstructor(
      admin.token,
      account.id,
      department.body.id,
      {
        employeeNumber: ' EMP10002 ',
        firstName: ' Alice ',
        lastName: ' Johnson ',
        phone: ' 987654321 ',
      },
    );

    expect(response.body).toMatchObject({
      employeeNumber: 'EMP10002',
      firstName: 'Alice',
      lastName: 'Johnson',
      phone: '987654321',
    });
  });

  it('rejects duplicate employee numbers', async () => {
    const admin = await createAccount('admin');
    const firstAccount = await createAccount('student');
    const secondAccount = await createAccount('student');
    const department = await createDepartment(admin.token);

    await createInstructor(admin.token, firstAccount.id, department.body.id, {
      employeeNumber: 'EMP20001',
    });

    const response = await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: secondAccount.id,
        departmentId: department.body.id,
        employeeNumber: 'EMP20001',
        firstName: 'Second',
        lastName: 'Instructor',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'The employee number or instructor account is already in use',
    );
  });

  it('rejects a second instructor profile for the same user', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);

    await createInstructor(admin.token, account.id, department.body.id);

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: account.id,
        departmentId: department.body.id,
        employeeNumber: `IE${randomUUID().replaceAll('-', '').slice(0, 10)}`,
        firstName: 'Another',
        lastName: 'Profile',
      })
      .expect(409);
  });

  it('rejects invalid input and unexpected properties', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);
    const authorization = `Bearer ${admin.token}`;

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', authorization)
      .send({
        userId: account.id,
        departmentId: department.body.id,
        employeeNumber: '',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', authorization)
      .send({
        userId: account.id,
        departmentId: department.body.id,
        employeeNumber: 'EMP10003',
        firstName: 'John',
        lastName: 'Doe',
        unexpectedField: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', authorization)
      .send({
        userId: 'not-a-uuid',
        departmentId: department.body.id,
        employeeNumber: 'EMP10004',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(400);
  });

  it('rejects nonexistent users and departments', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const account = await createAccount('student');

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: randomUUID(),
        departmentId: department.body.id,
        employeeNumber: 'EMP30001',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post('/instructors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: account.id,
        departmentId: randomUUID(),
        employeeNumber: 'EMP30002',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(404);
  });

  it('allows an admin to list and retrieve instructors', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);

    const created = await createInstructor(
      admin.token,
      account.id,
      department.body.id,
      {
        employeeNumber: 'EMP40001',
        firstName: 'Listed',
        lastName: 'Instructor',
      },
    );

    const listResponse = await request(app.getHttpServer())
      .get('/instructors')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          employeeNumber: 'EMP40001',
          firstName: 'Listed',
          departmentName: 'E2E Instructor Department',
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/instructors/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: created.body.id,
      userId: account.id,
      departmentId: department.body.id,
      employeeNumber: 'EMP40001',
      firstName: 'Listed',
      lastName: 'Instructor',
    });
  });

  it('allows an admin to update an instructor', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);

    const created = await createInstructor(
      admin.token,
      account.id,
      department.body.id,
    );

    const response = await request(app.getHttpServer())
      .patch(`/instructors/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        firstName: 'Updated',
        employeeNumber: 'EMP50001',
        phone: null,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      firstName: 'Updated',
      employeeNumber: 'EMP50001',
      phone: null,
    });
  });

  it('rejects empty instructor updates', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);

    const created = await createInstructor(
      admin.token,
      account.id,
      department.body.id,
    );

    await request(app.getHttpServer())
      .patch(`/instructors/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);
  });

  it('returns 404 for a nonexistent instructor', async () => {
    const admin = await createAccount('admin');
    const missingId = randomUUID();

    await request(app.getHttpServer())
      .get(`/instructors/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/instructors/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ firstName: 'Updated' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/instructors/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('rejects malformed instructor IDs', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .get('/instructors/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('allows an admin to delete an instructor', async () => {
    const admin = await createAccount('admin');
    const account = await createAccount('student');
    const department = await createDepartment(admin.token);

    const created = await createInstructor(
      admin.token,
      account.id,
      department.body.id,
    );

    const response = await request(app.getHttpServer())
      .delete(`/instructors/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.message).toBe('Instructor deleted successfully');

    await request(app.getHttpServer())
      .get(`/instructors/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    createdInstructorIds = createdInstructorIds.filter(
      (id) => id !== created.body.id,
    );
  });

  it('prevents deleting an instructor who has course offerings', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const courseResponse = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        departmentId: department.body.id,
        code: `IE-${randomUUID().slice(0, 8)}`,
        title: 'E2E Instructor Course',
        creditValue: 3,
      })
      .expect(201);

    createdCourseIds.push(courseResponse.body.id);

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
        employeeNumber: `IE${randomUUID().replaceAll('-', '').slice(0, 10)}`,
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
        courseId: courseResponse.body.id,
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
      .delete(`/instructors/${instructor.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    expect(response.body.message).toBe(
      'Cannot delete an instructor who has course offerings',
    );
  });

  it('allows an admin to create an instructor account and profile', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);

    const { email, response } = await createInstructorAccount(
      admin.token,
      department.body.id,
      {
        email: `new-instructor-${randomUUID()}@example.com`,
        employeeNumber: 'NEWEMP1001',
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '123456789',
      },
    );

    expect(response.body).toMatchObject({
      departmentId: department.body.id,
      departmentName: 'E2E Instructor Department',
      employeeNumber: 'NEWEMP1001',
      firstName: 'Alice',
      lastName: 'Johnson',
      phone: '123456789',
    });

    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.userId).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');

    const [user] = await database.db
      .select({
        id: users.id,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    expect(user).toBeDefined();
    expect(user?.id).toBe(response.body.userId);
    expect(user?.status).toBe('active');

    const [instructorRole] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'instructor'))
      .limit(1);

    expect(instructorRole).toBeDefined();

    const assignments = await database.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, response.body.userId));

    expect(assignments).toContainEqual({
      roleId: instructorRole?.id,
    });
  });

  it('rejects unauthenticated instructor account creation', async () => {
    await request(app.getHttpServer())
      .post('/instructors/accounts')
      .send({})
      .expect(401);
  });

  it('forbids students from creating instructor accounts', async () => {
    const student = await createAccount('student');
    const department = await createDepartment(
      (await createAccount('admin')).token,
    );

    await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        email: `forbidden-${randomUUID()}@example.com`,
        password,
        departmentId: department.body.id,
        employeeNumber: 'FORBIDDEN01',
        firstName: 'Forbidden',
        lastName: 'User',
      })
      .expect(403);
  });

  it('rejects duplicate instructor account emails', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const email = `duplicate-${randomUUID()}@example.com`;

    await createInstructorAccount(admin.token, department.body.id, {
      email,
      employeeNumber: 'DUPLICATE01',
    });

    const response = await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        email,
        password,
        departmentId: department.body.id,
        employeeNumber: 'DUPLICATE02',
        firstName: 'Second',
        lastName: 'Instructor',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'The email or employee number is already in use',
    );
  });

  it('rejects duplicate instructor employee numbers', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const employeeNumber = `DUP${randomUUID().replaceAll('-', '').slice(0, 8)}`;

    await createInstructorAccount(admin.token, department.body.id, {
      employeeNumber,
    });

    const response = await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        email: `another-${randomUUID()}@example.com`,
        password,
        departmentId: department.body.id,
        employeeNumber,
        firstName: 'Second',
        lastName: 'Instructor',
      })
      .expect(409);

    expect(response.body.message).toBe(
      'The email or employee number is already in use',
    );
  });

  it('rejects invalid instructor account payloads', async () => {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const authorization = `Bearer ${admin.token}`;

    await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', authorization)
      .send({
        email: 'not-an-email',
        password: 'short',
        departmentId: department.body.id,
        employeeNumber: '',
        firstName: '',
        lastName: 'Doe',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', authorization)
      .send({
        email: `unexpected-${randomUUID()}@example.com`,
        password,
        departmentId: department.body.id,
        employeeNumber: 'VALIDEMP01',
        firstName: 'John',
        lastName: 'Doe',
        unexpectedField: true,
      })
      .expect(400);
  });

  it('rejects a nonexistent department when creating an instructor account', async () => {
    const admin = await createAccount('admin');

    const response = await request(app.getHttpServer())
      .post('/instructors/accounts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        email: `missing-department-${randomUUID()}@example.com`,
        password,
        departmentId: randomUUID(),
        employeeNumber: 'NODEPT1001',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(404);

    expect(response.body.message).toBe('Department not found');
  });
});
