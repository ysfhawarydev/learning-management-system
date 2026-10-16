import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { StudentsService } from './students.service.js';

describe('StudentsService', () => {
  let service: StudentsService;

  const mockDatabase = {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    },
  };

  let selectQuery: {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };

  let insertQuery: {
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    onConflictDoNothing: ReturnType<typeof vi.fn>;
  };

  let updateQuery: {
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
  };

  let transactionSelectQuery: {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };

  let transactionInsertQuery: {
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
  };

  let transaction: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };

  const createDto = {
    userId: 'user-123',
    departmentId: 'department-123',
    number: 'STU-2026-001',
    firstName: 'John',
    lastName: 'Doe',
    birth: '2005-05-15',
  };

  function makeUniqueViolation() {
    return Object.assign(new Error('Unique constraint violation'), {
      code: '23505',
    });
  }

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

    insertQuery = {
      values: vi.fn(),
      returning: vi.fn(),
      onConflictDoNothing: vi.fn(),
    };

    insertQuery.values.mockReturnValue(insertQuery);
    insertQuery.onConflictDoNothing.mockReturnValue(insertQuery);

    updateQuery = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn(),
    };

    updateQuery.set.mockReturnValue(updateQuery);
    updateQuery.where.mockReturnValue(updateQuery);

    transactionSelectQuery = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
    };

    transactionSelectQuery.from.mockReturnValue(transactionSelectQuery);
    transactionSelectQuery.innerJoin.mockReturnValue(transactionSelectQuery);
    transactionSelectQuery.where.mockReturnValue(transactionSelectQuery);

    transactionInsertQuery = {
      values: vi.fn(),
      returning: vi.fn(),
    };

    transactionInsertQuery.values.mockReturnValue(transactionInsertQuery);

    transaction = {
      select: vi.fn().mockReturnValue(transactionSelectQuery),
      insert: vi.fn().mockReturnValue(transactionInsertQuery),
    };

    mockDatabase.db.select.mockReturnValue(selectQuery);
    mockDatabase.db.insert.mockReturnValue(insertQuery);
    mockDatabase.db.update.mockReturnValue(updateQuery);
    mockDatabase.db.transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    service = new StudentsService(mockDatabase as unknown as DatabaseService);
  });

  describe('create', () => {
    it('should reject when the user does not exist', async () => {
      selectQuery.limit.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDatabase.db.transaction).not.toHaveBeenCalled();
    });

    it('should reject when the department does not exist', async () => {
      selectQuery.limit
        .mockResolvedValueOnce([{ id: createDto.userId }])
        .mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDatabase.db.transaction).not.toHaveBeenCalled();
    });

    it('should reject when the student role does not exist', async () => {
      selectQuery.limit
        .mockResolvedValueOnce([{ id: createDto.userId }])
        .mockResolvedValueOnce([{ id: createDto.departmentId }])
        .mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDatabase.db.transaction).not.toHaveBeenCalled();
    });

    it('should reject when a student profile already exists for the user', async () => {
      selectQuery.limit
        .mockResolvedValueOnce([{ id: createDto.userId }])
        .mockResolvedValueOnce([{ id: createDto.departmentId }])
        .mockResolvedValueOnce([{ id: 'student-role-id' }])
        .mockResolvedValueOnce([{ id: 'existing-student-id' }]);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockDatabase.db.transaction).not.toHaveBeenCalled();
    });

    it('should create a student and assign the student role in a transaction', async () => {
      const createdStudent = {
        id: 'student-123',
        userId: createDto.userId,
        departmentId: createDto.departmentId,
        number: createDto.number,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        birth: createDto.birth,
        status: 'applicant',
        createdAt: new Date('2026-10-16T10:00:00.000Z'),
      };

      selectQuery.limit
        .mockResolvedValueOnce([{ id: createDto.userId }])
        .mockResolvedValueOnce([{ id: createDto.departmentId }])
        .mockResolvedValueOnce([{ id: 'student-role-id' }])
        .mockResolvedValueOnce([]);

      transactionSelectQuery.limit.mockResolvedValueOnce([]);

      transactionInsertQuery.returning.mockResolvedValueOnce([createdStudent]);

      await expect(service.create(createDto)).resolves.toEqual(createdStudent);

      expect(mockDatabase.db.transaction).toHaveBeenCalledOnce();
      expect(transaction.select).toHaveBeenCalledOnce();
      expect(transaction.insert).toHaveBeenCalledTimes(2);

      expect(transactionInsertQuery.values).toHaveBeenNthCalledWith(1, {
        userId: createDto.userId,
        roleId: 'student-role-id',
      });

      expect(transactionInsertQuery.values).toHaveBeenNthCalledWith(2, {
        userId: createDto.userId,
        departmentId: createDto.departmentId,
        number: createDto.number,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        birth: createDto.birth,
      });
    });

    it('should not duplicate the student role when it is already assigned', async () => {
      const createdStudent = {
        id: 'student-123',
        userId: createDto.userId,
        departmentId: createDto.departmentId,
        number: createDto.number,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        birth: createDto.birth,
        status: 'applicant',
        createdAt: new Date('2026-10-16T10:00:00.000Z'),
      };

      selectQuery.limit
        .mockResolvedValueOnce([{ id: createDto.userId }])
        .mockResolvedValueOnce([{ id: createDto.departmentId }])
        .mockResolvedValueOnce([{ id: 'student-role-id' }])
        .mockResolvedValueOnce([]);

      transactionSelectQuery.limit.mockResolvedValueOnce([
        { userId: createDto.userId },
      ]);

      transactionInsertQuery.returning.mockResolvedValueOnce([createdStudent]);

      await expect(service.create(createDto)).resolves.toEqual(createdStudent);

      expect(transaction.insert).toHaveBeenCalledOnce();
      expect(transactionInsertQuery.values).toHaveBeenCalledWith({
        userId: createDto.userId,
        departmentId: createDto.departmentId,
        number: createDto.number,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        birth: createDto.birth,
      });
    });

    it('should translate a unique-constraint violation into ConflictException', async () => {
      selectQuery.limit
        .mockResolvedValueOnce([{ id: createDto.userId }])
        .mockResolvedValueOnce([{ id: createDto.departmentId }])
        .mockResolvedValueOnce([{ id: 'student-role-id' }])
        .mockResolvedValueOnce([]);

      transactionSelectQuery.limit.mockResolvedValueOnce([]);

      transactionInsertQuery.returning.mockRejectedValueOnce(
        makeUniqueViolation(),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
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
