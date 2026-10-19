import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  assignmentSubmissions,
  assignments,
  assessments,
  courseOfferings,
  enrollments,
  grades,
  instructors,
  students,
} from '../../database/schema.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto.js';
import { ReviewSubmissionDto } from './dto/review-submission.dto.js';

@Injectable()
export class AssignmentsService {
  constructor(private readonly database: DatabaseService) {}

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes('admin');
  }

  private async findInstructorId(userId: string): Promise<string> {
    const [instructor] = await this.database.db
      .select({ id: instructors.id })
      .from(instructors)
      .where(eq(instructors.userId, userId))
      .limit(1);

    if (!instructor) {
      throw new ForbiddenException('An instructor profile is required');
    }

    return instructor.id;
  }

  private async findStudentId(userId: string): Promise<string> {
    const [student] = await this.database.db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.userId, userId), isNull(students.deletedAt)))
      .limit(1);

    if (!student) {
      throw new ForbiddenException('An active student profile is required');
    }

    return student.id;
  }

  private async findAssignment(id: string) {
    const [result] = await this.database.db
      .select({
        assignment: assignments,
        assessment: assessments,
        courseOffering: courseOfferings,
      })
      .from(assignments)
      .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
      .innerJoin(
        courseOfferings,
        eq(assessments.courseOfferingId, courseOfferings.id),
      )
      .where(eq(assignments.id, id))
      .limit(1);

    if (!result) {
      throw new NotFoundException(`Assignment with ID "${id}" not found`);
    }

    return result;
  }

  private async assertCanManage(
    user: AuthenticatedUser,
    instructorId: string,
  ): Promise<void> {
    if (this.isAdmin(user)) return;

    if (!user.roles.includes('instructor')) {
      throw new ForbiddenException(
        'Only administrators and instructors can manage assignments',
      );
    }

    const profileId = await this.findInstructorId(user.sub);

    if (profileId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage assignments for your own course offerings',
      );
    }
  }

  async create(dto: CreateAssignmentDto, user: AuthenticatedUser) {
    const instructions = dto.instructions.trim();

    if (!instructions) {
      throw new BadRequestException('Assignment instructions cannot be empty');
    }

    const dueAt = new Date(dto.dueAt);

    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('The due date is invalid');
    }

    if (!this.isAdmin(user) && !user.roles.includes('instructor')) {
      throw new ForbiddenException(
        'Only administrators and instructors can create assignments',
      );
    }

    const [assessment] = await this.database.db
      .select({
        id: assessments.id,
        type: assessments.type,
        instructorId: courseOfferings.instructorId,
      })
      .from(assessments)
      .innerJoin(
        courseOfferings,
        eq(assessments.courseOfferingId, courseOfferings.id),
      )
      .where(eq(assessments.id, dto.assessmentId))
      .limit(1);

    if (!assessment) {
      throw new NotFoundException(
        `Assessment with ID "${dto.assessmentId}" not found`,
      );
    }

    if (assessment.type !== 'assignment') {
      throw new BadRequestException(
        'Assignment details can only be added to assignment-type assessments',
      );
    }

    await this.assertCanManage(user, assessment.instructorId);

    try {
      const [assignment] = await this.database.db
        .insert(assignments)
        .values({
          assessmentId: assessment.id,
          instructions,
          dueAt,
          allowLateSubmissions: dto.allowLateSubmissions,
        })
        .returning();

      return assignment;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'This assessment already has assignment details',
        );
      }

      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    if (this.isAdmin(user)) {
      return this.database.db
        .select({
          assignment: assignments,
          assessment: assessments,
          courseOffering: courseOfferings,
        })
        .from(assignments)
        .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
        .innerJoin(
          courseOfferings,
          eq(assessments.courseOfferingId, courseOfferings.id),
        );
    }

    if (user.roles.includes('instructor')) {
      const instructorId = await this.findInstructorId(user.sub);

      return this.database.db
        .select({
          assignment: assignments,
          assessment: assessments,
          courseOffering: courseOfferings,
        })
        .from(assignments)
        .innerJoin(assessments, eq(assignments.assessmentId, assessments.id))
        .innerJoin(
          courseOfferings,
          eq(assessments.courseOfferingId, courseOfferings.id),
        )
        .where(eq(courseOfferings.instructorId, instructorId));
    }

    if (user.roles.includes('student')) {
      const studentId = await this.findStudentId(user.sub);

      return this.database.db
        .select({
          assignment: assignments,
          assessment: assessments,
          courseOffering: courseOfferings,
          enrollmentStatus: enrollments.status,
        })
        .from(enrollments)
        .innerJoin(
          courseOfferings,
          eq(enrollments.courseOfferingId, courseOfferings.id),
        )
        .innerJoin(
          assessments,
          eq(assessments.courseOfferingId, courseOfferings.id),
        )
        .innerJoin(assignments, eq(assignments.assessmentId, assessments.id))
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'enrolled'),
          ),
        );
    }

    throw new ForbiddenException('You cannot access assignments');
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const result = await this.findAssignment(id);

    if (this.isAdmin(user)) return result;

    if (user.roles.includes('instructor')) {
      await this.assertCanManage(user, result.courseOffering.instructorId);
      return result;
    }

    if (user.roles.includes('student')) {
      const studentId = await this.findStudentId(user.sub);

      const [enrollment] = await this.database.db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.courseOfferingId, result.courseOffering.id),
            eq(enrollments.status, 'enrolled'),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new ForbiddenException(
          'You are not enrolled in this assignment course',
        );
      }

      return result;
    }

    throw new ForbiddenException('You cannot access this assignment');
  }

  async submit(
    assignmentId: string,
    dto: SubmitAssignmentDto,
    user: AuthenticatedUser,
  ) {
    if (!user.roles.includes('student')) {
      throw new ForbiddenException('Only students can submit assignments');
    }

    const studentId = await this.findStudentId(user.sub);
    const content = dto.content?.trim() || null;
    const submissionUrl = dto.submissionUrl?.trim() || null;

    if (!content && !submissionUrl) {
      throw new BadRequestException(
        'Provide non-empty submission content or a submission URL',
      );
    }

    const result = await this.findAssignment(assignmentId);

    const [enrollment] = await this.database.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseOfferingId, result.courseOffering.id),
          eq(enrollments.status, 'enrolled'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new ForbiddenException(
        'You must be enrolled in this course to submit its assignment',
      );
    }

    const now = new Date();

    if (
      now > result.assignment.dueAt &&
      !result.assignment.allowLateSubmissions
    ) {
      throw new BadRequestException(
        'The assignment deadline has passed and late submissions are disabled',
      );
    }

    return this.database.db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          enrollmentId: enrollment.id,
          content,
          submissionUrl,
          submittedAt: now,
          feedback: null,
          reviewedAt: null,
        })
        .onConflictDoUpdate({
          target: [
            assignmentSubmissions.assignmentId,
            assignmentSubmissions.enrollmentId,
          ],
          set: {
            content,
            submissionUrl,
            submittedAt: now,
            feedback: null,
            reviewedAt: null,
            updatedAt: now,
          },
        })
        .returning();

      await tx
        .update(grades)
        .set({
          score: null,
          gradedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(grades.enrollmentId, enrollment.id),
            eq(grades.assessmentId, result.assessment.id),
          ),
        );

      return submission;
    });
  }

  async findMySubmission(assignmentId: string, user: AuthenticatedUser) {
    if (!user.roles.includes('student')) {
      throw new ForbiddenException(
        'Only students can view their own submissions here',
      );
    }

    const studentId = await this.findStudentId(user.sub);
    const result = await this.findAssignment(assignmentId);

    const [enrollment] = await this.database.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseOfferingId, result.courseOffering.id),
          eq(enrollments.status, 'enrolled'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new ForbiddenException(
        'You are not enrolled in this assignment course',
      );
    }

    const [submission] = await this.database.db
      .select({
        submission: assignmentSubmissions,
        grade: grades,
      })
      .from(assignmentSubmissions)
      .leftJoin(
        grades,
        and(
          eq(grades.enrollmentId, assignmentSubmissions.enrollmentId),
          eq(grades.assessmentId, result.assessment.id),
        ),
      )
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.enrollmentId, enrollment.id),
        ),
      )
      .limit(1);

    if (!submission) return null;

    return {
      ...submission,
      grade: submission.submission.reviewedAt ? submission.grade : null,
    };
  }

  async review(
    assignmentId: string,
    submissionId: string,
    dto: ReviewSubmissionDto,
    user: AuthenticatedUser,
  ) {
    const result = await this.findAssignment(assignmentId);

    await this.assertCanManage(user, result.courseOffering.instructorId);

    const maxAssessmentScore = Number(result.assessment.maxScore);
    const maxSupportedGrade = 999.99;

    if (dto.score > maxAssessmentScore) {
      throw new BadRequestException(
        `Score cannot exceed the assessment maximum of ${result.assessment.maxScore}`,
      );
    }

    if (dto.score > maxSupportedGrade) {
      throw new BadRequestException(
        `Score cannot exceed the maximum supported grade value of ${maxSupportedGrade}`,
      );
    }

    const feedback = dto.feedback?.trim() || null;
    const now = new Date();

    return this.database.db.transaction(async (tx) => {
      const [submission] = await tx
        .select()
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.id, submissionId),
            eq(assignmentSubmissions.assignmentId, assignmentId),
          ),
        )
        .limit(1);

      if (!submission) {
        throw new NotFoundException(
          `Submission with ID "${submissionId}" not found for this assignment`,
        );
      }

      const [enrollment] = await tx
        .select({
          id: enrollments.id,
          courseOfferingId: enrollments.courseOfferingId,
        })
        .from(enrollments)
        .where(eq(enrollments.id, submission.enrollmentId))
        .limit(1);

      if (
        !enrollment ||
        enrollment.courseOfferingId !== result.courseOffering.id
      ) {
        throw new BadRequestException(
          'The submission does not belong to this assignment course',
        );
      }

      const [updatedSubmission] = await tx
        .update(assignmentSubmissions)
        .set({
          feedback,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(assignmentSubmissions.id, submissionId))
        .returning();

      const [grade] = await tx
        .insert(grades)
        .values({
          enrollmentId: submission.enrollmentId,
          assessmentId: result.assessment.id,
          score: dto.score.toFixed(2),
          gradedAt: now,
        })
        .onConflictDoUpdate({
          target: [grades.enrollmentId, grades.assessmentId],
          set: {
            score: dto.score.toFixed(2),
            gradedAt: now,
            updatedAt: now,
          },
        })
        .returning();

      return {
        submission: updatedSubmission,
        grade,
      };
    });
  }
}
