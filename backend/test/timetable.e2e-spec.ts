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
  timetableSlots,
  userRoles,
  users,
  students,
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

describe('Timetable (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let createdEmails: string[];
  let slotIds: string[];
  let offeringIds: string[];
  let courseIds: string[];
  let instructorIds: string[];
  let semesterIds: string[];
  let departmentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    slotIds = [];
    offeringIds = [];
    courseIds = [];
    instructorIds = [];
    semesterIds = [];
    departmentIds = [];

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
      for (const id of slotIds) {
        await database.db
          .delete(timetableSlots)
          .where(eq(timetableSlots.id, id));
      }
      for (const id of offeringIds) {
        await database.db
          .delete(courseOfferings)
          .where(eq(courseOfferings.id, id));
      }
      for (const id of courseIds) {
        await database.db.delete(courses).where(eq(courses.id, id));
      }
      for (const id of instructorIds) {
        await database.db.delete(instructors).where(eq(instructors.id, id));
      }
      for (const id of semesterIds) {
        await database.db.delete(semesters).where(eq(semesters.id, id));
      }
      // Registration creates a student profile for each registered user.
      // Remove profiles before deleting their departments or users.
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

        if (user) {
          await database.db
            .delete(students)
            .where(eq(students.userId, user.id));
        }
      }

      for (const id of departmentIds) {
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
    const email = `timetable-${randomUUID()}@example.com`;
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

    return { id: user.id, token: response.body.accessToken as string };
  }

  async function createDepartment(token: string) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `TT-${randomUUID().slice(0, 8)}`,
        name: 'Timetable E2E Department',
      })
      .expect(201);

    departmentIds.push(response.body.id as string);
    return response;
  }

  async function createCourse(token: string, departmentId: string) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        departmentId,
        code: `TT-${randomUUID().slice(0, 8)}`,
        title: 'Timetable E2E Course',
        creditValue: 3,
      })
      .expect(201);

    courseIds.push(response.body.id as string);
    return response;
  }

  async function createSemester() {
    const [semester] = await database.db
      .insert(semesters)
      .values({
        academicYear: `TT-${randomUUID().slice(0, 8)}`,
        term: 'fall',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
      })
      .returning();

    if (!semester) throw new Error('Failed to create E2E semester');
    semesterIds.push(semester.id);
    return semester;
  }

  async function createInstructor(userId: string, departmentId: string) {
    const [instructor] = await database.db
      .insert(instructors)
      .values({
        userId,
        departmentId,
        employeeNumber: `TT-${randomUUID().slice(0, 8)}`,
        firstName: 'Timetable',
        lastName: 'Instructor',
      })
      .returning();

    if (!instructor) throw new Error('Failed to create E2E instructor');
    instructorIds.push(instructor.id);
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
        sectionCode: `TT-${randomUUID().slice(0, 6)}`,
      })
      .expect(201);

    offeringIds.push(response.body.id as string);
    return response;
  }

  async function setup() {
    const admin = await createAccount('admin');
    const department = await createDepartment(admin.token);
    const course = await createCourse(
      admin.token,
      department.body.id as string,
    );
    const semester = await createSemester();
    const instructor = await createInstructor(
      admin.id,
      department.body.id as string,
    );
    const offering = await createOffering(
      admin.token,
      course.body.id as string,
      semester.id,
      instructor.id,
    );

    return { admin, department, course, semester, instructor, offering };
  }

  async function createSlot(
    token: string,
    courseOfferingId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseOfferingId,
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room A',
        ...overrides,
      })
      .expect(201);

    slotIds.push(response.body.id as string);
    return response;
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/timetable').expect(401);
    await request(app.getHttpServer()).post('/timetable').send({}).expect(401);
  });

  it('forbids students from managing the timetable', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .get('/timetable')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);
  });

  it('allows an admin to create, list, retrieve, update, and delete a slot', async () => {
    const { admin, offering } = await setup();
    const created = await createSlot(admin.token, offering.body.id as string);

    expect(created.body).toMatchObject({
      courseOfferingId: offering.body.id,
      dayOfWeek: 'monday',
      startTime: '09:00:00',
      endTime: '10:00:00',
      room: 'Room A',
    });

    await request(app.getHttpServer())
      .get('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: created.body.id }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get(`/timetable/${created.body.id as string}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/timetable/${created.body.id as string}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ room: 'Room B' })
      .expect(200)
      .expect(({ body }) => expect(body.room).toBe('Room B'));

    await request(app.getHttpServer())
      .delete(`/timetable/${created.body.id as string}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ id: created.body.id }));

    slotIds = slotIds.filter((id) => id !== created.body.id);
  });

  it('rejects overlapping slots for the same instructor', async () => {
    const { admin, offering, course, semester, instructor } = await setup();
    await createSlot(admin.token, offering.body.id as string);

    const secondOffering = await createOffering(
      admin.token,
      course.body.id as string,
      semester.id,
      instructor.id,
    );

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseOfferingId: secondOffering.body.id,
        dayOfWeek: 'monday',
        startTime: '09:30',
        endTime: '10:30',
        room: 'Room B',
      })
      .expect(409);
  });

  it('rejects overlapping bookings for the same room across different instructors', async () => {
    const { admin, department, offering, course, semester } = await setup();
    await createSlot(admin.token, offering.body.id as string);

    const secondAdmin = await createAccount('admin');
    const secondInstructor = await createInstructor(
      secondAdmin.id,
      department.body.id as string,
    );
    const secondOffering = await createOffering(
      admin.token,
      course.body.id as string,
      semester.id,
      secondInstructor.id,
    );

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseOfferingId: secondOffering.body.id,
        dayOfWeek: 'monday',
        startTime: '09:30',
        endTime: '10:30',
        room: 'Room A',
      })
      .expect(409);
  });

  it('allows back-to-back slots for the same instructor', async () => {
    const { admin, offering, course, semester, instructor } = await setup();
    await createSlot(admin.token, offering.body.id as string);

    const secondOffering = await createOffering(
      admin.token,
      course.body.id as string,
      semester.id,
      instructor.id,
    );

    await createSlot(admin.token, secondOffering.body.id as string, {
      startTime: '10:00',
      endTime: '11:00',
      room: 'Room B',
    });
  });

  it('rejects invalid payloads and malformed IDs', async () => {
    const { admin, offering } = await setup();
    const payload = {
      courseOfferingId: offering.body.id,
      dayOfWeek: 'monday',
      startTime: '09:00',
      endTime: '10:00',
    };

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, dayOfWeek: 'funday' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, startTime: '9 AM' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, endTime: '08:00' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...payload, unexpected: true })
      .expect(400);

    const created = await createSlot(admin.token, offering.body.id as string);

    await request(app.getHttpServer())
      .patch(`/timetable/${created.body.id as string}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .get('/timetable/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('rejects nonexistent offerings and returns 404 for missing slots', async () => {
    const { admin } = await setup();
    const missingId = randomUUID();

    await request(app.getHttpServer())
      .post('/timetable')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseOfferingId: randomUUID(),
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/timetable/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/timetable/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ room: 'Room X' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/timetable/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('rejects updates that create overlapping slots for the same instructor', async () => {
    const { admin, offering, course, semester, instructor } = await setup();

    await createSlot(admin.token, offering.body.id as string);

    const secondOffering = await createOffering(
      admin.token,
      course.body.id as string,
      semester.id,
      instructor.id,
    );

    const secondSlot = await createSlot(
      admin.token,
      secondOffering.body.id as string,
      {
        startTime: '10:00',
        endTime: '11:00',
        room: 'Room B',
      },
    );

    await request(app.getHttpServer())
      .patch(`/timetable/${secondSlot.body.id as string}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        startTime: '09:30',
        endTime: '10:30',
      })
      .expect(409);
  });
});
