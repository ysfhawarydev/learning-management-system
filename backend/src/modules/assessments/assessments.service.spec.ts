import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { AssessmentsService } from './assessments.service.js';

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
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

  const database = {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };

  const offeringId = '22222222-2222-4222-8222-222222222222';
  const assessmentId = '33333333-3333-4333-8333-333333333333';

  const assessment = {
    id: assessmentId,
    courseOfferingId: offeringId,
    name: 'Midterm Exam',
    type: 'midterm',
    maxScore: '100.00',
    weight: '30.00',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AssessmentsService(database as unknown as DatabaseService);

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
  });

  it('creates an assessment and formats numeric fields', async () => {
    mockReturning.mockResolvedValue([assessment]);

    await expect(
      service.create({
        courseOfferingId: offeringId,
        name: '  Midterm Exam  ',
        type: 'midterm',
        maxScore: 100,
        weight: 30,
      }),
    ).resolves.toEqual(assessment);

    expect(mockValues).toHaveBeenCalledWith({
      courseOfferingId: offeringId,
      name: 'Midterm Exam',
      type: 'midterm',
      maxScore: '100.00',
      weight: '30.00',
    });
  });

  it('rejects an assessment name that becomes empty after trimming', async () => {
    await expect(
      service.create({
        courseOfferingId: offeringId,
        name: '   ',
        type: 'quiz',
        maxScore: 10,
        weight: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects creation when the course offering does not exist', async () => {
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(
      service.create({
        courseOfferingId: offeringId,
        name: 'Quiz 1',
        type: 'quiz',
        maxScore: 10,
        weight: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps assessment check constraint errors to bad requests', async () => {
    mockReturning.mockRejectedValue({ code: '23514' });

    await expect(
      service.create({
        courseOfferingId: offeringId,
        name: 'Quiz 1',
        type: 'quiz',
        maxScore: 10,
        weight: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists assessments ordered by name', async () => {
    mockOrderBy.mockResolvedValue([assessment]);

    await expect(service.findAll()).resolves.toEqual([assessment]);
    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('retrieves an assessment by ID', async () => {
    mockLimit.mockResolvedValueOnce([assessment]);

    await expect(service.findOne(assessmentId)).resolves.toEqual(assessment);
  });

  it('throws when an assessment does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.findOne(assessmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates assessment fields and formats numeric values', async () => {
    mockUpdateReturning.mockResolvedValue([
      { ...assessment, name: 'Final Exam', maxScore: '80.50', weight: '40.25' },
    ]);

    await expect(
      service.update(assessmentId, {
        name: 'Final Exam',
        maxScore: 80.5,
        weight: 40.25,
      }),
    ).resolves.toMatchObject({
      name: 'Final Exam',
      maxScore: '80.50',
      weight: '40.25',
    });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Final Exam',
        maxScore: '80.50',
        weight: '40.25',
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('rejects an empty update', async () => {
    await expect(service.update(assessmentId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a name that becomes empty after trimming during update', async () => {
    await expect(
      service.update(assessmentId, { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws when updating a nonexistent assessment', async () => {
    mockUpdateReturning.mockResolvedValue([]);

    await expect(
      service.update(assessmentId, { name: 'Final Exam' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects updates referencing a nonexistent course offering', async () => {
    mockUpdateReturning.mockRejectedValue({ code: '23503' });

    await expect(
      service.update(assessmentId, { courseOfferingId: offeringId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes an assessment successfully', async () => {
    mockDeleteReturning.mockResolvedValue([{ id: assessmentId }]);

    await expect(service.remove(assessmentId)).resolves.toEqual({
      id: assessmentId,
    });
  });

  it('throws when deleting a nonexistent assessment', async () => {
    mockDeleteReturning.mockResolvedValue([]);

    await expect(service.remove(assessmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocks deletion when associated grades exist', async () => {
    mockDeleteReturning.mockRejectedValue({ code: '23503' });

    await expect(service.remove(assessmentId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('handles a nested PostgreSQL foreign key error when deleting', async () => {
    mockDeleteReturning.mockRejectedValue({
      cause: { code: '23503' },
    });

    await expect(service.remove(assessmentId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
