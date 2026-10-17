import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  departments,
  instructors,
  roles,
  userRoles,
  users,
} from '../../database/schema.js';
import type { CreateInstructorDto } from './dto/create-instructor.dto.js';
import type { UpdateInstructorDto } from './dto/update-instructor.dto.js';

function getPostgresErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) break;
    visited.add(current);

    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}

@Injectable()
export class InstructorsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateInstructorDto) {
    const employeeNumber = dto.employeeNumber.trim();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const phone = dto.phone?.trim() || null;

    if (!employeeNumber || !firstName || !lastName) {
      throw new BadRequestException(
        'Employee number and names cannot be empty',
      );
    }

    try {
      return await this.database.db.transaction(async (tx) => {
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, dto.userId))
          .limit(1);

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const [department] = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.id, dto.departmentId))
          .limit(1);

        if (!department) {
          throw new NotFoundException('Department not found');
        }

        const [existingInstructor] = await tx
          .select({ id: instructors.id })
          .from(instructors)
          .where(eq(instructors.userId, dto.userId))
          .limit(1);

        if (existingInstructor) {
          throw new ConflictException(
            'An instructor profile already exists for this user',
          );
        }

        const [instructorRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, 'instructor'))
          .limit(1);

        if (!instructorRole) {
          throw new NotFoundException(
            'Instructor role not found. Seed the roles table first.',
          );
        }

        const [assignedRole] = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, dto.userId),
              eq(userRoles.roleId, instructorRole.id),
            ),
          )
          .limit(1);

        if (!assignedRole) {
          await tx.insert(userRoles).values({
            userId: dto.userId,
            roleId: instructorRole.id,
          });
        }

        const [instructor] = await tx
          .insert(instructors)
          .values({
            userId: dto.userId,
            departmentId: dto.departmentId,
            employeeNumber,
            firstName,
            lastName,
            phone,
          })
          .returning();

        return instructor;
      });
    } catch (error: unknown) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23505') {
        throw new ConflictException(
          'The employee number or instructor account is already in use',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified user or department does not exist',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select({
        id: instructors.id,
        userId: instructors.userId,
        departmentId: instructors.departmentId,
        departmentName: departments.name,
        employeeNumber: instructors.employeeNumber,
        firstName: instructors.firstName,
        lastName: instructors.lastName,
        phone: instructors.phone,
        createdAt: instructors.createdAt,
        updatedAt: instructors.updatedAt,
      })
      .from(instructors)
      .innerJoin(departments, eq(instructors.departmentId, departments.id))
      .orderBy(instructors.lastName, instructors.firstName);
  }

  async findOne(id: string) {
    const [instructor] = await this.database.db
      .select({
        id: instructors.id,
        userId: instructors.userId,
        departmentId: instructors.departmentId,
        departmentName: departments.name,
        employeeNumber: instructors.employeeNumber,
        firstName: instructors.firstName,
        lastName: instructors.lastName,
        phone: instructors.phone,
        createdAt: instructors.createdAt,
        updatedAt: instructors.updatedAt,
      })
      .from(instructors)
      .innerJoin(departments, eq(instructors.departmentId, departments.id))
      .where(eq(instructors.id, id))
      .limit(1);

    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }

    return instructor;
  }

  async update(id: string, dto: UpdateInstructorDto) {
    const values: {
      departmentId?: string;
      employeeNumber?: string;
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (dto.departmentId !== undefined) {
      const [department] = await this.database.db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, dto.departmentId))
        .limit(1);

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      values.departmentId = dto.departmentId;
    }

    if (dto.employeeNumber !== undefined) {
      const employeeNumber = dto.employeeNumber.trim();

      if (!employeeNumber) {
        throw new BadRequestException('Employee number cannot be empty');
      }

      values.employeeNumber = employeeNumber;
    }

    if (dto.firstName !== undefined) {
      const firstName = dto.firstName.trim();

      if (!firstName) {
        throw new BadRequestException('First name cannot be empty');
      }

      values.firstName = firstName;
    }

    if (dto.lastName !== undefined) {
      const lastName = dto.lastName.trim();

      if (!lastName) {
        throw new BadRequestException('Last name cannot be empty');
      }

      values.lastName = lastName;
    }

    if (dto.phone !== undefined) {
      values.phone = dto.phone?.trim() || null;
    }
    if (Object.keys(values).length === 1) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      const [instructor] = await this.database.db
        .update(instructors)
        .set(values)
        .where(eq(instructors.id, id))
        .returning({ id: instructors.id });

      if (!instructor) {
        throw new NotFoundException('Instructor not found');
      }

      return this.findOne(id);
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'An instructor with this employee number already exists',
        );
      }

      if (getPostgresErrorCode(error) === '23503') {
        throw new BadRequestException(
          'The specified department does not exist',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [instructor] = await this.database.db
        .delete(instructors)
        .where(eq(instructors.id, id))
        .returning({ id: instructors.id });

      if (!instructor) {
        throw new NotFoundException('Instructor not found');
      }

      return { message: 'Instructor deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const code = getPostgresErrorCode(error);

      if (code === '23503' || code === '23001') {
        throw new ConflictException(
          'Cannot delete an instructor who has course offerings',
        );
      }

      throw error;
    }
  }
}
