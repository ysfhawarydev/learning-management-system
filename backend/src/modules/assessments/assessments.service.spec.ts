import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { AssessmentsService } from './assessments.service.js';

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockInnerJoin = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockSelectFrom = vi.fn(() => ({
    where: mockSelectWhere,
    orderBy: mockOrderBy,
    innerJoin: mockInnerJoin,
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
  const instructorId = '44444444-4444-4444-8444-444444444444';

  const assessment = {
    id: assessmentId,
    courseOfferingId: offeringId,
    name: 'Midterm Exam',
    type: 'midterm',
    maxScore: '100.00',
    weight: '30.00',
  };

  const adminUser = {
    sub: 'admin-user-id',
    roles: ['admin'],
  } as AuthenticatedUser;

  const instructorUser = {
    sub: 'instructor-user-id',
    roles: ['instructor'],
  } as AuthenticatedUser;

  const studentUser = {
    sub: 'student-user-id',
    roles: ['student'],
  } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AssessmentsService(database as unknown as DatabaseService);

    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
      innerJoin: mockInnerJoin,
    });
    mockSelectWhere.mockReturnValue({ limit: mockLimit });
    mockInnerJoin.mockReturnValue({
      where: vi.fn(() => ({
        orderBy: mockOrderBy,
        limit: mockLimit,
      })),
    });

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

  it('lists assessments ordered by name for an admin', async () => {
    mockOrderBy.mockResolvedValueOnce([assessment]);

    await expect(service.findAll(adminUser)).resolves.toEqual([assessment]);

    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('lists only the instructor assessments', async () => {
    mockLimit.mockResolvedValueOnce([{ id: instructorId }]);
    mockOrderBy.mockResolvedValueOnce([assessment]);

    await expect(service.findAll(instructorUser)).resolves.toEqual([
      assessment,
    ]);

    expect(mockLimit).toHaveBeenCalledOnce();
    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('forbids listing assessments for a student', async () => {
    await expect(service.findAll(studentUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('retrieves an assessment by ID for an admin', async () => {
    mockLimit.mockResolvedValueOnce([{ assessment, instructorId }]);

    await expect(service.findOne(assessmentId, adminUser)).resolves.toEqual(
      assessment,
    );
  });

  it('allows an instructor to retrieve their own assessment', async () => {
    mockLimit
      .mockResolvedValueOnce([{ assessment, instructorId }])
      .mockResolvedValueOnce([{ id: instructorId }]);

    await expect(
      service.findOne(assessmentId, instructorUser),
    ).resolves.toEqual(assessment);
  });

  it('forbids an instructor from retrieving another instructor assessment', async () => {
    mockLimit
      .mockResolvedValueOnce([
        { assessment, instructorId: 'other-instructor-id' },
      ])
      .mockResolvedValueOnce([{ id: instructorId }]);

    await expect(
      service.findOne(assessmentId, instructorUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when an assessment does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.findOne(assessmentId, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates assessment fields and formats numeric values', async () => {
    mockUpdateReturning.mockResolvedValue([
      {
        ...assessment,
        name: 'Final Exam',
        maxScore: '80.50',
        weight: '40.25',
      },
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
