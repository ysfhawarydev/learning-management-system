import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { SemestersService } from './semesters.service.js';

describe('SemestersService', () => {
  let service: SemestersService;

  const mockReturning = vi.fn();
  const mockWhere = vi.fn(() => ({ returning: mockReturning }));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
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

  const semesterId = '11111111-1111-4111-8111-111111111111';

  const semester = {
    id: semesterId,
    academicYear: '2026-2027',
    term: 'fall' as const,
    status: 'planned' as const,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemestersService(database as unknown as DatabaseService);

    mockValues.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
    });
    mockSelectWhere.mockReturnValue({ limit: mockLimit });
    mockDeleteWhere.mockReturnValue({ returning: mockReturning });
  });

  describe('create', () => {
    it('creates a semester and trims the academic year', async () => {
      mockReturning.mockResolvedValue([semester]);

      await expect(
        service.create({
          academicYear: ' 2026-2027 ',
          term: 'fall',
          startDate: '2026-09-01',
          endDate: '2026-12-31',
        }),
      ).resolves.toEqual(semester);

      expect(mockValues).toHaveBeenCalledWith({
        academicYear: '2026-2027',
        term: 'fall',
        status: undefined,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
      });
    });

    it('rejects a blank academic year', async () => {
      await expect(
        service.create({
          academicYear: '   ',
          term: 'fall',
          startDate: '2026-09-01',
          endDate: '2026-12-31',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a start date after the end date', async () => {
      await expect(
        service.create({
          academicYear: '2026-2027',
          term: 'fall',
          startDate: '2026-12-31',
          endDate: '2026-09-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps duplicate academic year and term to a conflict', async () => {
      mockReturning.mockRejectedValue({ code: '23505' });

      await expect(
        service.create({
          academicYear: '2026-2027',
          term: 'fall',
          startDate: '2026-09-01',
          endDate: '2026-12-31',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps a database date constraint violation to a bad request', async () => {
      mockReturning.mockRejectedValue({ code: '23514' });

      await expect(
        service.create({
          academicYear: '2026-2027',
          term: 'fall',
          startDate: '2026-09-01',
          endDate: '2026-12-31',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('preserves an explicitly provided status', async () => {
      mockReturning.mockResolvedValue([{ ...semester, status: 'active' }]);

      await service.create({
        academicYear: '2026-2027',
        term: 'fall',
        status: 'active',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
    });
  });

  describe('findAll', () => {
    it('lists semesters ordered by start date', async () => {
      mockOrderBy.mockResolvedValue([semester]);

      await expect(service.findAll()).resolves.toEqual([semester]);
      expect(mockOrderBy).toHaveBeenCalledOnce();
    });
  });

  describe('findOne', () => {
    it('retrieves a semester by ID', async () => {
      mockLimit.mockResolvedValue([semester]);

      await expect(service.findOne(semesterId)).resolves.toEqual(semester);
    });

    it('throws when a semester does not exist', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.findOne(semesterId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates semester fields and timestamp', async () => {
      mockLimit.mockResolvedValue([semester]);
      mockReturning.mockResolvedValue([
        { ...semester, academicYear: '2027-2028', term: 'spring' },
      ]);

      await service.update(semesterId, {
        academicYear: ' 2027-2028 ',
        term: 'spring',
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          academicYear: '2027-2028',
          term: 'spring',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('rejects an empty update', async () => {
      await expect(service.update(semesterId, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a blank updated academic year', async () => {
      await expect(
        service.update(semesterId, { academicYear: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates the date range using the existing date when only one date changes', async () => {
      mockLimit.mockResolvedValue([semester]);

      await expect(
        service.update(semesterId, { startDate: '2027-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows updating the end date when the complete range remains valid', async () => {
      mockLimit.mockResolvedValue([semester]);
      mockReturning.mockResolvedValue([{ ...semester, endDate: '2027-01-15' }]);

      await expect(
        service.update(semesterId, { endDate: '2027-01-15' }),
      ).resolves.toEqual({
        ...semester,
        endDate: '2027-01-15',
      });
    });

    it('throws when updating a nonexistent semester', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(
        service.update(semesterId, { academicYear: '2027-2028' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps duplicate semesters during update to a conflict', async () => {
      mockLimit.mockResolvedValue([semester]);
      mockReturning.mockRejectedValue({ code: '23505' });

      await expect(
        service.update(semesterId, { term: 'spring' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps database date constraint violations during update', async () => {
      mockLimit.mockResolvedValue([semester]);
      mockReturning.mockRejectedValue({ code: '23514' });

      await expect(
        service.update(semesterId, { endDate: '2027-01-15' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes a semester successfully', async () => {
      mockReturning.mockResolvedValue([{ id: semesterId }]);

      await expect(service.remove(semesterId)).resolves.toEqual({
        message: 'Semester deleted successfully',
      });
    });

    it('throws when deleting a nonexistent semester', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.remove(semesterId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('prevents deleting a semester referenced by course offerings', async () => {
      mockReturning.mockRejectedValue({ code: '23503' });

      await expect(service.remove(semesterId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('handles alternate foreign-key restriction errors', async () => {
      mockReturning.mockRejectedValue({ code: '23001' });

      await expect(service.remove(semesterId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
