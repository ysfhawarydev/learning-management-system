import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { StudentsService } from './students.service.js';

describe('StudentsService', () => {
  let service: StudentsService;

  const mockDatabase = {
    db: {
      select: vi.fn(),
      update: vi.fn(),
    },
  };

  let selectQuery: {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };

  let updateQuery: {
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    selectQuery = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    };

    selectQuery.from.mockReturnValue(selectQuery);
    selectQuery.innerJoin.mockReturnValue(selectQuery);
    selectQuery.where.mockReturnValue(selectQuery);

    updateQuery = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn(),
    };

    updateQuery.set.mockReturnValue(updateQuery);
    updateQuery.where.mockReturnValue(updateQuery);

    mockDatabase.db.select.mockReturnValue(selectQuery);
    mockDatabase.db.update.mockReturnValue(updateQuery);

    service = new StudentsService(mockDatabase as unknown as DatabaseService);
  });

  describe('findMyProfile', () => {
    it('should return the current student profile when found', async () => {
      const student = {
        id: 'student-123',
        userId: 'user-123',
        departmentId: 'department-123',
        departmentName: 'Computer Science',
        number: 'STU-2026-001',
        firstName: 'John',
        lastName: 'Doe',
        status: 'enrolled',
      };

      selectQuery.limit.mockResolvedValue([student]);

      await expect(service.findMyProfile('user-123')).resolves.toEqual(student);
    });

    it('should throw NotFoundException when the profile does not exist', async () => {
      selectQuery.limit.mockResolvedValue([]);

      await expect(service.findMyProfile('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a student when found', async () => {
      const student = {
        id: 'student-123',
        userId: 'user-123',
        departmentId: 'department-123',
        departmentName: 'Computer Science',
        number: 'STU-2026-001',
        firstName: 'John',
        lastName: 'Doe',
        status: 'enrolled',
      };

      selectQuery.limit.mockResolvedValue([student]);

      await expect(service.findOne('student-123')).resolves.toEqual(student);
    });

    it('should throw NotFoundException when the student does not exist', async () => {
      selectQuery.limit.mockResolvedValue([]);

      await expect(service.findOne('missing-student')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete a student and return the deletion result', async () => {
      const deletedAt = new Date('2026-10-16T10:00:00.000Z');

      const deletedStudent = {
        id: 'student-123',
        number: 'STU-2026-001',
        firstName: 'John',
        lastName: 'Doe',
        status: 'enrolled',
        deletedAt,
      };

      updateQuery.returning.mockResolvedValue([deletedStudent]);

      await expect(service.remove('student-123')).resolves.toEqual({
        message: 'Student soft-deleted successfully',
        student: deletedStudent,
      });

      expect(mockDatabase.db.update).toHaveBeenCalledOnce();
      expect(updateQuery.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
      expect(updateQuery.returning).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundException when the student does not exist or was already deleted', async () => {
      updateQuery.returning.mockResolvedValue([]);

      await expect(service.remove('missing-student')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should reject an empty update payload', async () => {
      await expect(service.update('student-123', {})).rejects.toThrow(
        BadRequestException,
      );

      expect(mockDatabase.db.select).not.toHaveBeenCalled();
      expect(mockDatabase.db.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating a missing or deleted student', async () => {
      selectQuery.limit.mockResolvedValue([]);

      await expect(
        service.update('missing-student', {
          firstName: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockDatabase.db.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the requested department does not exist', async () => {
      selectQuery.limit
        .mockResolvedValueOnce([{ id: 'student-123' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.update('student-123', {
          departmentId: 'missing-department',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockDatabase.db.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the student disappears before the update completes', async () => {
      selectQuery.limit.mockResolvedValueOnce([{ id: 'student-123' }]);
      updateQuery.returning.mockResolvedValue([]);

      await expect(
        service.update('student-123', {
          firstName: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update a student and return the updated profile', async () => {
      const updatedStudent = {
        id: 'student-123',
        userId: 'user-123',
        departmentId: 'department-123',
        departmentName: 'Computer Science',
        number: 'STU-2026-001',
        firstName: 'Updated',
        lastName: 'Doe',
        status: 'enrolled',
      };

      selectQuery.limit
        .mockResolvedValueOnce([{ id: 'student-123' }])
        .mockResolvedValueOnce([updatedStudent]);

      updateQuery.returning.mockResolvedValue([{ id: 'student-123' }]);

      const result = await service.update('student-123', {
        firstName: 'Updated',
      });

      expect(updateQuery.set).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Updated',
          updatedAt: expect.any(Date),
        }),
      );

      expect(result).toEqual(updatedStudent);
      expect(mockDatabase.db.select).toHaveBeenCalledTimes(2);
    });
  });
});
