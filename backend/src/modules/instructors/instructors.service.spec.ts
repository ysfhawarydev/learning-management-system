import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { InstructorsService } from './instructors.service.js';

describe('InstructorsService', () => {
  let service: InstructorsService;

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
    innerJoin: vi.fn(() => ({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
    })),
  }));
  const mockDeleteWhere = vi.fn(() => ({ returning: mockReturning }));

  const mockTransaction = vi.fn();

  const database = {
    db: {
      insert: vi.fn(() => ({ values: mockValues })),
      select: vi.fn(() => ({ from: mockSelectFrom })),
      update: vi.fn(() => ({ set: mockSet })),
      delete: vi.fn(() => ({ where: mockDeleteWhere })),
      transaction: mockTransaction,
    },
  };

  const userId = '11111111-1111-4111-8111-111111111111';
  const departmentId = '22222222-2222-4222-8222-222222222222';
  const instructorId = '33333333-3333-4333-8333-333333333333';
  const roleId = '44444444-4444-4444-8444-444444444444';

  const instructor = {
    id: instructorId,
    userId,
    departmentId,
    departmentName: 'Computer Science',
    employeeNumber: 'EMP10001',
    firstName: 'John',
    lastName: 'Doe',
    phone: '123456789',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createDto = {
    userId,
    departmentId,
    employeeNumber: 'EMP10001',
    firstName: 'John',
    lastName: 'Doe',
    phone: '123456789',
  };

  // Configures the transaction queries in the order used by create().
  function configureCreateTransaction({
    userExists = true,
    departmentExists = true,
    instructorExists = false,
    roleExists = true,
    assignedRole = false,
    insertedInstructor = instructor,
  }: {
    userExists?: boolean;
    departmentExists?: boolean;
    instructorExists?: boolean;
    roleExists?: boolean;
    assignedRole?: boolean;
    insertedInstructor?: typeof instructor | undefined;
  } = {}) {
    const transactionLimit = vi
      .fn()
      .mockResolvedValueOnce(userExists ? [{ id: userId }] : [])
      .mockResolvedValueOnce(departmentExists ? [{ id: departmentId }] : [])
      .mockResolvedValueOnce(instructorExists ? [{ id: instructorId }] : [])
      .mockResolvedValueOnce(roleExists ? [{ id: roleId }] : [])
      .mockResolvedValueOnce(assignedRole ? [{ userId }] : []);

    const transactionSelectWhere = vi.fn(() => ({
      limit: transactionLimit,
    }));

    const transactionSelectFrom = vi.fn(() => ({
      where: transactionSelectWhere,
    }));

    const transactionValues = vi.fn(() => ({
      returning: vi
        .fn()
        .mockResolvedValue(insertedInstructor ? [insertedInstructor] : []),
    }));

    const transaction = {
      select: vi.fn(() => ({
        from: transactionSelectFrom,
      })),
      insert: vi.fn(() => ({
        values: transactionValues,
      })),
    };

    mockTransaction.mockImplementationOnce(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    return { transaction, transactionValues };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    service = new InstructorsService(database as unknown as DatabaseService);

    mockValues.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
      innerJoin: vi.fn(() => ({
        where: mockSelectWhere,
        orderBy: mockOrderBy,
      })),
    });
    mockSelectWhere.mockReturnValue({ limit: mockLimit });
    mockDeleteWhere.mockReturnValue({ returning: mockReturning });
  });

  describe('create', () => {
    it('creates an instructor with trimmed fields', async () => {
      configureCreateTransaction();

      await expect(
        service.create({
          ...createDto,
          employeeNumber: ' EMP10001 ',
          firstName: ' John ',
          lastName: ' Doe ',
          phone: ' 123456789 ',
        }),
      ).resolves.toEqual(instructor);
    });

    it('stores an omitted phone as null', async () => {
      const { transactionValues } = configureCreateTransaction();

      await service.create({
        userId,
        departmentId,
        employeeNumber: 'EMP10001',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(transactionValues).toHaveBeenCalledWith({
        userId,
        departmentId,
        employeeNumber: 'EMP10001',
        firstName: 'John',
        lastName: 'Doe',
        phone: null,
      });
    });

    it('rejects a blank employee number', async () => {
      await expect(
        service.create({ ...createDto, employeeNumber: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rejects a blank first name', async () => {
      await expect(
        service.create({ ...createDto, firstName: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a blank last name', async () => {
      await expect(
        service.create({ ...createDto, lastName: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the user does not exist', async () => {
      configureCreateTransaction({ userExists: false });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when the department does not exist', async () => {
      configureCreateTransaction({ departmentExists: false });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an existing instructor profile for the user', async () => {
      configureCreateTransaction({ instructorExists: true });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws when the instructor role has not been seeded', async () => {
      configureCreateTransaction({ roleExists: false });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('assigns the instructor role when it is missing', async () => {
      const { transaction } = configureCreateTransaction();

      await service.create(createDto);

      expect(transaction.insert).toHaveBeenCalledTimes(2);
    });

    it('does not insert a duplicate instructor role assignment', async () => {
      const { transaction } = configureCreateTransaction({
        assignedRole: true,
      });

      await service.create(createDto);

      expect(transaction.insert).toHaveBeenCalledTimes(1);
    });

    it('maps duplicate employee numbers to a conflict', async () => {
      const { transaction } = configureCreateTransaction();
      const transactionValues = vi.fn(() => ({
        returning: vi.fn().mockRejectedValue({ code: '23505' }),
      }));

      transaction.insert = vi.fn(() => ({
        values: transactionValues,
      }));

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('maps foreign key violations to a bad request', async () => {
      mockTransaction.mockRejectedValue({ code: '23503' });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('returns instructors with department names', async () => {
      mockOrderBy.mockResolvedValue([instructor]);

      await expect(service.findAll()).resolves.toEqual([instructor]);
      expect(mockOrderBy).toHaveBeenCalledOnce();
    });
  });

  describe('findOne', () => {
    it('retrieves an instructor by ID', async () => {
      mockLimit.mockResolvedValue([instructor]);

      await expect(service.findOne(instructorId)).resolves.toEqual(instructor);
    });

    it('throws when the instructor does not exist', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.findOne(instructorId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates instructor fields and trims their values', async () => {
      mockReturning.mockResolvedValue([{ id: instructorId }]);
      mockLimit.mockResolvedValue([{ ...instructor, firstName: 'Jane' }]);

      await service.update(instructorId, {
        firstName: ' Jane ',
        employeeNumber: ' EMP10002 ',
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          employeeNumber: 'EMP10002',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('allows clearing the phone number', async () => {
      mockReturning.mockResolvedValue([{ id: instructorId }]);
      mockLimit.mockResolvedValue([{ ...instructor, phone: null }]);

      await service.update(instructorId, { phone: null });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ phone: null }),
      );
    });

    it('rejects an empty update', async () => {
      await expect(service.update(instructorId, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a blank employee number', async () => {
      await expect(
        service.update(instructorId, { employeeNumber: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a blank first name', async () => {
      await expect(
        service.update(instructorId, { firstName: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a blank last name', async () => {
      await expect(
        service.update(instructorId, { lastName: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the target instructor does not exist', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(
        service.update(instructorId, { firstName: 'Jane' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the new department does not exist', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(
        service.update(instructorId, { departmentId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps duplicate employee numbers to a conflict', async () => {
      mockReturning.mockRejectedValue({ code: '23505' });

      await expect(
        service.update(instructorId, { employeeNumber: 'EMP10002' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps foreign key violations to a bad request', async () => {
      mockLimit.mockResolvedValue([{ id: departmentId }]);
      mockReturning.mockRejectedValue({ code: '23503' });

      await expect(
        service.update(instructorId, { departmentId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes an instructor successfully', async () => {
      mockReturning.mockResolvedValue([{ id: instructorId }]);

      await expect(service.remove(instructorId)).resolves.toEqual({
        message: 'Instructor deleted successfully',
      });
    });

    it('throws when the instructor does not exist', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.remove(instructorId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('prevents deleting an instructor referenced by offerings', async () => {
      mockReturning.mockRejectedValue({ code: '23503' });

      await expect(service.remove(instructorId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('handles PostgreSQL restrict constraint errors', async () => {
      mockReturning.mockRejectedValue({ code: '23001' });

      await expect(service.remove(instructorId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
