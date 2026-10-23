import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  assessments,
  courseOfferings,
  enrollments,
  grades,
  instructors,
  quizAttempts,
  quizOptions,
  quizQuestions,
  students,
  users,
} from '../../database/schema.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import type { CreateQuizDto } from './dto/create-quiz.dto.js';
import type { SubmitQuizDto } from './dto/submit-quiz.dto.js';

function getPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);

    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}

@Injectable()
export class QuizzesService {
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

  private async assertCanManage(
    user: AuthenticatedUser,
    instructorId: string,
  ): Promise<void> {
    if (this.isAdmin(user)) return;

    if (!user.roles.includes('instructor')) {
      throw new ForbiddenException(
        'Only administrators and instructors can manage quizzes',
      );
    }

    const profileId = await this.findInstructorId(user.sub);

    if (profileId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage quizzes for your own course offerings',
      );
    }
  }

  async create(dto: CreateQuizDto, user: AuthenticatedUser) {
    if (!this.isAdmin(user) && !user.roles.includes('instructor')) {
      throw new ForbiddenException(
        'Only administrators and instructors can create quizzes',
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

    if (assessment.type !== 'quiz') {
      throw new BadRequestException(
        'Quiz questions can only be added to quiz-type assessments',
      );
    }

    await this.assertCanManage(user, assessment.instructorId);

    const [existingQuestion] = await this.database.db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.assessmentId, assessment.id))
      .limit(1);

    if (existingQuestion) {
      throw new ConflictException(
        'Questions already exist for this quiz; editing is not supported yet',
      );
    }

    const [existingAttempt] = await this.database.db
      .select({ id: quizAttempts.id })
      .from(quizAttempts)
      .where(eq(quizAttempts.assessmentId, assessment.id))
      .limit(1);

    if (existingAttempt) {
      throw new ConflictException(
        'A quiz cannot be modified after a student has submitted it',
      );
    }

    const questionPositions = dto.questions.map(
      (question) => question.position,
    );

    if (new Set(questionPositions).size !== questionPositions.length) {
      throw new BadRequestException(
        'Question positions must be unique within a quiz',
      );
    }

    for (const question of dto.questions) {
      if (!question.prompt.trim()) {
        throw new BadRequestException('Question prompts cannot be empty');
      }

      if (question.options.length < 2) {
        throw new BadRequestException(
          'Each question must have at least two options',
        );
      }

      const optionPositions = question.options.map((option) => option.position);

      if (new Set(optionPositions).size !== optionPositions.length) {
        throw new BadRequestException(
          'Option positions must be unique within each question',
        );
      }

      if (question.options.filter((option) => option.isCorrect).length !== 1) {
        throw new BadRequestException(
          'Each question must have exactly one correct option',
        );
      }

      if (question.options.some((option) => !option.text.trim())) {
        throw new BadRequestException('Option text cannot be empty');
      }
    }

    try {
      return await this.database.db.transaction(async (tx) => {
        const createdQuestions = [];

        for (const question of dto.questions) {
          const [createdQuestion] = await tx
            .insert(quizQuestions)
            .values({
              assessmentId: assessment.id,
              prompt: question.prompt.trim(),
              position: question.position,
            })
            .returning();

          const createdOptions = await tx
            .insert(quizOptions)
            .values(
              question.options.map((option) => ({
                questionId: createdQuestion.id,
                text: option.text.trim(),
                isCorrect: option.isCorrect,
                position: option.position,
              })),
            )
            .returning({
              id: quizOptions.id,
              text: quizOptions.text,
              position: quizOptions.position,
            });

          createdQuestions.push({
            ...createdQuestion,
            options: createdOptions,
          });
        }

        return {
          assessmentId: assessment.id,
          questions: createdQuestions,
        };
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'Quiz question or option positions must be unique',
        );
      }

      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    if (this.isAdmin(user)) {
      return this.database.db
        .select({
          assessment: assessments,
          courseOffering: courseOfferings,
        })
        .from(assessments)
        .innerJoin(
          courseOfferings,
          eq(assessments.courseOfferingId, courseOfferings.id),
        )
        .where(eq(assessments.type, 'quiz'));
    }

    if (user.roles.includes('instructor')) {
      const instructorId = await this.findInstructorId(user.sub);

      return this.database.db
        .select({
          assessment: assessments,
          courseOffering: courseOfferings,
        })
        .from(assessments)
        .innerJoin(
          courseOfferings,
          eq(assessments.courseOfferingId, courseOfferings.id),
        )
        .where(
          and(
            eq(assessments.type, 'quiz'),
            eq(courseOfferings.instructorId, instructorId),
          ),
        );
    }

    if (user.roles.includes('student')) {
      const studentId = await this.findStudentId(user.sub);

      return this.database.db
        .select({
          assessment: assessments,
          courseOffering: courseOfferings,
          enrollmentId: enrollments.id,
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
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'enrolled'),
            eq(assessments.type, 'quiz'),
          ),
        );
    }

    throw new ForbiddenException('You cannot access quizzes');
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const [result] = await this.database.db
      .select({
        assessment: assessments,
        instructorId: courseOfferings.instructorId,
      })
      .from(assessments)
      .innerJoin(
        courseOfferings,
        eq(assessments.courseOfferingId, courseOfferings.id),
      )
      .where(and(eq(assessments.id, id), eq(assessments.type, 'quiz')))
      .limit(1);

    if (!result) {
      throw new NotFoundException(`Quiz with ID "${id}" not found`);
    }

    if (this.isAdmin(user)) {
      return this.getQuizDetails(id, true);
    }

    if (user.roles.includes('instructor')) {
      await this.assertCanManage(user, result.instructorId);
      return this.getQuizDetails(id, true);
    }

    if (user.roles.includes('student')) {
      const studentId = await this.findStudentId(user.sub);

      const [enrollment] = await this.database.db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(
              enrollments.courseOfferingId,
              result.assessment.courseOfferingId,
            ),
            eq(enrollments.status, 'enrolled'),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new ForbiddenException(
          'You are not enrolled in this quiz course',
        );
      }

      return this.getQuizDetails(id, false);
    }

    throw new ForbiddenException('You cannot access this quiz');
  }

  private async getQuizDetails(assessmentId: string, includeAnswers: boolean) {
    const questions = await this.database.db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.assessmentId, assessmentId))
      .orderBy(quizQuestions.position);

    const result = [];

    for (const question of questions) {
      const options = await this.database.db
        .select({
          id: quizOptions.id,
          text: quizOptions.text,
          position: quizOptions.position,
          ...(includeAnswers ? { isCorrect: quizOptions.isCorrect } : {}),
        })
        .from(quizOptions)
        .where(eq(quizOptions.questionId, question.id))
        .orderBy(quizOptions.position);

      result.push({ ...question, options });
    }

    return { assessmentId, questions: result };
  }

  async submit(
    assessmentId: string,
    dto: SubmitQuizDto,
    user: AuthenticatedUser,
  ) {
    const studentId = await this.findStudentId(user.sub);

    const [assessment] = await this.database.db
      .select({
        id: assessments.id,
        maxScore: assessments.maxScore,
        type: assessments.type,
        courseOfferingId: assessments.courseOfferingId,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment || assessment.type !== 'quiz') {
      throw new NotFoundException(`Quiz with ID "${assessmentId}" not found`);
    }

    if (Number(assessment.maxScore) > 999.99) {
      throw new BadRequestException(
        'The quiz maximum score exceeds the supported grade range',
      );
    }

    const [enrollment] = await this.database.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseOfferingId, assessment.courseOfferingId),
          eq(enrollments.status, 'enrolled'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this quiz course');
    }

    const questions = await this.database.db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.assessmentId, assessmentId));

    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions yet');
    }

    if (dto.answers.length !== questions.length) {
      throw new BadRequestException(
        'You must answer every question exactly once',
      );
    }

    const answerMap = new Map<string, string>();

    for (const answer of dto.answers) {
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException(
          'Each question may only be answered once',
        );
      }

      answerMap.set(answer.questionId, answer.optionId);
    }

    const questionIds = new Set(questions.map((question) => question.id));

    if ([...answerMap.keys()].some((id) => !questionIds.has(id))) {
      throw new BadRequestException(
        'One or more answers reference questions outside this quiz',
      );
    }

    let correctAnswers = 0;

    for (const question of questions) {
      const optionId = answerMap.get(question.id);

      if (!optionId) {
        throw new BadRequestException('Every question must be answered');
      }

      const [option] = await this.database.db
        .select({
          id: quizOptions.id,
          isCorrect: quizOptions.isCorrect,
        })
        .from(quizOptions)
        .where(
          and(
            eq(quizOptions.id, optionId),
            eq(quizOptions.questionId, question.id),
          ),
        )
        .limit(1);

      if (!option) {
        throw new BadRequestException(
          'An answer references an invalid option for its question',
        );
      }

      if (option.isCorrect) correctAnswers++;
    }

    const score = Number(
      (
        (correctAnswers / questions.length) *
        Number(assessment.maxScore)
      ).toFixed(2),
    );

    try {
      return await this.database.db.transaction(async (tx) => {
        const [attempt] = await tx
          .insert(quizAttempts)
          .values({
            assessmentId,
            enrollmentId: enrollment.id,
            answers: dto.answers,
            score: score.toFixed(2),
            totalQuestions: questions.length,
            correctAnswers,
          })
          .returning();

        const [grade] = await tx
          .insert(grades)
          .values({
            assessmentId,
            enrollmentId: enrollment.id,
            score: score.toFixed(2),
            gradedAt: new Date(),
          })
          .returning();

        return { attempt, grade };
      });
    } catch (error) {
      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'You have already submitted this quiz or a grade already exists',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The enrollment or assessment no longer exists',
        );
      }

      if (code === '23514') {
        throw new BadRequestException(
          'The calculated score violates a database constraint',
        );
      }

      throw error;
    }
  }

  async findAttempts(assessmentId: string, user: AuthenticatedUser) {
    const [quiz] = await this.database.db
      .select({
        id: assessments.id,
        instructorId: courseOfferings.instructorId,
      })
      .from(assessments)
      .innerJoin(
        courseOfferings,
        eq(assessments.courseOfferingId, courseOfferings.id),
      )
      .where(
        and(eq(assessments.id, assessmentId), eq(assessments.type, 'quiz')),
      )
      .limit(1);

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID "${assessmentId}" not found`);
    }

    await this.assertCanManage(user, quiz.instructorId);

    return this.database.db
      .select({
        attemptId: quizAttempts.id,
        assessmentId: quizAttempts.assessmentId,
        studentId: students.id,
        studentNumber: students.number,
        firstName: students.firstName,
        lastName: students.lastName,
        email: users.email,
        score: quizAttempts.score,
        maxScore: assessments.maxScore,
        totalQuestions: quizAttempts.totalQuestions,
        correctAnswers: quizAttempts.correctAnswers,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(enrollments, eq(quizAttempts.enrollmentId, enrollments.id))
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .innerJoin(assessments, eq(quizAttempts.assessmentId, assessments.id))
      .where(eq(quizAttempts.assessmentId, assessmentId))
      .orderBy(desc(quizAttempts.submittedAt));
  }

  async findMyAttempt(assessmentId: string, user: AuthenticatedUser) {
    const studentId = await this.findStudentId(user.sub);

    const [enrollment] = await this.database.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .innerJoin(
        assessments,
        eq(enrollments.courseOfferingId, assessments.courseOfferingId),
      )
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'enrolled'),
          eq(assessments.id, assessmentId),
          eq(assessments.type, 'quiz'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new ForbiddenException('You cannot access this quiz attempt');
    }

    const [attempt] = await this.database.db
      .select({
        id: quizAttempts.id,
        assessmentId: quizAttempts.assessmentId,
        score: quizAttempts.score,
        totalQuestions: quizAttempts.totalQuestions,
        correctAnswers: quizAttempts.correctAnswers,
        submittedAt: quizAttempts.submittedAt,
        createdAt: quizAttempts.createdAt,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.assessmentId, assessmentId),
          eq(quizAttempts.enrollmentId, enrollment.id),
        ),
      )
      .limit(1);

    if (!attempt) {
      throw new NotFoundException('No quiz attempt has been submitted yet');
    }

    return attempt;
  }
}
