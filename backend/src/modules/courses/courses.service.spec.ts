import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { CoursesService } from './courses.service.js';

describe('CoursesService', () => {
  let service: CoursesService;

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

  const departmentId = '11111111-1111-4111-8111-111111111111';
  const courseId = '22222222-2222-4222-8222-222222222222';

  const course = {
    id: courseId,
    departmentId,
    code: 'CS101',
    title: 'Introduction to Computer Science',
    description: 'An introductory course',
    creditValue: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CoursesService(database as unknown as DatabaseService);
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

  it('creates a course with normalized code and trimmed fields', async () => {
    mockReturning.mockResolvedValue([course]);

    await expect(
      service.create({
        departmentId,
        code: ' cs101 ',
        title: ' Introduction to Computer Science ',
        description: ' An introductory course ',
        creditValue: 3,
      }),
    ).resolves.toEqual(course);

    expect(mockValues).toHaveBeenCalledWith({
      departmentId,
      code: 'CS101',
      title: 'Introduction to Computer Science',
      description: 'An introductory course',
      creditValue: 3,
    });
  });

  it('stores an omitted description as null', async () => {
    mockReturning.mockResolvedValue([course]);

    await service.create({
      departmentId,
      code: 'CS101',
      title: 'Introduction to Computer Science',
      creditValue: 3,
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it('rejects blank codes', async () => {
    await expect(
      service.create({
        departmentId,
        code: '   ',
        title: 'Computer Science',
        creditValue: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects blank titles', async () => {
    await expect(
      service.create({
        departmentId,
        code: 'CS101',
        title: '   ',
        creditValue: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate course codes to a conflict', async () => {
    mockReturning.mockRejectedValue({ code: '23505' });

    await expect(
      service.create({
        departmentId,
        code: 'CS101',
        title: 'Computer Science',
        creditValue: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps nonexistent departments to a bad request', async () => {
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(
      service.create({
        departmentId,
        code: 'CS101',
        title: 'Computer Science',
        creditValue: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists courses ordered by title', async () => {
    mockOrderBy.mockResolvedValue([course]);

    await expect(service.findAll()).resolves.toEqual([course]);
    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('retrieves a course by ID', async () => {
    mockLimit.mockResolvedValue([course]);

    await expect(service.findOne(courseId)).resolves.toEqual(course);
  });

  it('throws when a course does not exist', async () => {
    mockLimit.mockResolvedValue([]);

    await expect(service.findOne(courseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates course fields and normalizes code', async () => {
    mockReturning.mockResolvedValue([
      { ...course, code: 'CS202', title: 'Advanced Computer Science' },
    ]);

    await service.update(courseId, {
      code: ' cs202 ',
      title: 'Advanced Computer Science',
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CS202',
        title: 'Advanced Computer Science',
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('rejects an empty update', async () => {
    await expect(service.update(courseId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a blank updated title', async () => {
    await expect(
      service.update(courseId, { title: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when updating a nonexistent course', async () => {
    mockReturning.mockResolvedValue([]);

    await expect(
      service.update(courseId, { title: 'Updated course' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate codes during update to a conflict', async () => {
    mockReturning.mockRejectedValue({ code: '23505' });

    await expect(
      service.update(courseId, { code: 'CS102' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes a course successfully', async () => {
    mockReturning.mockResolvedValue([{ id: courseId }]);

    await expect(service.remove(courseId)).resolves.toEqual({
      message: 'Course deleted successfully',
    });
  });

  it('throws when deleting a nonexistent course', async () => {
    mockReturning.mockResolvedValue([]);

    await expect(service.remove(courseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prevents deleting a course referenced by offerings', async () => {
    mockReturning.mockRejectedValue({ code: '23503' });

    await expect(service.remove(courseId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
