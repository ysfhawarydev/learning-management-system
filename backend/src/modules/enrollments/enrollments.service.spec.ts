import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockSelectWhere = vi.fn(() => ({
    limit: mockLimit,
  }));

  const mockCountWhere = vi.fn();

  const mockSelectFrom = vi.fn(() => ({
    where: mockSelectWhere,
    orderBy: mockOrderBy,
  }));

  const mockCountFrom = vi.fn(() => ({
    where: mockCountWhere,
  }));

  const mockSelect = vi.fn((fields?: Record<string, unknown>) => ({
    from: fields && 'value' in fields ? mockCountFrom : mockSelectFrom,
  }));

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

  const mockExecute = vi.fn();
  const mockTransaction = vi.fn();

  const transaction = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    execute: mockExecute,
  };

  const database = {
    db: {
      select: mockSelect,
      delete: mockDelete,
      transaction: mockTransaction,
    },
  };

  const studentId = '11111111-1111-4111-8111-111111111111';
  const offeringId = '22222222-2222-4222-8222-222222222222';
  const enrollmentId = '33333333-3333-4333-8333-333333333333';

  const student = { id: studentId, deletedAt: null };

  const offering = {
    id: offeringId,
    capacity: 30,
  };

  const enrollment = {
    id: enrollmentId,
    studentId,
    courseOfferingId: offeringId,
    status: 'enrolled',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new EnrollmentsService(database as unknown as DatabaseService);

    mockCountWhere.mockResolvedValue([{ value: 0 }]);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

    mockTransaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    );
  });

  it('creates an enrollment successfully', async () => {
    mockLimit.mockResolvedValueOnce([student]).mockResolvedValueOnce([]);

    mockCountWhere.mockResolvedValueOnce([{ value: 0 }]);

    mockExecute.mockResolvedValue({ rows: [offering] });
    mockReturning.mockResolvedValue([enrollment]);

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).resolves.toEqual(enrollment);

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockExecute).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledWith({
      studentId,
      courseOfferingId: offeringId,
      status: 'enrolled',
    });
  });

  it('rejects a nonexistent student', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a soft-deleted student', async () => {
    mockLimit.mockResolvedValueOnce([{ id: studentId, deletedAt: new Date() }]);

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a nonexistent course offering', async () => {
    mockLimit.mockResolvedValueOnce([student]);
    mockExecute.mockResolvedValue({ rows: [] });

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate enrollments', async () => {
    mockLimit
      .mockResolvedValueOnce([student])
      .mockResolvedValueOnce([{ id: enrollmentId }]);

    mockExecute.mockResolvedValue({ rows: [offering] });

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects enrollment when the offering is full', async () => {
    mockLimit.mockResolvedValueOnce([student]).mockResolvedValueOnce([]);

    mockCountWhere.mockResolvedValueOnce([{ value: 30 }]);

    mockExecute.mockResolvedValue({ rows: [offering] });

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('allows an offering with unlimited capacity', async () => {
    mockLimit.mockResolvedValueOnce([student]).mockResolvedValueOnce([]);

    mockExecute.mockResolvedValue({
      rows: [{ id: offeringId, capacity: null }],
    });
    mockReturning.mockResolvedValue([enrollment]);

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).resolves.toEqual(enrollment);

    expect(mockValues).toHaveBeenCalledOnce();
  });

  it('lists enrollments ordered by enrollment date', async () => {
    mockOrderBy.mockResolvedValue([enrollment]);

    await expect(service.findAll()).resolves.toEqual([enrollment]);
    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('retrieves an enrollment by ID', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]);

    await expect(service.findOne(enrollmentId)).resolves.toEqual(enrollment);
  });

  it('throws when an enrollment does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.findOne(enrollmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates an enrollment status', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]);
    mockUpdateReturning.mockResolvedValue([
      { ...enrollment, status: 'completed' },
    ]);

    await expect(
      service.update(enrollmentId, { status: 'completed' }),
    ).resolves.toMatchObject({ status: 'completed' });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('throws when updating a nonexistent enrollment', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.update(enrollmentId, { status: 'completed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an enrollment successfully', async () => {
    mockDeleteReturning.mockResolvedValue([{ id: enrollmentId }]);

    await expect(service.remove(enrollmentId)).resolves.toEqual({
      id: enrollmentId,
    });
  });

  it('throws when deleting a nonexistent enrollment', async () => {
    mockDeleteReturning.mockResolvedValue([]);

    await expect(service.remove(enrollmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocks deletion when associated grades exist', async () => {
    mockDeleteReturning.mockRejectedValue({ code: '23503' });

    await expect(service.remove(enrollmentId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps duplicate enrollment database errors to a conflict', async () => {
    mockLimit.mockResolvedValueOnce([student]).mockResolvedValueOnce([]);

    mockCountWhere.mockResolvedValueOnce([{ value: 0 }]);

    mockExecute.mockResolvedValue({ rows: [offering] });
    mockReturning.mockRejectedValue({ code: '23505' });

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps invalid foreign keys to a bad request', async () => {
    mockLimit.mockResolvedValueOnce([student]).mockResolvedValueOnce([]);

    mockCountWhere.mockResolvedValueOnce([{ value: 0 }]);

    mockExecute.mockResolvedValue({ rows: [offering] });
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(
      service.create({
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handles PostgreSQL errors nested inside a cause', async () => {
    mockDeleteReturning.mockRejectedValue({
      cause: { code: '23503' },
    });

    await expect(service.remove(enrollmentId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
