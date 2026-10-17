import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { assessments, enrollments, grades } from '../../database/schema.js';
import type { CreateGradeDto } from './dto/create-grade.dto.js';
import type { UpdateGradeDto } from './dto/update-grade.dto.js';

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
export class GradesService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateGradeDto) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [enrollment] = await tx
          .select({
            id: enrollments.id,
            courseOfferingId: enrollments.courseOfferingId,
          })
          .from(enrollments)
          .where(eq(enrollments.id, dto.enrollmentId))
          .limit(1);

        if (!enrollment) {
          throw new NotFoundException(
            `Enrollment with ID "${dto.enrollmentId}" not found`,
          );
        }

        const [assessment] = await tx
          .select({
            id: assessments.id,
            courseOfferingId: assessments.courseOfferingId,
            maxScore: assessments.maxScore,
          })
          .from(assessments)
          .where(eq(assessments.id, dto.assessmentId))
          .limit(1);

        if (!assessment) {
          throw new NotFoundException(
            `Assessment with ID "${dto.assessmentId}" not found`,
          );
        }

        if (enrollment.courseOfferingId !== assessment.courseOfferingId) {
          throw new BadRequestException(
            'The enrollment and assessment must belong to the same course offering',
          );
        }

        if (
          dto.score !== undefined &&
          dto.score !== null &&
          dto.score > Number(assessment.maxScore)
        ) {
          throw new BadRequestException(
            `Score cannot exceed the assessment maximum of ${assessment.maxScore}`,
          );
        }

        const [grade] = await tx
          .insert(grades)
          .values({
            enrollmentId: dto.enrollmentId,
            assessmentId: dto.assessmentId,
            score:
              dto.score === undefined || dto.score === null
                ? null
                : dto.score.toFixed(2),
            gradedAt:
              dto.score === undefined || dto.score === null ? null : new Date(),
          })
          .returning();

        return grade;
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'A grade already exists for this enrollment and assessment',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified enrollment or assessment does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException(
          'Score must be non-negative and score and gradedAt must be consistent',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db.select().from(grades).orderBy(grades.createdAt);
  }

  async findOne(id: string) {
    const [grade] = await this.database.db
      .select()
      .from(grades)
      .where(eq(grades.id, id))
      .limit(1);

    if (!grade) {
      throw new NotFoundException(`Grade with ID "${id}" not found`);
    }

    return grade;
  }

  async update(id: string, dto: UpdateGradeDto) {
    if (dto.score === undefined) {
      throw new BadRequestException(
        'The score field must be provided for update',
      );
    }

    const score = dto.score;

    try {
      return await this.database.db.transaction(async (tx) => {
        const [current] = await tx
          .select({
            id: grades.id,
            assessmentId: grades.assessmentId,
          })
          .from(grades)
          .where(eq(grades.id, id))
          .limit(1);

        if (!current) {
          throw new NotFoundException(`Grade with ID "${id}" not found`);
        }

        const [assessment] = await tx
          .select({
            maxScore: assessments.maxScore,
          })
          .from(assessments)
          .where(eq(assessments.id, current.assessmentId))
          .limit(1);

        if (!assessment) {
          throw new NotFoundException(
            `Assessment with ID "${current.assessmentId}" not found`,
          );
        }

        if (score !== null && score > Number(assessment.maxScore)) {
          throw new BadRequestException(
            `Score cannot exceed the assessment maximum of ${assessment.maxScore}`,
          );
        }

        const [updated] = await tx
          .update(grades)
          .set({
            score: score === null ? null : score.toFixed(2),
            gradedAt: score === null ? null : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(grades.id, id))
          .returning();

        return updated;
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23514') {
        throw new BadRequestException(
          'Score must be non-negative and score and gradedAt must be consistent',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    const [grade] = await this.database.db
      .delete(grades)
      .where(eq(grades.id, id))
      .returning({ id: grades.id });

    if (!grade) {
      throw new NotFoundException(`Grade with ID "${id}" not found`);
    }

    return grade;
  }
}
