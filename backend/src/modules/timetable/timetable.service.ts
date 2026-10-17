import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, isNotNull, lt, ne } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { courseOfferings, timetableSlots } from '../../database/schema.js';
import type { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto.js';
import type { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto.js';

@Injectable()
export class TimetableService {
  constructor(private readonly database: DatabaseService) {}

  private async assertOfferingExists(courseOfferingId: string) {
    const [offering] = await this.database.db
      .select({ id: courseOfferings.id })
      .from(courseOfferings)
      .where(eq(courseOfferings.id, courseOfferingId))
      .limit(1);

    if (!offering) {
      throw new NotFoundException(
        `Course offering with ID "${courseOfferingId}" not found`,
      );
    }
  }

  private async assertNoConflict(input: {
    courseOfferingId: string;
    dayOfWeek:
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday';
    startTime: string;
    endTime: string;
    room?: string | null;
    excludeId?: string;
  }) {
    if (input.startTime >= input.endTime) {
      throw new BadRequestException('endTime must be later than startTime');
    }

    const conditions = [
      eq(timetableSlots.dayOfWeek, input.dayOfWeek),
      lt(timetableSlots.startTime, input.endTime),
      gt(timetableSlots.endTime, input.startTime),
    ];

    if (input.excludeId) {
      conditions.push(ne(timetableSlots.id, input.excludeId));
    }

    const [offering] = await this.database.db
      .select({ instructorId: courseOfferings.instructorId })
      .from(courseOfferings)
      .where(eq(courseOfferings.id, input.courseOfferingId))
      .limit(1);

    if (!offering) {
      throw new NotFoundException(
        `Course offering with ID "${input.courseOfferingId}" not found`,
      );
    }

    const instructorConflict = await this.database.db
      .select({ id: timetableSlots.id })
      .from(timetableSlots)
      .innerJoin(
        courseOfferings,
        eq(timetableSlots.courseOfferingId, courseOfferings.id),
      )
      .where(
        and(
          ...conditions,
          eq(courseOfferings.instructorId, offering.instructorId),
        ),
      )
      .limit(1);

    if (instructorConflict.length) {
      throw new ConflictException(
        'The instructor already has a timetable slot during this time',
      );
    }

    const room = input.room?.trim();

    if (room) {
      const roomConflict = await this.database.db
        .select({ id: timetableSlots.id })
        .from(timetableSlots)
        .where(
          and(
            ...conditions,
            isNotNull(timetableSlots.room),
            eq(timetableSlots.room, room),
          ),
        )
        .limit(1);

      if (roomConflict.length) {
        throw new ConflictException(
          'The room is already booked during this time',
        );
      }
    }
  }

  async create(dto: CreateTimetableSlotDto) {
    const room = dto.room?.trim() || null;

    await this.assertNoConflict({
      courseOfferingId: dto.courseOfferingId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      room,
    });

    const [slot] = await this.database.db
      .insert(timetableSlots)
      .values({
        courseOfferingId: dto.courseOfferingId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room,
      })
      .returning();

    return slot;
  }

  async findAll() {
    return this.database.db
      .select()
      .from(timetableSlots)
      .orderBy(timetableSlots.dayOfWeek, timetableSlots.startTime);
  }

  async findOne(id: string) {
    const [slot] = await this.database.db
      .select()
      .from(timetableSlots)
      .where(eq(timetableSlots.id, id))
      .limit(1);

    if (!slot) {
      throw new NotFoundException(`Timetable slot with ID "${id}" not found`);
    }

    return slot;
  }

  async update(id: string, dto: UpdateTimetableSlotDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    const current = await this.findOne(id);

    const next = {
      courseOfferingId: dto.courseOfferingId ?? current.courseOfferingId,
      dayOfWeek: dto.dayOfWeek ?? current.dayOfWeek,
      startTime: dto.startTime ?? current.startTime,
      endTime: dto.endTime ?? current.endTime,
      room: dto.room === undefined ? current.room : dto.room?.trim() || null,
    };

    await this.assertNoConflict({ ...next, excludeId: id });

    const [slot] = await this.database.db
      .update(timetableSlots)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(timetableSlots.id, id))
      .returning();

    if (!slot) {
      throw new NotFoundException(`Timetable slot with ID "${id}" not found`);
    }

    return slot;
  }

  async remove(id: string) {
    const [slot] = await this.database.db
      .delete(timetableSlots)
      .where(eq(timetableSlots.id, id))
      .returning({ id: timetableSlots.id });

    if (!slot) {
      throw new NotFoundException(`Timetable slot with ID "${id}" not found`);
    }

    return slot;
  }
}
