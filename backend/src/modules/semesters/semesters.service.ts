import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { semesters } from '../../database/schema.js';
import type { CreateSemesterDto } from './dto/create-semester.dto.js';
import type { UpdateSemesterDto } from './dto/update-semester.dto.js';

function getPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const visited = new Set<object>();

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
export class SemestersService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateSemesterDto) {
    const academicYear = dto.academicYear.trim();

    if (!academicYear) {
      throw new BadRequestException('Academic year cannot be empty');
    }

    this.validateDateRange(dto.startDate, dto.endDate);

    try {
      const [semester] = await this.database.db
        .insert(semesters)
        .values({
          academicYear,
          term: dto.term,
          status: dto.status,
          startDate: dto.startDate,
          endDate: dto.endDate,
        })
        .returning();

      return semester;
    } catch (error) {
      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'A semester with this academic year and term already exists',
        );
      }

      if (code === '23514') {
        throw new BadRequestException(
          'Semester start date must not be after its end date',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select()
      .from(semesters)
      .orderBy(semesters.startDate);
  }

  async findOne(id: string) {
    const [semester] = await this.database.db
      .select()
      .from(semesters)
      .where(eq(semesters.id, id))
      .limit(1);

    if (!semester) {
      throw new NotFoundException('Semester not found');
    }

    return semester;
  }

  async update(id: string, dto: UpdateSemesterDto) {
    const values: {
      academicYear?: string;
      term?: 'spring' | 'summer' | 'fall' | 'winter';
      status?: 'planned' | 'active' | 'completed' | 'cancelled';
      startDate?: string;
      endDate?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.academicYear !== undefined) {
      const academicYear = dto.academicYear.trim();

      if (!academicYear) {
        throw new BadRequestException('Academic year cannot be empty');
      }

      values.academicYear = academicYear;
    }

    if (dto.term !== undefined) {
      values.term = dto.term;
    }

    if (dto.status !== undefined) {
      values.status = dto.status;
    }

    if (dto.startDate !== undefined) {
      values.startDate = dto.startDate;
    }

    if (dto.endDate !== undefined) {
      values.endDate = dto.endDate;
    }

    if (Object.keys(values).length === 1) {
      throw new BadRequestException('At least one field must be provided');
    }

    const current = await this.findOne(id);
    const startDate = values.startDate ?? current.startDate;
    const endDate = values.endDate ?? current.endDate;

    this.validateDateRange(startDate, endDate);

    try {
      const [semester] = await this.database.db
        .update(semesters)
        .set(values)
        .where(eq(semesters.id, id))
        .returning();

      if (!semester) {
        throw new NotFoundException('Semester not found');
      }

      return semester;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'A semester with this academic year and term already exists',
        );
      }

      if (code === '23514') {
        throw new BadRequestException(
          'Semester start date must not be after its end date',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [semester] = await this.database.db
        .delete(semesters)
        .where(eq(semesters.id, id))
        .returning({ id: semesters.id });

      if (!semester) {
        throw new NotFoundException('Semester not found');
      }

      return { message: 'Semester deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23503' || code === '23001') {
        throw new ConflictException(
          'Cannot delete a semester that has course offerings',
        );
      }

      throw error;
    }
  }

  private validateDateRange(startDate: string, endDate: string) {
    if (startDate > endDate) {
      throw new BadRequestException(
        'Semester start date must not be after its end date',
      );
    }
  }
}
