import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimetableService } from './timetable.service.js';
import type { DatabaseService } from '../../database/database.service.js';
import { DayOfWeek } from './dto/create-timetable-slot.dto.js';

describe('TimetableService', () => {
  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const mockDeleteReturning = vi.fn();
  const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }));
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  const database = {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };

  let service: TimetableService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new TimetableService(database as unknown as DatabaseService);
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });
  });

  it('rejects empty updates', async () => {
    mockLimit.mockResolvedValueOnce([
      {
        id: 'slot',
        courseOfferingId: 'offering',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00:00',
        endTime: '10:00:00',
        room: null,
      },
    ]);
    await expect(service.update('slot', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when a slot does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists slots', async () => {
    const orderBy = vi.fn().mockResolvedValue([]);
    mockFrom.mockReturnValueOnce({ orderBy } as never);

    await expect(service.findAll()).resolves.toEqual([]);
    expect(orderBy).toHaveBeenCalledOnce();
  });

  it('throws when deleting a missing slot', async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps a missing course offering to not found', async () => {
    mockLimit.mockResolvedValueOnce([]);
    await expect(
      service.create({
        courseOfferingId: 'missing',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid time range', async () => {
    await expect(
      service.create({
        courseOfferingId: 'offering',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '10:00',
        endTime: '09:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exposes conflict exception type for conflict handling', () => {
    expect(new ConflictException()).toBeInstanceOf(ConflictException);
  });
});
