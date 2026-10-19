import { randomUUID } from 'node:crypto';

import argon2 from 'argon2';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  assessments,
  assignmentSubmissions,
  assignments,
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

describe('Assignments (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;

  let createdEmails: string[];
  let createdDepartmentIds: string[];
  let createdStudentIds: string[];
  let createdInstructorIds: string[];
  let createdSemesterIds: string[];
  let createdCourseIds: string[];
  let createdOfferingIds: string[];
  let createdEnrollmentIds: string[];
  let createdAssessmentIds: string[];
  let createdAssignmentIds: string[];

  const password = 'StrongPassword123!';

  beforeEach(async () => {
    createdEmails = [];
    createdDepartmentIds = [];
    createdStudentIds = [];
    createdInstructorIds = [];
    createdSemesterIds = [];
    createdCourseIds = [];
    createdOfferingIds = [];
    createdEnrollmentIds = [];
    createdAssessmentIds = [];
    createdAssignmentIds = [];

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
      if (createdAssignmentIds.length > 0) {
        await database.db
          .delete(assignmentSubmissions)
          .where(
            inArray(assignmentSubmissions.assignmentId, createdAssignmentIds),
          );

        await database.db
          .delete(assignments)
          .where(inArray(assignments.id, createdAssignmentIds));
      }

      if (createdAssessmentIds.length > 0) {
        await database.db
          .delete(grades)
          .where(inArray(grades.assessmentId, createdAssessmentIds));

        await database.db
          .delete(assessments)
          .where(inArray(assessments.id, createdAssessmentIds));
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

        await database.db.delete(students).where(eq(students.userId, user.id));

        await database.db
          .delete(instructors)
          .where(eq(instructors.userId, user.id));

        await database.db
          .delete(userRoles)
          .where(eq(userRoles.userId, user.id));

        await database.db.delete(users).where(eq(users.id, user.id));
      }
    } finally {
      await app.close();
    }
  });

  async function createAccount(roleName: 'admin' | 'instructor' | 'student') {
    const email = `assignments-${randomUUID()}@example.com`;
    createdEmails.push(email);

    const passwordHash = await argon2.hash(password);

    const [user] = await database.db
      .insert(users)
      .values({
        email,
        passwordHash,
        status: 'active',
      })
      .returning({ id: users.id });

    if (!user) throw new Error('Failed to create E2E user');

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new Error(`Required role "${roleName}" was not found`);
    }

    await database.db.insert(userRoles).values({
      userId: user.id,
      roleId: role.id,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      id: user.id,
      token: response.body.accessToken as string,
    };
  }

  async function createDepartment(adminToken: string) {
    const response = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'E2E Assignment Department',
      })
      .expect(201);

    createdDepartmentIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createCourse(adminToken: string, departmentId: string) {
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        title: 'E2E Assignment Course',
        creditValue: 3,
      })
      .expect(201);

    createdCourseIds.push(response.body.id as string);

    return response.body as { id: string };
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

    if (!instructor) {
      throw new Error('Failed to create E2E instructor');
    }

    createdInstructorIds.push(instructor.id);

    return instructor;
  }

  async function createOffering(
    adminToken: string,
    courseId: string,
    semesterId: string,
    instructorId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/course-offerings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courseId,
        semesterId,
        instructorId,
        sectionCode: `A-${randomUUID().slice(0, 6)}`,
      })
      .expect(201);

    createdOfferingIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createStudent(adminToken: string, departmentId: string) {
    const account = await createAccount('student');

    const response = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${adminToken}`)
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

    return {
      account,
      student: response.body as { id: string },
    };
  }

  async function createEnrollment(
    adminToken: string,
    studentId: string,
    courseOfferingId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId, courseOfferingId })
      .expect(201);

    createdEnrollmentIds.push(response.body.id as string);

    return response.body as { id: string };
  }

  async function createAssessment(
    adminToken: string,
    courseOfferingId: string,
    type: 'assignment' | 'quiz' | 'midterm' = 'assignment',
  ) {
    const response = await request(app.getHttpServer())
      .post('/assessments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        courseOfferingId,
        name: `E2E ${type} ${randomUUID().slice(0, 6)}`,
        type,
        maxScore: 100,
        weight: 20,
      })
      .expect(201);

    createdAssessmentIds.push(response.body.id as string);

    return response.body as { id: string; type: string };
  }

  async function createAssignment(
    token: string,
    assessmentId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assessmentId,
        instructions: 'Complete the assignment and explain your solution.',
        dueAt: '2026-12-01T23:59:00.000Z',
        allowLateSubmissions: false,
        ...overrides,
      })
      .expect(201);

    createdAssignmentIds.push(response.body.id as string);

    return response;
  }

  async function setupDependencies() {
    const admin = await createAccount('admin');
    const instructorAccount = await createAccount('instructor');
    const department = await createDepartment(admin.token);
    const course = await createCourse(admin.token, department.id);
    const semester = await createSemester();
    const instructor = await createInstructor(
      instructorAccount.id,
      department.id,
    );
    const offering = await createOffering(
      admin.token,
      course.id,
      semester.id,
      instructor.id,
    );

    return {
      admin,
      instructorAccount,
      department,
      course,
      semester,
      instructor,
      offering,
    };
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/assignments').expect(401);

    await request(app.getHttpServer())
      .post('/assignments')
      .send({})
      .expect(401);
  });

  it('forbids students from creating or reviewing assignments', async () => {
    const student = await createAccount('student');

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/assignments/${randomUUID()}/submissions/${randomUUID()}/review`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ score: 90 })
      .expect(403);
  });

  it('allows an admin to create and retrieve an assignment', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);

    const created = await createAssignment(admin.token, assessment.id);

    expect(created.body).toMatchObject({
      assessmentId: assessment.id,
      instructions: 'Complete the assignment and explain your solution.',
      allowLateSubmissions: false,
    });

    await request(app.getHttpServer())
      .get('/assignments')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              assignment: expect.objectContaining({
                id: created.body.id,
              }),
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get(`/assignments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.assignment.id).toBe(created.body.id);
      });
  });

  it('allows the assigned instructor to create an assignment', async () => {
    const { instructorAccount, offering, admin } = await setupDependencies();

    const assessment = await createAssessment(admin.token, offering.id);

    const created = await createAssignment(
      instructorAccount.token,
      assessment.id,
    );

    expect(created.body.assessmentId).toBe(assessment.id);
  });

  it('rejects assignments for assessments that are not assignments', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id, 'quiz');

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        assessmentId: assessment.id,
        instructions: 'This must be rejected.',
        dueAt: '2026-12-01T23:59:00.000Z',
        allowLateSubmissions: false,
      })
      .expect(400);
  });

  it('rejects invalid payloads and malformed IDs', async () => {
    const { admin, offering } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        assessmentId: 'not-a-uuid',
        instructions: 'Valid instructions',
        dueAt: '2026-12-01T23:59:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        assessmentId: assessment.id,
        instructions: '   ',
        dueAt: 'not-a-date',
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/assignments/not-a-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('allows an enrolled student to submit and retrieve their submission', async () => {
    const { admin, offering, department } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);
    const assignment = await createAssignment(admin.token, assessment.id);
    const { account, student } = await createStudent(
      admin.token,
      department.id,
    );

    await createEnrollment(admin.token, student.id, offering.id);

    const submitted = await request(app.getHttpServer())
      .post(`/assignments/${assignment.body.id}/submissions`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ content: 'My completed assignment.' })
      .expect(201);

    expect(submitted.body).toMatchObject({
      assignmentId: assignment.body.id,
      content: 'My completed assignment.',
    });

    await request(app.getHttpServer())
      .get(`/assignments/${assignment.body.id}/my-submission`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.submission.id).toBe(submitted.body.id);
        expect(body.submission.content).toBe('My completed assignment.');
        expect(body.grade).toBeNull();
      });
  });

  it('does not expose assignments to students who are not enrolled', async () => {
    const { admin, offering, department } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);
    const assignment = await createAssignment(admin.token, assessment.id);
    const { account } = await createStudent(admin.token, department.id);

    await request(app.getHttpServer())
      .get(`/assignments/${assignment.body.id}`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(403);
  });

  it('rejects empty submissions', async () => {
    const { admin, offering, department } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);
    const assignment = await createAssignment(admin.token, assessment.id);
    const { account, student } = await createStudent(
      admin.token,
      department.id,
    );

    await createEnrollment(admin.token, student.id, offering.id);

    await request(app.getHttpServer())
      .post(`/assignments/${assignment.body.id}/submissions`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({})
      .expect(400);
  });

  it('allows an admin to review a submission and assign a grade', async () => {
    const { admin, offering, department } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);
    const assignment = await createAssignment(admin.token, assessment.id);
    const { account, student } = await createStudent(
      admin.token,
      department.id,
    );

    await createEnrollment(admin.token, student.id, offering.id);

    const submission = await request(app.getHttpServer())
      .post(`/assignments/${assignment.body.id}/submissions`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ content: 'Completed.' })
      .expect(201);

    const reviewed = await request(app.getHttpServer())
      .post(
        `/assignments/${assignment.body.id}/submissions/${submission.body.id}/review`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ score: 85, feedback: 'Good work.' })
      .expect(201);

    expect(reviewed.body.submission).toMatchObject({
      id: submission.body.id,
      feedback: 'Good work.',
    });

    expect(Number(reviewed.body.grade.score)).toBe(85);
    expect(reviewed.body.grade.assessmentId).toBe(assessment.id);

    await request(app.getHttpServer())
      .get(`/assignments/${assignment.body.id}/my-submission`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.submission.id).toBe(submission.body.id);
        expect(Number(body.grade.score)).toBe(85);
      });
  });

  it('rejects scores above the assessment maximum', async () => {
    const { admin, offering, department } = await setupDependencies();
    const assessment = await createAssessment(admin.token, offering.id);
    const assignment = await createAssignment(admin.token, assessment.id);
    const { account, student } = await createStudent(
      admin.token,
      department.id,
    );

    await createEnrollment(admin.token, student.id, offering.id);

    const submission = await request(app.getHttpServer())
      .post(`/assignments/${assignment.body.id}/submissions`)
      .set('Authorization', `Bearer ${account.token}`)
      .send({ content: 'Completed.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/assignments/${assignment.body.id}/submissions/${submission.body.id}/review`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ score: 101 })
      .expect(400);
  });
});
