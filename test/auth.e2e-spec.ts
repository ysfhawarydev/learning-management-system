import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { roles, userRoles, users } from '../src/database/schema.js';

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

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let email: string;

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    email = `auth-${randomUUID()}@example.com`;

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
      const [user] = await database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user) {
        await database.db
          .delete(userRoles)
          .where(eq(userRoles.userId, user.id));

        await database.db.delete(users).where(eq(users.id, user.id));
      }
    } finally {
      await app.close();
    }
  });

  function registerUser() {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password });
  }

  async function activateUser() {
    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new Error('Test user was not found');
    }

    await database.db
      .update(users)
      .set({ status: 'active' })
      .where(eq(users.id, user.id));

    return user.id;
  }

  async function assignRole(userId: string, roleName: 'student' | 'admin') {
    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new Error(`Required test role "${roleName}" was not found`);
    }

    await database.db
      .insert(userRoles)
      .values({ userId, roleId: role.id })
      .onConflictDoNothing();
  }

  async function loginAndGetToken() {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');

    return response.body.accessToken as string;
  }

  it('registers a user and returns safe account information', async () => {
    const response = await registerUser().expect(201);

    expect(response.body.message).toBe(
      'Registration successful. Your account is pending activation.',
    );

    expect(response.body.user).toMatchObject({
      email,
      status: 'pending',
    });

    expect(response.body.user.id).toBeDefined();
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('normalizes the email address during registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: email.toUpperCase(),
        password,
      })
      .expect(201);

    expect(response.body.user.email).toBe(email);
  });

  it('rejects duplicate email registration', async () => {
    await registerUser().expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password })
      .expect(409);
  });

  it('rejects invalid registration input', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);
  });

  it('rejects unexpected registration properties', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        role: 'admin',
      })
      .expect(400);
  });

  it('rejects login with an incorrect password', async () => {
    await registerUser().expect(201);

    const userId = await activateUser();
    await assignRole(userId, 'student');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'WrongPassword123!',
      })
      .expect(401);
  });

  it('rejects login while the account is pending activation', async () => {
    await registerUser().expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(403);

    expect(response.body.message).toBe('Your account is not active');
  });

  it('successfully logs in an active student and returns a JWT', async () => {
    await registerUser().expect(201);

    const userId = await activateUser();
    await assignRole(userId, 'student');

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.roles).toContain('student');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('allows an authenticated student to access their profile', async () => {
    await registerUser().expect(201);

    const userId = await activateUser();
    await assignRole(userId, 'student');

    const token = await loginAndGetToken();

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('allows a student to access the student area', async () => {
    await registerUser().expect(201);

    const userId = await activateUser();
    await assignRole(userId, 'student');

    const token = await loginAndGetToken();

    await request(app.getHttpServer())
      .get('/auth/student-area')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('forbids a student from accessing the admin area', async () => {
    await registerUser().expect(201);

    const userId = await activateUser();
    await assignRole(userId, 'student');

    const token = await loginAndGetToken();

    await request(app.getHttpServer())
      .get('/auth/admin-area')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it.each(['/auth/me', '/auth/student-area', '/auth/admin-area'])(
    'rejects unauthenticated access to %s',
    async (route) => {
      await request(app.getHttpServer()).get(route).expect(401);
    },
  );

  it('rejects an invalid JWT on a protected route', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });
});
