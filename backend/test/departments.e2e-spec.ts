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

describe('Departments (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let createdDepartmentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
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
    const email = `departments-${randomUUID()}@example.com`;
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

  async function createDepartment(
    token: string,
    overrides: {
      code?: string;
      name?: string;
      description?: string;
    } = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Computer Science',
        description: 'Department created for E2E tests',
        ...overrides,
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id);

    return response;
  }

  it('rejects unauthenticated department requests', async () => {
    await request(app.getHttpServer()).get('/departments').expect(401);

    await request(app.getHttpServer())
      .post('/departments')
      .send({ code: 'CS', name: 'Computer Science' })
      .expect(401);
  });

  it('forbids students from managing departments', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/departments')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ code: 'CS', name: 'Computer Science' })
      .expect(403);
  });

  it('allows an admin to create a department', async () => {
    const admin = await createAccount('admin');

    const response = await createDepartment(admin.token, {
      code: 'CS',
      name: 'Computer Science',
      description: 'Computing department',
    });

    expect(response.body).toMatchObject({
      code: 'CS',
      name: 'Computer Science',
      description: 'Computing department',
    });

    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toBeDefined();
  });

  it('normalizes department codes and trims fields', async () => {
    const admin = await createAccount('admin');

    const response = await createDepartment(admin.token, {
      code: ' math ',
      name: ' Mathematics ',
      description: ' Math department ',
    });

    expect(response.body).toMatchObject({
      code: 'MATH',
      name: 'Mathematics',
      description: 'Math department',
    });
  });

  it('rejects duplicate department codes', async () => {
    const admin = await createAccount('admin');

    await createDepartment(admin.token, { code: 'DUP', name: 'First' });

    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ code: 'DUP', name: 'Second' })
      .expect(409);

    expect(response.body.message).toBe(
      'A department with this code already exists',
    );
  });

  it('rejects invalid input and unexpected properties', async () => {
    const admin = await createAccount('admin');
    const authorization = `Bearer ${admin.token}`;

    await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', authorization)
      .send({ code: 'C', name: 'Computer Science' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', authorization)
      .send({
        code: 'CS',
        name: 'Computer Science',
        role: 'admin',
      })
      .expect(400);
  });

  it('allows an admin to list and retrieve departments', async () => {
    const admin = await createAccount('admin');

    const created = await createDepartment(admin.token, {
      code: 'LIST',
      name: 'Listed Department',
    });

    const listResponse = await request(app.getHttpServer())
      .get('/departments')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          code: 'LIST',
          name: 'Listed Department',
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: created.body.id,
      code: 'LIST',
      name: 'Listed Department',
    });
  });

  it('allows an admin to update a department', async () => {
    const admin = await createAccount('admin');
    const created = await createDepartment(admin.token);

    const response = await request(app.getHttpServer())
      .patch(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        code: 'updated',
        name: 'Updated Department',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      code: 'UPDATED',
      name: 'Updated Department',
    });
  });

  it('rejects empty updates', async () => {
    const admin = await createAccount('admin');
    const created = await createDepartment(admin.token);

    await request(app.getHttpServer())
      .patch(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);
  });

  it.each([
    ['code', null],
    ['name', null],
    ['description', null],
  ])(
    'rejects null %s values when updating a department',
    async (field, value) => {
      const admin = await createAccount('admin');
      const created = await createDepartment(admin.token);

      await request(app.getHttpServer())
        .patch(`/departments/${created.body.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ [field]: value })
        .expect(400);
    },
  );

  it('returns 404 for a nonexistent department', async () => {
    const admin = await createAccount('admin');
    const missingId = randomUUID();

    await request(app.getHttpServer())
      .get(`/departments/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/departments/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Updated' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/departments/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('rejects malformed department IDs', async () => {
    const admin = await createAccount('admin');

    await request(app.getHttpServer())
      .get('/departments/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('allows an admin to delete a department', async () => {
    const admin = await createAccount('admin');
    const created = await createDepartment(admin.token);

    const response = await request(app.getHttpServer())
      .delete(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.message).toBe('Department deleted successfully');

    await request(app.getHttpServer())
      .get(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    createdDepartmentIds = createdDepartmentIds.filter(
      (id) => id !== created.body.id,
    );
  });
});
