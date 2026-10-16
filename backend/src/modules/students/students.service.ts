import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  departments,
  roles,
  students,
  userRoles,
  users,
} from '../../database/schema.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';

@Injectable()
export class StudentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateStudentDto) {
    const [user] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [department] = await this.database.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, dto.departmentId))
      .limit(1);

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const [studentRole] = await this.database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'student'))
      .limit(1);

    if (!studentRole) {
      throw new NotFoundException(
        'Student role not found. Seed the roles table first.',
      );
    }

    const [existingStudent] = await this.database.db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.userId, dto.userId))
      .limit(1);

    if (existingStudent) {
      throw new ConflictException(
        'A student profile already exists for this user',
      );
    }

    try {
      return await this.database.db.transaction(async (tx) => {
        const [assignedStudentRole] = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            and(eq(userRoles.userId, dto.userId), eq(roles.name, 'student')),
          )
          .limit(1);

        if (!assignedStudentRole) {
          await tx.insert(userRoles).values({
            userId: dto.userId,
            roleId: studentRole.id,
          });
        }

        const [student] = await tx
          .insert(students)
          .values({
            userId: dto.userId,
            departmentId: dto.departmentId,
            number: dto.number,
            firstName: dto.firstName,
            lastName: dto.lastName,
            birth: dto.birth,
          })
          .returning({
            id: students.id,
            userId: students.userId,
            departmentId: students.departmentId,
            number: students.number,
            firstName: students.firstName,
            lastName: students.lastName,
            birth: students.birth,
            status: students.status,
            createdAt: students.createdAt,
          });

        return student;
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'A student with this user or student number already exists',
        );
      }

      throw error;
    }
  }

  async findMyProfile(userId: string) {
    const [student] = await this.database.db
      .select({
        id: students.id,
        userId: students.userId,
        departmentId: students.departmentId,
        departmentName: departments.name,
        number: students.number,
        firstName: students.firstName,
        lastName: students.lastName,
        phone: students.phone,
        birth: students.birth,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
      })
      .from(students)
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .where(and(eq(students.userId, userId), isNull(students.deletedAt)))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }

  async findAll() {
    return this.database.db
      .select({
        id: students.id,
        userId: students.userId,
        departmentId: students.departmentId,
        departmentName: departments.name,
        number: students.number,
        firstName: students.firstName,
        lastName: students.lastName,
        phone: students.phone,
        birth: students.birth,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
      })
      .from(students)
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .where(isNull(students.deletedAt));
  }

  async findOne(id: string) {
    const [student] = await this.database.db
      .select({
        id: students.id,
        userId: students.userId,
        departmentId: students.departmentId,
        departmentName: departments.name,
        number: students.number,
        firstName: students.firstName,
        lastName: students.lastName,
        phone: students.phone,
        birth: students.birth,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
      })
      .from(students)
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .where(and(eq(students.id, id), isNull(students.deletedAt)))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async remove(id: string) {
    const [deletedStudent] = await this.database.db
      .update(students)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, id), isNull(students.deletedAt)))
      .returning({
        id: students.id,
        number: students.number,
        firstName: students.firstName,
        lastName: students.lastName,
        status: students.status,
        deletedAt: students.deletedAt,
      });

    if (!deletedStudent) {
      throw new NotFoundException('Student not found');
    }

    return {
      message: 'Student soft-deleted successfully',
      student: deletedStudent,
    };
  }

  async update(id: string, dto: UpdateStudentDto) {
    const hasUpdateFields = Object.values(dto).some(
      (value) => value !== undefined,
    );

    if (!hasUpdateFields) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const [existingStudent] = await this.database.db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, id), isNull(students.deletedAt)))
      .limit(1);

    if (!existingStudent) {
      throw new NotFoundException('Student not found');
    }

    if (dto.departmentId !== undefined) {
      const [department] = await this.database.db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, dto.departmentId))
        .limit(1);

      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    const updateData = {
      ...(dto.departmentId !== undefined && {
        departmentId: dto.departmentId,
      }),
      ...(dto.number !== undefined && { number: dto.number }),
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.birth !== undefined && { birth: dto.birth }),
      ...(dto.status !== undefined && { status: dto.status }),
      updatedAt: new Date(),
    };

    try {
      const [updatedStudent] = await this.database.db
        .update(students)
        .set(updateData)
        .where(and(eq(students.id, id), isNull(students.deletedAt)))
        .returning({ id: students.id });

      if (!updatedStudent) {
        throw new NotFoundException('Student not found');
      }

      return this.findOne(id);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'A student with this student number already exists',
        );
      }

      throw error;
    }
  }
}
