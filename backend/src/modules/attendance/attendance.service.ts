import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { attendance, enrollments } from '../../database/schema.js';
import type { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto.js';

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
export class AttendanceService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateAttendanceDto) {
    try {
      const [enrollment] = await this.database.db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(eq(enrollments.id, dto.enrollmentId))
        .limit(1);

      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID "${dto.enrollmentId}" not found`,
        );
      }

      const [record] = await this.database.db
        .insert(attendance)
        .values({
          enrollmentId: dto.enrollmentId,
          sessionDate: dto.sessionDate,
          status: dto.status,
          notes: dto.notes ?? null,
        })
        .returning();

      return record;
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
          'Attendance has already been recorded for this enrollment and date',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified enrollment does not exist',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select()
      .from(attendance)
      .orderBy(attendance.sessionDate, attendance.createdAt);
  }

  async findOne(id: string) {
    const [record] = await this.database.db
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundException(`Attendance with ID "${id}" not found`);
    }

    return record;
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    if (
      dto.sessionDate === undefined &&
      dto.status === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    try {
      const [record] = await this.database.db
        .update(attendance)
        .set({
          ...(dto.sessionDate !== undefined && {
            sessionDate: dto.sessionDate,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          updatedAt: new Date(),
        })
        .where(eq(attendance.id, id))
        .returning();

      if (!record) {
        throw new NotFoundException(`Attendance with ID "${id}" not found`);
      }

      return record;
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
          'Attendance has already been recorded for this enrollment and date',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified enrollment does not exist',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    const [record] = await this.database.db
      .delete(attendance)
      .where(eq(attendance.id, id))
      .returning({ id: attendance.id });

    if (!record) {
      throw new NotFoundException(`Attendance with ID "${id}" not found`);
    }

    return record;
  }
}
