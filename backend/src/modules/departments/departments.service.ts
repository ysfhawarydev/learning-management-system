import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { departments } from '../../database/schema.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';

function getPostgresErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }

    visited.add(current);

    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateDepartmentDto) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const description = dto.description?.trim() || null;

    if (!code || !name) {
      throw new BadRequestException('Department code and name cannot be empty');
    }

    try {
      const [department] = await this.database.db
        .insert(departments)
        .values({
          code,
          name,
          description,
        })
        .returning();

      return department;
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'A department with this code already exists',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select()
      .from(departments)
      .orderBy(departments.name);
  }

  async findOne(id: string) {
    const [department] = await this.database.db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const values: {
      code?: string;
      name?: string;
      description?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();

      if (!code) {
        throw new BadRequestException('Department code cannot be empty');
      }

      values.code = code;
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('Department name cannot be empty');
      }

      values.name = name;
    }

    if (dto.description !== undefined) {
      values.description = dto.description.trim() || null;
    }

    if (Object.keys(values).length === 1) {
      throw new BadRequestException(
        'At least one department field must be provided',
      );
    }

    try {
      const [department] = await this.database.db
        .update(departments)
        .set(values)
        .where(eq(departments.id, id))
        .returning();

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      return department;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'A department with this code already exists',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [department] = await this.database.db
        .delete(departments)
        .where(eq(departments.id, id))
        .returning({ id: departments.id });

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      return { message: 'Department deleted successfully' };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (getPostgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Cannot delete a department that is assigned to students, instructors, or courses',
        );
      }

      throw error;
    }
  }
}
