import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { courseOfferings } from '../../database/schema.js';
import { CreateCourseOfferingDto } from './dto/create-course-offering.dto.js';
import { UpdateCourseOfferingDto } from './dto/update-course-offering.dto.js';

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
export class CourseOfferingsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateCourseOfferingDto) {
    const sectionCode = dto.sectionCode.trim().toUpperCase();

    if (!sectionCode) {
      throw new BadRequestException('Section code cannot be empty');
    }

    try {
      const [offering] = await this.database.db
        .insert(courseOfferings)
        .values({
          courseId: dto.courseId,
          semesterId: dto.semesterId,
          instructorId: dto.instructorId,
          sectionCode,
          ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        })
        .returning();

      return offering;
    } catch (error) {
      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'A course offering with this course, semester, and section code already exists',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified course, semester, or instructor does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException('Capacity must be a positive integer');
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select()
      .from(courseOfferings)
      .orderBy(courseOfferings.sectionCode);
  }

  async findOne(id: string) {
    const [offering] = await this.database.db
      .select()
      .from(courseOfferings)
      .where(eq(courseOfferings.id, id))
      .limit(1);

    if (!offering) {
      throw new NotFoundException(`Course offering with ID "${id}" not found`);
    }

    return offering;
  }

  async update(id: string, dto: UpdateCourseOfferingDto) {
    const values: Partial<typeof courseOfferings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.courseId !== undefined) values.courseId = dto.courseId;
    if (dto.semesterId !== undefined) values.semesterId = dto.semesterId;
    if (dto.instructorId !== undefined) values.instructorId = dto.instructorId;

    if (dto.sectionCode !== undefined) {
      const sectionCode = dto.sectionCode.trim().toUpperCase();

      if (!sectionCode) {
        throw new BadRequestException('Section code cannot be empty');
      }

      values.sectionCode = sectionCode;
    }

    if (dto.capacity !== undefined) {
      values.capacity = dto.capacity;
    }

    if (Object.keys(values).length === 1) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    try {
      const [offering] = await this.database.db
        .update(courseOfferings)
        .set(values)
        .where(eq(courseOfferings.id, id))
        .returning();

      if (!offering) {
        throw new NotFoundException(
          `Course offering with ID "${id}" not found`,
        );
      }

      return offering;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'A course offering with this course, semester, and section code already exists',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified course, semester, or instructor does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException('Capacity must be a positive integer');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [offering] = await this.database.db
        .delete(courseOfferings)
        .where(eq(courseOfferings.id, id))
        .returning({ id: courseOfferings.id });

      if (!offering) {
        throw new NotFoundException(
          `Course offering with ID "${id}" not found`,
        );
      }

      return offering;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      const code = getPostgresErrorCode(error);

      if (code === '23503' || code === '23001') {
        throw new ConflictException(
          'Cannot delete a course offering that has enrollments or assessments',
        );
      }

      throw error;
    }
  }
}
