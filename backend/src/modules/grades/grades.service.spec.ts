import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { GradesService } from './grades.service.js';

describe('GradesService', () => {
  let service: GradesService;

  const mockLimit = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockOrderBy = vi.fn();

  const mockSelectFrom = vi.fn(() => ({
    where: mockSelectWhere,
    orderBy: mockOrderBy,
  }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

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

  const transaction = vi.fn();

  const tx = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };

  const database = {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      transaction,
    },
  };

  const enrollmentId = '11111111-1111-4111-8111-111111111111';
  const assessmentId = '22222222-2222-4222-8222-222222222222';
  const gradeId = '33333333-3333-4333-8333-333333333333';
  const offeringId = '44444444-4444-4444-8444-444444444444';

  const enrollment = {
    id: enrollmentId,
    courseOfferingId: offeringId,
  };

  const assessment = {
    id: assessmentId,
    courseOfferingId: offeringId,
    maxScore: '100.00',
  };

  const grade = {
    id: gradeId,
    enrollmentId,
    assessmentId,
    score: '85.00',
    gradedAt: new Date('2026-01-01T12:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new GradesService(database as unknown as DatabaseService);

    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
    });
    mockSelectWhere.mockReturnValue({ limit: mockLimit });

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

    transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
  });

  it('creates a graded record and formats the score', async () => {
    mockLimit
      .mockResolvedValueOnce([enrollment])
      .mockResolvedValueOnce([assessment]);
    mockReturning.mockResolvedValueOnce([grade]);

    await expect(
      service.create({ enrollmentId, assessmentId, score: 85 }),
    ).resolves.toEqual(grade);

    expect(mockValues).toHaveBeenCalledWith({
      enrollmentId,
      assessmentId,
      score: '85.00',
      gradedAt: expect.any(Date),
    });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('creates an ungraded record when score is omitted', async () => {
    mockLimit
      .mockResolvedValueOnce([enrollment])
      .mockResolvedValueOnce([assessment]);
    mockReturning.mockResolvedValueOnce([
      { ...grade, score: null, gradedAt: null },
    ]);

    await service.create({ enrollmentId, assessmentId });

    expect(mockValues).toHaveBeenCalledWith({
      enrollmentId,
      assessmentId,
      score: null,
      gradedAt: null,
    });
  });

  it('allows a score of zero', async () => {
    mockLimit
      .mockResolvedValueOnce([enrollment])
      .mockResolvedValueOnce([assessment]);
    mockReturning.mockResolvedValueOnce([{ ...grade, score: '0.00' }]);

    await service.create({ enrollmentId, assessmentId, score: 0 });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ score: '0.00' }),
    );
  });

  it('throws when the enrollment does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.create({ enrollmentId, assessmentId, score: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws when the assessment does not exist', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]).mockResolvedValueOnce([]);

    await expect(
      service.create({ enrollmentId, assessmentId, score: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects an enrollment and assessment from different offerings', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]).mockResolvedValueOnce([
      {
        ...assessment,
        courseOfferingId: '55555555-5555-4555-8555-555555555555',
      },
    ]);

    await expect(
      service.create({ enrollmentId, assessmentId, score: 50 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects a score above the assessment maximum', async () => {
    mockLimit
      .mockResolvedValueOnce([enrollment])
      .mockResolvedValueOnce([assessment]);

    await expect(
      service.create({ enrollmentId, assessmentId, score: 100.01 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('maps duplicate grade errors to conflicts', async () => {
    mockLimit
      .mockResolvedValueOnce([enrollment])
      .mockResolvedValueOnce([assessment]);
    mockReturning.mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.create({ enrollmentId, assessmentId, score: 50 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps foreign key errors during creation to bad requests', async () => {
    mockLimit
      .mockResolvedValueOnce([enrollment])
      .mockResolvedValueOnce([assessment]);
    mockReturning.mockRejectedValueOnce({ cause: { code: '23503' } });

    await expect(
      service.create({ enrollmentId, assessmentId, score: 50 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists grades ordered by creation time', async () => {
    mockOrderBy.mockResolvedValueOnce([grade]);

    await expect(service.findAll()).resolves.toEqual([grade]);
    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('retrieves a grade by ID', async () => {
    mockLimit.mockResolvedValueOnce([grade]);

    await expect(service.findOne(gradeId)).resolves.toEqual(grade);
  });

  it('throws when retrieving a nonexistent grade', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.findOne(gradeId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a score and refreshes timestamps', async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: gradeId, assessmentId }])
      .mockResolvedValueOnce([{ maxScore: '100.00' }]);
    mockUpdateReturning.mockResolvedValueOnce([{ ...grade, score: '90.00' }]);

    await expect(service.update(gradeId, { score: 90 })).resolves.toMatchObject(
      { score: '90.00' },
    );

    expect(mockUpdateSet).toHaveBeenCalledWith({
      score: '90.00',
      gradedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('clears the score to make a grade ungraded', async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: gradeId, assessmentId }])
      .mockResolvedValueOnce([{ maxScore: '100.00' }]);
    mockUpdateReturning.mockResolvedValueOnce([
      { ...grade, score: null, gradedAt: null },
    ]);

    await service.update(gradeId, { score: null });

    expect(mockUpdateSet).toHaveBeenCalledWith({
      score: null,
      gradedAt: null,
      updatedAt: expect.any(Date),
    });
  });

  it('rejects an update without a score field', async () => {
    await expect(service.update(gradeId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(transaction).not.toHaveBeenCalled();
  });

  it('throws when updating a nonexistent grade', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.update(gradeId, { score: 50 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when the grade assessment does not exist', async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: gradeId, assessmentId }])
      .mockResolvedValueOnce([]);

    await expect(service.update(gradeId, { score: 50 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an updated score above the assessment maximum', async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: gradeId, assessmentId }])
      .mockResolvedValueOnce([{ maxScore: '80.00' }]);

    await expect(service.update(gradeId, { score: 90 })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('maps database check constraint errors during update', async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: gradeId, assessmentId }])
      .mockResolvedValueOnce([{ maxScore: '100.00' }]);
    mockUpdateReturning.mockRejectedValueOnce({ code: '23514' });

    await expect(service.update(gradeId, { score: 50 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deletes a grade successfully', async () => {
    mockDeleteReturning.mockResolvedValueOnce([{ id: gradeId }]);

    await expect(service.remove(gradeId)).resolves.toEqual({ id: gradeId });
  });

  it('throws when deleting a nonexistent grade', async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);

    await expect(service.remove(gradeId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
