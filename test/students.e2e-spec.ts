import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  departments,
  roles,
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

describe('Students (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let departmentId: string;

  const password = 'StrongPassword123!';
  let createdEmails: string[];

  beforeEach(async () => {
    createdEmails = [];

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

    const [department] = await database.db
      .insert(departments)
      .values({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Computer Science',
        description: 'Department created for E2E tests',
      })
      .returning({ id: departments.id });

    if (!department) {
      throw new Error('Failed to create the E2E test department');
    }

    departmentId = department.id;
  });

  afterEach(async () => {
    try {
      for (const email of createdEmails) {
        const [user] = await database.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          continue;
        }

        await database.db.delete(students).where(eq(students.userId, user.id));

        await database.db
          .delete(userRoles)
          .where(eq(userRoles.userId, user.id));

        await database.db.delete(users).where(eq(users.id, user.id));
      }

      await database.db
        .delete(departments)
        .where(eq(departments.id, departmentId));
    } finally {
      await app.close();
    }
  });

  async function createAccount(roleName: 'student' | 'admin' = 'student') {
    const email = `students-${randomUUID()}@example.com`;
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

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      id: user.id,
      email,
      token: loginResponse.body.accessToken as string,
    };
  }

  // Do not mark this helper async: Supertest's .expect() must be
  // chained to the request before awaiting it.
  function createStudent(
    adminToken: string,
    userId: string,
    number = `STU-${randomUUID().slice(0, 8)}`,
  ) {
    return request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId,
        departmentId,
        number,
        firstName: 'John',
        lastName: 'Doe',
        birth: '2005-05-15',
      });
  }

  it('rejects unauthenticated access to student endpoints', async () => {
    await request(app.getHttpServer()).get('/students').expect(401);

    await request(app.getHttpServer()).post('/students').send({}).expect(401);

    await request(app.getHttpServer())
      .patch(`/students/${randomUUID()}`)
      .send({ firstName: 'Updated' })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/students/${randomUUID()}`)
      .expect(401);
  });

  it('forbids a student from creating a student profile', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        userId: student.id,
        departmentId,
        number: `STU-${randomUUID().slice(0, 8)}`,
        firstName: 'John',
        lastName: 'Doe',
        birth: '2005-05-15',
      })
      .expect(403);
  });

  it('allows an admin to create a student profile', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');
    const number = `STU-${randomUUID().slice(0, 8)}`;

    const response = await createStudent(
      admin.token,
      studentUser.id,
      number,
    ).expect(201);

    expect(response.body).toMatchObject({
      userId: studentUser.id,
      departmentId,
      number,
      firstName: 'John',
      lastName: 'Doe',
      birth: '2005-05-15',
      status: 'applicant',
    });

    expect(response.body.id).toEqual(expect.any(String));
  });

  it('rejects invalid student creation input', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: 'not-a-uuid',
        departmentId,
        number: '',
        firstName: 'John',
        lastName: 'Doe',
        birth: 'not-a-date',
      })
      .expect(400);
  });

  it('rejects unexpected properties in student creation input', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: studentUser.id,
        departmentId,
        number: `STU-${randomUUID().slice(0, 8)}`,
        firstName: 'John',
        lastName: 'Doe',
        birth: '2005-05-15',
        role: 'admin',
      })
      .expect(400);
  });

  it('returns 404 when creating a profile for a nonexistent user', async () => {
    const admin = await createAccount('admin');

    const response = await createStudent(admin.token, randomUUID()).expect(404);

    expect(response.body.message).toBe('User not found');
  });

  it('returns 409 when a user already has a student profile', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    await createStudent(admin.token, studentUser.id).expect(201);

    const response = await createStudent(admin.token, studentUser.id).expect(
      409,
    );

    expect(response.body.message).toBe(
      'A student profile already exists for this user',
    );
  });

  it('allows an admin to list student profiles', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    const response = await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          userId: studentUser.id,
          departmentName: 'E2E Computer Science',
        }),
      ]),
    );
  });

  it('allows an admin to retrieve a student by ID', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    const response = await request(app.getHttpServer())
      .get(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.id).toBe(created.body.id);
    expect(response.body.userId).toBe(studentUser.id);
  });

  it('allows a student to retrieve their own profile', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    const response = await request(app.getHttpServer())
      .get('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      userId: studentUser.id,
      departmentName: 'E2E Computer Science',
    });
  });

  it('returns 404 when a student has no profile yet', async () => {
    const student = await createAccount('student');

    const response = await request(app.getHttpServer())
      .get('/students/me')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(404);

    expect(response.body.message).toBe('Student profile not found');
  });

  it('forbids students from listing student profiles', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);
  });

  it('forbids students from retrieving a student by ID', async () => {
    const admin = await createAccount('admin');
    const owner = await createAccount('student');
    const otherStudent = await createAccount('student');

    const created = await createStudent(admin.token, owner.id).expect(201);

    await request(app.getHttpServer())
      .get(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${otherStudent.token}`)
      .expect(403);
  });

  it('allows an admin to update a student profile', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    const response = await request(app.getHttpServer())
      .patch(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        firstName: 'Updated',
        status: 'enrolled',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      firstName: 'Updated',
      status: 'enrolled',
    });
  });

  it('rejects an empty student update', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    await request(app.getHttpServer())
      .patch(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);
  });

  it('rejects an invalid student status', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    await request(app.getHttpServer())
      .patch(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'invalid-status' })
      .expect(400);
  });

  it('rejects malformed student IDs', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .get('/students/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('allows an admin to soft-delete a student', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    const deletion = await request(app.getHttpServer())
      .delete(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(deletion.body.message).toBe('Student soft-deleted successfully');

    expect(deletion.body.student.deletedAt).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(
      listResponse.body.some(
        (student: { id: string }) => student.id === created.body.id,
      ),
    ).toBe(false);

    await request(app.getHttpServer())
      .get('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(404);
  });

  it('forbids students from updating or deleting student profiles', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');
    const otherStudent = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    await request(app.getHttpServer())
      .patch(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${otherStudent.token}`)
      .send({ firstName: 'Unauthorized' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/students/${created.body.id}`)
      .set('Authorization', `Bearer ${otherStudent.token}`)
      .expect(403);
  });
});
