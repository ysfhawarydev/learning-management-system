import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
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
  assessments,
  grades,
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
  let createdEnrollmentIds: string[];
  let createdOfferingIds: string[];
  let createdCourseIds: string[];
  let createdInstructorIds: string[];
  let createdSemesterIds: string[];
  let createdAttendanceIds: string[];
  let createdAssessmentIds: string[];
  let createdGradeIds: string[];

  beforeEach(async () => {
    createdEmails = [];
    createdEnrollmentIds = [];
    createdOfferingIds = [];
    createdCourseIds = [];
    createdInstructorIds = [];
    createdSemesterIds = [];
    createdAttendanceIds = [];
    createdAssessmentIds = [];
    createdGradeIds = [];

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
      for (const id of createdAttendanceIds) {
        await database.db.delete(attendance).where(eq(attendance.id, id));
      }

      for (const id of createdGradeIds) {
        await database.db.delete(grades).where(eq(grades.id, id));
      }

      for (const id of createdAssessmentIds) {
        await database.db.delete(assessments).where(eq(assessments.id, id));
      }
      // Delete academic records before their referenced records.
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

    const [role] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new Error(`Required role "${roleName}" was not found`);
    }

    const passwordHash = await argon2.hash(password);

    const [user] = await database.db
      .insert(users)
      .values({
        email,
        passwordHash,
        status: 'active',
      })
      .returning({ id: users.id });

    if (!user) {
      throw new Error(`Failed to create test user "${email}"`);
    }

    await database.db.insert(userRoles).values({
      userId: user.id,
      roleId: role.id,
    });

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

  // Keep this helper synchronous so Supertest's .expect() can be chained
  // before the request is awaited.
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

  async function createMyCoursesFixture() {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const studentResponse = await createStudent(
      admin.token,
      studentUser.id,
    ).expect(201);

    const [semester] = await database.db
      .insert(semesters)
      .values({
        academicYear: `E2E-${randomUUID().slice(0, 8)}`,
        term: 'fall',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
      })
      .returning();

    if (!semester) {
      throw new Error('Failed to create E2E semester');
    }

    createdSemesterIds.push(semester.id);

    const [instructor] = await database.db
      .insert(instructors)
      .values({
        userId: admin.id,
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

    const [course] = await database.db
      .insert(courses)
      .values({
        departmentId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        title: 'E2E Student Course',
        description: 'Course used to test student-specific access',
        creditValue: 3,
      })
      .returning();

    if (!course) {
      throw new Error('Failed to create E2E course');
    }

    createdCourseIds.push(course.id);

    const [offering] = await database.db
      .insert(courseOfferings)
      .values({
        courseId: course.id,
        semesterId: semester.id,
        instructorId: instructor.id,
        sectionCode: 'A',
        capacity: 30,
      })
      .returning();

    if (!offering) {
      throw new Error('Failed to create E2E offering');
    }

    createdOfferingIds.push(offering.id);

    return {
      admin,
      studentUser,
      studentId: studentResponse.body.id as string,
      course,
      offering,
      semesterId: semester.id,
      instructorId: instructor.id,
    };
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

  it('allows a student to update their own profile', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    const created = await createStudent(admin.token, studentUser.id).expect(
      201,
    );

    const response = await request(app.getHttpServer())
      .patch('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({
        firstName: 'Updated',
        lastName: 'Student',
        phone: '01234567890',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      userId: studentUser.id,
      firstName: 'Updated',
      lastName: 'Student',
      phone: '01234567890',
    });

    await request(app.getHttpServer())
      .patch('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({ status: 'graduated' })
      .expect(400);

    const profile = await request(app.getHttpServer())
      .get('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(200);

    expect(profile.body.status).toBe(created.body.status);
  });

  it('rejects whitespace-only names when updating a student profile', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    await createStudent(admin.token, studentUser.id).expect(201);

    await request(app.getHttpServer())
      .patch('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({ firstName: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({ lastName: '   ' })
      .expect(400);
  });

  it('returns 404 when a student has no profile yet', async () => {
    const student = await createAccount('student');

    const response = await request(app.getHttpServer())
      .get('/students/me')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(404);

    expect(response.body.message).toBe('Student profile not found');
  });

  it('returns 404 when updating a profile that does not exist', async () => {
    const student = await createAccount('student');

    const response = await request(app.getHttpServer())
      .patch('/students/me')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ firstName: 'Updated' })
      .expect(404);

    expect(response.body.message).toBe('Student profile not found');
  });

  it('rejects an empty self-profile update', async () => {
    const admin = await createAccount('admin');
    const studentUser = await createAccount('student');

    await createStudent(admin.token, studentUser.id).expect(201);

    await request(app.getHttpServer())
      .patch('/students/me')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({})
      .expect(400);
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

  it('allows a student to retrieve only their own courses', async () => {
    const fixture = await createMyCoursesFixture();

    const otherStudentUser = await createAccount('student');
    const otherStudentResponse = await createStudent(
      fixture.admin.token,
      otherStudentUser.id,
    ).expect(201);

    const [ownEnrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: fixture.studentId,
        courseOfferingId: fixture.offering.id,
        status: 'enrolled',
      })
      .returning();

    if (!ownEnrollment) {
      throw new Error('Failed to create own enrollment');
    }

    createdEnrollmentIds.push(ownEnrollment.id);

    const [otherEnrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: otherStudentResponse.body.id as string,
        courseOfferingId: fixture.offering.id,
        status: 'enrolled',
      })
      .returning();

    if (!otherEnrollment) {
      throw new Error('Failed to create other student enrollment');
    }

    createdEnrollmentIds.push(otherEnrollment.id);

    const response = await request(app.getHttpServer())
      .get('/students/me/courses')
      .set('Authorization', `Bearer ${fixture.studentUser.token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      enrollmentId: ownEnrollment.id,
      enrollmentStatus: 'enrolled',
      courseId: fixture.course.id,
      courseCode: fixture.course.code,
      courseTitle: fixture.course.title,
      courseOfferingId: fixture.offering.id,
    });

    expect(response.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enrollmentId: otherEnrollment.id,
        }),
      ]),
    );
  });

  it('excludes dropped and withdrawn enrollments but includes completed courses', async () => {
    const fixture = await createMyCoursesFixture();

    const statuses = ['enrolled', 'completed', 'dropped', 'withdrawn'] as const;

    const offeringIds: string[] = [fixture.offering.id];

    // Each enrollment needs a distinct offering due to the unique constraint
    // on (studentId, courseOfferingId).
    for (const sectionCode of ['B', 'C', 'D']) {
      const [offering] = await database.db
        .insert(courseOfferings)
        .values({
          courseId: fixture.course.id,
          semesterId: fixture.semesterId,
          instructorId: fixture.instructorId,
          sectionCode,
          capacity: 30,
        })
        .returning({ id: courseOfferings.id });

      if (!offering) {
        throw new Error(`Failed to create offering for section ${sectionCode}`);
      }

      createdOfferingIds.push(offering.id);
      offeringIds.push(offering.id);
    }

    const enrollmentIds: Record<(typeof statuses)[number], string> = {
      enrolled: '',
      completed: '',
      dropped: '',
      withdrawn: '',
    };

    for (const [index, status] of statuses.entries()) {
      const [enrollment] = await database.db
        .insert(enrollments)
        .values({
          studentId: fixture.studentId,
          courseOfferingId: offeringIds[index],
          status,
        })
        .returning({ id: enrollments.id });

      if (!enrollment) {
        throw new Error(`Failed to create ${status} enrollment`);
      }

      createdEnrollmentIds.push(enrollment.id);
      enrollmentIds[status] = enrollment.id;
    }

    const response = await request(app.getHttpServer())
      .get('/students/me/courses')
      .set('Authorization', `Bearer ${fixture.studentUser.token}`)
      .expect(200);

    const returnedEnrollmentIds = response.body.map(
      (item: { enrollmentId: string }) => item.enrollmentId,
    );

    expect(returnedEnrollmentIds).toContain(enrollmentIds.enrolled);
    expect(returnedEnrollmentIds).toContain(enrollmentIds.completed);
    expect(returnedEnrollmentIds).not.toContain(enrollmentIds.dropped);
    expect(returnedEnrollmentIds).not.toContain(enrollmentIds.withdrawn);
  });

  it('allows a student to retrieve only their own grades and ungraded assessments', async () => {
    const fixture = await createMyCoursesFixture();

    const otherStudentUser = await createAccount('student');
    const otherStudentResponse = await createStudent(
      fixture.admin.token,
      otherStudentUser.id,
    ).expect(201);

    const [ownEnrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: fixture.studentId,
        courseOfferingId: fixture.offering.id,
        status: 'enrolled',
      })
      .returning();

    if (!ownEnrollment) {
      throw new Error('Failed to create own enrollment');
    }

    createdEnrollmentIds.push(ownEnrollment.id);

    const [otherEnrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: otherStudentResponse.body.id as string,
        courseOfferingId: fixture.offering.id,
        status: 'enrolled',
      })
      .returning();

    if (!otherEnrollment) {
      throw new Error('Failed to create other student enrollment');
    }

    createdEnrollmentIds.push(otherEnrollment.id);

    const [gradedAssessment] = await database.db
      .insert(assessments)
      .values({
        courseOfferingId: fixture.offering.id,
        name: 'E2E Assignment',
        type: 'assignment',
        maxScore: '100',
        weight: '60',
      })
      .returning();

    if (!gradedAssessment) {
      throw new Error('Failed to create graded assessment');
    }

    createdAssessmentIds.push(gradedAssessment.id);

    const [ungradedAssessment] = await database.db
      .insert(assessments)
      .values({
        courseOfferingId: fixture.offering.id,
        name: 'E2E Quiz',
        type: 'quiz',
        maxScore: '20',
        weight: '40',
      })
      .returning();

    if (!ungradedAssessment) {
      throw new Error('Failed to create ungraded assessment');
    }

    createdAssessmentIds.push(ungradedAssessment.id);

    const [ownGrade] = await database.db
      .insert(grades)
      .values({
        enrollmentId: ownEnrollment.id,
        assessmentId: gradedAssessment.id,
        score: '87.50',
        gradedAt: new Date(),
      })
      .returning();

    if (!ownGrade) {
      throw new Error('Failed to create own grade');
    }

    createdGradeIds.push(ownGrade.id);

    const [otherGrade] = await database.db
      .insert(grades)
      .values({
        enrollmentId: otherEnrollment.id,
        assessmentId: gradedAssessment.id,
        score: '42.00',
        gradedAt: new Date(),
      })
      .returning();

    if (!otherGrade) {
      throw new Error('Failed to create other student grade');
    }

    createdGradeIds.push(otherGrade.id);

    const response = await request(app.getHttpServer())
      .get('/students/me/grades')
      .set('Authorization', `Bearer ${fixture.studentUser.token}`)
      .expect(200);

    expect(response.body).toHaveLength(2);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enrollmentId: ownEnrollment.id,
          assessmentId: gradedAssessment.id,
          assessmentName: 'E2E Assignment',
          maxScore: '100.00',
          weight: '60.00',
          gradeId: ownGrade.id,
          score: '87.50',
        }),
        expect.objectContaining({
          enrollmentId: ownEnrollment.id,
          assessmentId: ungradedAssessment.id,
          assessmentName: 'E2E Quiz',
          gradeId: null,
          score: null,
          gradedAt: null,
        }),
      ]),
    );

    expect(
      response.body.some(
        (item: { gradeId: string | null }) => item.gradeId === otherGrade.id,
      ),
    ).toBe(false);

    expect(
      response.body.every(
        (item: { enrollmentId: string }) =>
          item.enrollmentId === ownEnrollment.id,
      ),
    ).toBe(true);
  });

  it('returns 404 when retrieving grades without a student profile', async () => {
    const student = await createAccount('student');

    const response = await request(app.getHttpServer())
      .get('/students/me/grades')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(404);

    expect(response.body.message).toBe('Student profile not found');
  });

  it('returns 404 when retrieving courses without a student profile', async () => {
    const student = await createAccount('student');

    const response = await request(app.getHttpServer())
      .get('/students/me/courses')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(404);

    expect(response.body.message).toBe('Student profile not found');
  });

  it('allows a student to retrieve only their own attendance records', async () => {
    const fixture = await createMyCoursesFixture();

    const otherStudentUser = await createAccount('student');
    const otherStudentResponse = await createStudent(
      fixture.admin.token,
      otherStudentUser.id,
    ).expect(201);

    const [ownEnrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: fixture.studentId,
        courseOfferingId: fixture.offering.id,
        status: 'enrolled',
      })
      .returning();

    if (!ownEnrollment) {
      throw new Error('Failed to create own enrollment');
    }

    createdEnrollmentIds.push(ownEnrollment.id);

    const [otherEnrollment] = await database.db
      .insert(enrollments)
      .values({
        studentId: otherStudentResponse.body.id as string,
        courseOfferingId: fixture.offering.id,
        status: 'enrolled',
      })
      .returning();

    if (!otherEnrollment) {
      throw new Error('Failed to create other student enrollment');
    }

    createdEnrollmentIds.push(otherEnrollment.id);

    const [ownRecord] = await database.db
      .insert(attendance)
      .values({
        enrollmentId: ownEnrollment.id,
        sessionDate: '2026-10-12',
        status: 'present',
      })
      .returning();

    if (!ownRecord) {
      throw new Error('Failed to create own attendance record');
    }

    createdAttendanceIds.push(ownRecord.id);

    const [otherRecord] = await database.db
      .insert(attendance)
      .values({
        enrollmentId: otherEnrollment.id,
        sessionDate: '2026-10-12',
        status: 'absent',
      })
      .returning();

    if (!otherRecord) {
      throw new Error('Failed to create other attendance record');
    }

    createdAttendanceIds.push(otherRecord.id);

    const response = await request(app.getHttpServer())
      .get('/students/me/attendance')
      .set('Authorization', `Bearer ${fixture.studentUser.token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: ownRecord.id,
      enrollmentId: ownEnrollment.id,
      sessionDate: '2026-10-12',
      status: 'present',
      courseId: fixture.course.id,
      courseCode: fixture.course.code,
      courseTitle: fixture.course.title,
      courseOfferingId: fixture.offering.id,
      sectionCode: fixture.offering.sectionCode,
      semesterId: fixture.semesterId,
    });

    expect(response.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherRecord.id })]),
    );

    // Attendance notes should never be exposed by the student endpoint.
    expect(response.body[0]).not.toHaveProperty('notes');
  });

  it('returns 404 when retrieving attendance without a student profile', async () => {
    const student = await createAccount('student');

    const response = await request(app.getHttpServer())
      .get('/students/me/attendance')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(404);

    expect(response.body.message).toBe('Student profile not found');
  });

  it('rejects unauthenticated access to student attendance', async () => {
    await request(app.getHttpServer())
      .get('/students/me/attendance')
      .expect(401);
  });
});
