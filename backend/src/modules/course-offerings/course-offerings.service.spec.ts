import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { CourseOfferingsService } from './course-offerings.service.js';

describe('CourseOfferingsService', () => {
  let service: CourseOfferingsService;

  const mockReturning = vi.fn();
  const mockWhere = vi.fn(() => ({ returning: mockReturning }));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockSelectWhere = vi.fn(() => ({
    limit: mockLimit,
    orderBy: mockOrderBy,
  }));
  const mockSelectFrom = vi.fn(() => ({
    where: mockSelectWhere,
    orderBy: mockOrderBy,
  }));
  const mockDeleteWhere = vi.fn(() => ({ returning: mockReturning }));

  const database = {
    db: {
      insert: vi.fn(() => ({ values: mockValues })),
      select: vi.fn(() => ({ from: mockSelectFrom })),
      update: vi.fn(() => ({ set: mockSet })),
      delete: vi.fn(() => ({ where: mockDeleteWhere })),
    },
  };

  const courseId = '11111111-1111-4111-8111-111111111111';
  const semesterId = '22222222-2222-4222-8222-222222222222';
  const instructorId = '33333333-3333-4333-8333-333333333333';
  const offeringId = '44444444-4444-4444-8444-444444444444';

  const offering = {
    id: offeringId,
    courseId,
    semesterId,
    instructorId,
    sectionCode: 'A',
    capacity: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CourseOfferingsService(
      database as unknown as DatabaseService,
    );

    mockValues.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
    });
    mockSelectWhere.mockReturnValue({
      limit: mockLimit,
      orderBy: mockOrderBy,
    });
    mockDeleteWhere.mockReturnValue({ returning: mockReturning });
  });

  it('creates an offering with a normalized section code', async () => {
    mockReturning.mockResolvedValue([offering]);

    await expect(
      service.create({
        courseId,
        semesterId,
        instructorId,
        sectionCode: ' a ',
        capacity: 30,
      }),
    ).resolves.toEqual(offering);

    expect(mockValues).toHaveBeenCalledWith({
      courseId,
      semesterId,
      instructorId,
      sectionCode: 'A',
      capacity: 30,
    });
  });

  it('allows capacity to be omitted', async () => {
    mockReturning.mockResolvedValue([offering]);

    await service.create({
      courseId,
      semesterId,
      instructorId,
      sectionCode: 'A',
    });

    expect(mockValues).toHaveBeenCalledWith({
      courseId,
      semesterId,
      instructorId,
      sectionCode: 'A',
    });
  });

  it('rejects a blank section code', async () => {
    await expect(
      service.create({
        courseId,
        semesterId,
        instructorId,
        sectionCode: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate offerings to a conflict', async () => {
    mockReturning.mockRejectedValue({ code: '23505' });

    await expect(
      service.create({
        courseId,
        semesterId,
        instructorId,
        sectionCode: 'A',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps invalid foreign keys to a bad request', async () => {
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(
      service.create({
        courseId,
        semesterId,
        instructorId,
        sectionCode: 'A',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps capacity constraint violations to a bad request', async () => {
    mockReturning.mockRejectedValue({ code: '23514' });

    await expect(
      service.create({
        courseId,
        semesterId,
        instructorId,
        sectionCode: 'A',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists all offerings for an admin', async () => {
    mockOrderBy.mockResolvedValue([offering]);

    await expect(
      service.findAll({
        sub: 'admin-user-id',
        roles: ['admin'],
      } as never),
    ).resolves.toEqual([offering]);

    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('lists only the instructor’s own offerings', async () => {
    mockLimit.mockResolvedValue([{ id: instructorId }]);
    mockOrderBy.mockResolvedValue([offering]);

    await expect(
      service.findAll({
        sub: 'instructor-user-id',
        roles: ['instructor'],
      } as never),
    ).resolves.toEqual([offering]);

    expect(mockSelectWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('rejects users without an authorized role', async () => {
    await expect(
      service.findAll({
        sub: 'student-user-id',
        roles: ['student'],
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('retrieves an offering by ID', async () => {
    mockLimit.mockResolvedValue([offering]);

    await expect(service.findOne(offeringId)).resolves.toEqual(offering);
  });

  it('throws when an offering does not exist', async () => {
    mockLimit.mockResolvedValue([]);

    await expect(service.findOne(offeringId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates offering fields and normalizes the section code', async () => {
    mockReturning.mockResolvedValue([
      { ...offering, sectionCode: 'B', capacity: 40 },
    ]);

    await service.update(offeringId, {
      sectionCode: ' b ',
      capacity: 40,
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionCode: 'B',
        capacity: 40,
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('rejects an empty update', async () => {
    await expect(service.update(offeringId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a blank updated section code', async () => {
    await expect(
      service.update(offeringId, { sectionCode: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when updating a nonexistent offering', async () => {
    mockReturning.mockResolvedValue([]);

    await expect(
      service.update(offeringId, { sectionCode: 'B' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate offerings during update to a conflict', async () => {
    mockReturning.mockRejectedValue({ code: '23505' });

    await expect(
      service.update(offeringId, { sectionCode: 'B' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps invalid foreign keys during update to a bad request', async () => {
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(
      service.update(offeringId, { courseId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes an offering successfully', async () => {
    mockReturning.mockResolvedValue([{ id: offeringId }]);

    await expect(service.remove(offeringId)).resolves.toEqual({
      id: offeringId,
    });
  });

  it('throws when deleting a nonexistent offering', async () => {
    mockReturning.mockResolvedValue([]);

    await expect(service.remove(offeringId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prevents deleting an offering referenced by enrollments or assessments', async () => {
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(service.remove(offeringId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('handles PostgreSQL errors nested inside a cause', async () => {
    mockReturning.mockRejectedValue({
      cause: { code: '23505' },
    });

    await expect(
      service.create({
        courseId,
        semesterId,
        instructorId,
        sectionCode: 'A',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
