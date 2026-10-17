import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { courses } from '../../database/schema.js';
import type { CreateCourseDto } from './dto/create-course.dto.js';
import type { UpdateCourseDto } from './dto/update-course.dto.js';

function getPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;

  while (current && typeof current === 'object') {
    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}

@Injectable()
export class CoursesService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateCourseDto) {
    const code = dto.code.trim().toUpperCase();
    const title = dto.title.trim();

    if (!code || !title) {
      throw new BadRequestException('Course code and title cannot be empty');
    }

    try {
      const [course] = await this.database.db
        .insert(courses)
        .values({
          departmentId: dto.departmentId,
          code,
          title,
          description: dto.description?.trim() || null,
          creditValue: dto.creditValue,
        })
        .returning();

      return course;
    } catch (error) {
      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException('A course with this code already exists');
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified department does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException('Course credit value must be positive');
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db.select().from(courses).orderBy(courses.title);
  }

  async findOne(id: string) {
    const [course] = await this.database.db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const values: {
      departmentId?: string;
      code?: string;
      title?: string;
      description?: string | null;
      creditValue?: number;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.departmentId !== undefined) {
      values.departmentId = dto.departmentId;
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();

      if (!code) {
        throw new BadRequestException('Course code cannot be empty');
      }

      values.code = code;
    }

    if (dto.title !== undefined) {
      const title = dto.title.trim();

      if (!title) {
        throw new BadRequestException('Course title cannot be empty');
      }

      values.title = title;
    }

    if (dto.description !== undefined) {
      values.description = dto.description.trim() || null;
    }

    if (dto.creditValue !== undefined) {
      values.creditValue = dto.creditValue;
    }

    if (Object.keys(values).length === 1) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      const [course] = await this.database.db
        .update(courses)
        .set(values)
        .where(eq(courses.id, id))
        .returning();

      if (!course) {
        throw new NotFoundException('Course not found');
      }

      return course;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException('A course with this code already exists');
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified department does not exist',
        );
      }

      if (code === '23514') {
        throw new BadRequestException('Course credit value must be positive');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [course] = await this.database.db
        .delete(courses)
        .where(eq(courses.id, id))
        .returning({ id: courses.id });

      if (!course) {
        throw new NotFoundException('Course not found');
      }

      return { message: 'Course deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorCode = getPostgresErrorCode(error);

      if (errorCode === '23503' || errorCode === '23001') {
        throw new ConflictException(
          'Cannot delete a course that has course offerings',
        );
      }

      throw error;
    }
  }
}
