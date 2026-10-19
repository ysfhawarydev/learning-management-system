import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  assessments,
  courseOfferings,
  instructors,
} from '../../database/schema.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateAssessmentDto } from './dto/create-assessment.dto.js';
import { UpdateAssessmentDto } from './dto/update-assessment.dto.js';

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
export class AssessmentsService {
  constructor(private readonly database: DatabaseService) {}

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

  async create(dto: CreateAssessmentDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Assessment name cannot be empty');
    }

    try {
      const [assessment] = await this.database.db
        .insert(assessments)
        .values({
          courseOfferingId: dto.courseOfferingId,
          name,
          type: dto.type,
          maxScore: dto.maxScore.toFixed(2),
          weight: dto.weight.toFixed(2),
        })
        .returning();

      return assessment;
    } catch (error) {
      const code = getPostgresErrorCode(error);

      if (code === '23503') {
        throw new BadRequestException(
          'The specified course offering does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException(
          'Maximum score must be positive and weight must be between 0 and 100',
        );
      }

      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    if (user.roles.includes('admin')) {
      return this.database.db
        .select()
        .from(assessments)
        .orderBy(assessments.name);
    }

    if (!user.roles.includes('instructor')) {
      throw new ForbiddenException('You cannot access assessments');
    }

    const instructorId = await this.findInstructorId(user.sub);

    return this.database.db
      .select({
        id: assessments.id,
        courseOfferingId: assessments.courseOfferingId,
        name: assessments.name,
        type: assessments.type,
        maxScore: assessments.maxScore,
        weight: assessments.weight,
        createdAt: assessments.createdAt,
        updatedAt: assessments.updatedAt,
      })
      .from(assessments)
      .innerJoin(
        courseOfferings,
        eq(assessments.courseOfferingId, courseOfferings.id),
      )
      .where(eq(courseOfferings.instructorId, instructorId))
      .orderBy(assessments.name);
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
      .where(eq(assessments.id, id))
      .limit(1);

    if (!result) {
      throw new NotFoundException(`Assessment with ID "${id}" not found`);
    }

    if (user.roles.includes('admin')) {
      return result.assessment;
    }

    if (!user.roles.includes('instructor')) {
      throw new ForbiddenException('You cannot access this assessment');
    }

    const instructorId = await this.findInstructorId(user.sub);

    if (result.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only access assessments for your own course offerings',
      );
    }

    return result.assessment;
  }

  async update(id: string, dto: UpdateAssessmentDto) {
    const values: Partial<typeof assessments.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.courseOfferingId !== undefined) {
      values.courseOfferingId = dto.courseOfferingId;
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('Assessment name cannot be empty');
      }

      values.name = name;
    }

    if (dto.type !== undefined) values.type = dto.type;
    if (dto.maxScore !== undefined) values.maxScore = dto.maxScore.toFixed(2);
    if (dto.weight !== undefined) values.weight = dto.weight.toFixed(2);

    if (Object.keys(values).length === 1) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    try {
      const [assessment] = await this.database.db
        .update(assessments)
        .set(values)
        .where(eq(assessments.id, id))
        .returning();

      if (!assessment) {
        throw new NotFoundException(`Assessment with ID "${id}" not found`);
      }

      return assessment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      const code = getPostgresErrorCode(error);

      if (code === '23503') {
        throw new BadRequestException(
          'The specified course offering does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException(
          'Maximum score must be positive and weight must be between 0 and 100',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [assessment] = await this.database.db
        .delete(assessments)
        .where(eq(assessments.id, id))
        .returning({ id: assessments.id });

      if (!assessment) {
        throw new NotFoundException(`Assessment with ID "${id}" not found`);
      }

      return assessment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      const code = getPostgresErrorCode(error);

      if (code === '23503' || code === '23001') {
        throw new ConflictException(
          'Cannot delete an assessment that has associated grades',
        );
      }

      throw error;
    }
  }
}
