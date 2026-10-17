import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { enrollments, students } from '../../database/schema.js';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import type { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';

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
export class EnrollmentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateEnrollmentDto) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [student] = await tx
          .select({ id: students.id, deletedAt: students.deletedAt })
          .from(students)
          .where(eq(students.id, dto.studentId))
          .limit(1);

        if (!student || student.deletedAt) {
          throw new NotFoundException(
            `Active student with ID "${dto.studentId}" not found`,
          );
        }

        // Lock the offering row so concurrent requests cannot take the same
        // remaining seat. PostgreSQL keeps this lock until the transaction ends.
        const lockedOfferings = await tx.execute<{
          id: string;
          capacity: number | null;
        }>(
          // Drizzle's SQL template keeps values parameterized.
          sql`
            SELECT id, capacity
            FROM course_offerings
            WHERE id = ${dto.courseOfferingId}::uuid
            FOR UPDATE
          `,
        );

        const offering = lockedOfferings.rows[0];

        if (!offering) {
          throw new NotFoundException(
            `Course offering with ID "${dto.courseOfferingId}" not found`,
          );
        }

        const [existing] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.studentId, dto.studentId),
              eq(enrollments.courseOfferingId, dto.courseOfferingId),
            ),
          )
          .limit(1);

        if (existing) {
          throw new ConflictException(
            'This student already has an enrollment for this course offering',
          );
        }

        if (dto.status === 'enrolled' && offering.capacity !== null) {
          const [result] = await tx
            .select({ value: count() })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.courseOfferingId, dto.courseOfferingId),
                eq(enrollments.status, 'enrolled'),
              ),
            );

          if (Number(result?.value ?? 0) >= offering.capacity) {
            throw new ConflictException(
              'This course offering has reached its enrollment capacity',
            );
          }
        }

        const [enrollment] = await tx
          .insert(enrollments)
          .values({
            studentId: dto.studentId,
            courseOfferingId: dto.courseOfferingId,
            status: dto.status,
          })
          .returning();

        return enrollment;
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
          'This student already has an enrollment for this course offering',
        );
      }

      if (code === '23503') {
        throw new BadRequestException(
          'The specified student or course offering does not exist',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select()
      .from(enrollments)
      .orderBy(enrollments.enrolledAt);
  }

  async findOne(id: string) {
    const [enrollment] = await this.database.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID "${id}" not found`);
    }

    return enrollment;
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(enrollments)
          .where(eq(enrollments.id, id))
          .limit(1);

        if (!current) {
          throw new NotFoundException(`Enrollment with ID "${id}" not found`);
        }

        if (dto.status === 'enrolled' && current.status !== 'enrolled') {
          const lockedOfferings = await tx.execute<{
            id: string;
            capacity: number | null;
          }>(
            sql`
              SELECT id, capacity
              FROM course_offerings
              WHERE id = ${current.courseOfferingId}::uuid
              FOR UPDATE
            `,
          );

          const offering = lockedOfferings.rows[0];

          if (!offering) {
            throw new NotFoundException(
              `Course offering with ID "${current.courseOfferingId}" not found`,
            );
          }

          if (offering.capacity !== null) {
            const [result] = await tx
              .select({ value: count() })
              .from(enrollments)
              .where(
                and(
                  eq(enrollments.courseOfferingId, current.courseOfferingId),
                  eq(enrollments.status, 'enrolled'),
                ),
              );

            if (Number(result?.value ?? 0) >= offering.capacity) {
              throw new ConflictException(
                'This course offering has reached its enrollment capacity',
              );
            }
          }
        }

        const [updated] = await tx
          .update(enrollments)
          .set({ status: dto.status, updatedAt: new Date() })
          .where(eq(enrollments.id, id))
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

      if (code === '23503') {
        throw new BadRequestException(
          'The enrollment references a record that does not exist',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      const [enrollment] = await this.database.db
        .delete(enrollments)
        .where(eq(enrollments.id, id))
        .returning({ id: enrollments.id });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID "${id}" not found`);
      }

      return enrollment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      const code = getPostgresErrorCode(error);

      if (code === '23503' || code === '23001') {
        throw new ConflictException(
          'Cannot delete an enrollment that has associated grades',
        );
      }

      throw error;
    }
  }
}
