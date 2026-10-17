import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { DepartmentsService } from './departments.service.js';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const database = {
    db: mockDb,
  } as unknown as DatabaseService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DepartmentsService(database);
  });

  function mockSelect(result: unknown[]) {
    const limit = vi.fn().mockResolvedValue(result);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });

    mockDb.select.mockReturnValue({ from });

    return { from, where, limit };
  }

  function mockInsert(result: unknown[]) {
    const returning = vi.fn().mockResolvedValue(result);
    const values = vi.fn().mockReturnValue({ returning });

    mockDb.insert.mockReturnValue({ values });

    return { values, returning };
  }

  function mockUpdate(result: unknown[]) {
    const returning = vi.fn().mockResolvedValue(result);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });

    mockDb.update.mockReturnValue({ set });

    return { set, where, returning };
  }

  function mockDelete(result: unknown[]) {
    const returning = vi.fn().mockResolvedValue(result);
    const where = vi.fn().mockReturnValue({ returning });

    mockDb.delete.mockReturnValue({ where });

    return { where, returning };
  }

  function postgresError(code: string) {
    return Object.assign(new Error('Database error'), { code });
  }

  describe('create', () => {
    it('creates a department with normalized code and trimmed fields', async () => {
      const dto = {
        code: ' cs ',
        name: ' Computer Science ',
        description: ' Department description ',
      };

      const expected = {
        id: 'department-id',
        code: 'CS',
        name: 'Computer Science',
        description: 'Department description',
      };

      const { values } = mockInsert([expected]);

      await expect(service.create(dto)).resolves.toEqual(expected);

      expect(values).toHaveBeenCalledWith({
        code: 'CS',
        name: 'Computer Science',
        description: 'Department description',
      });
    });

    it('rejects an empty code', async () => {
      await expect(
        service.create({ code: '  ', name: 'Computer Science' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty name', async () => {
      await expect(service.create({ code: 'CS', name: '  ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects duplicate department codes', async () => {
      mockInsert([]).returning.mockRejectedValue(postgresError('23505'));

      await expect(
        service.create({ code: 'CS', name: 'Computer Science' }),
      ).rejects.toThrow(ConflictException);
    });

    it('stores an omitted description as null', async () => {
      const { values } = mockInsert([{ id: 'department-id' }]);

      await service.create({ code: 'CS', name: 'Computer Science' });

      expect(values).toHaveBeenCalledWith({
        code: 'CS',
        name: 'Computer Science',
        description: null,
      });
    });
  });

  describe('findAll', () => {
    it('returns all departments ordered by name', async () => {
      const expected = [{ id: 'department-id', name: 'Computer Science' }];
      const orderBy = vi.fn().mockResolvedValue(expected);
      const from = vi.fn().mockReturnValue({ orderBy });

      mockDb.select.mockReturnValue({ from });

      await expect(service.findAll()).resolves.toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('returns the matching department', async () => {
      const expected = { id: 'department-id', code: 'CS' };
      mockSelect([expected]);

      await expect(service.findOne('department-id')).resolves.toEqual(expected);
    });

    it('throws when the department does not exist', async () => {
      mockSelect([]);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates and normalizes provided fields', async () => {
      const expected = { id: 'department-id', code: 'CS', name: 'Computing' };
      const { set } = mockUpdate([expected]);

      await expect(
        service.update('department-id', {
          code: ' cs ',
          name: ' Computing ',
        }),
      ).resolves.toEqual(expected);

      expect(set).toHaveBeenCalledWith({
        code: 'CS',
        name: 'Computing',
        updatedAt: expect.any(Date),
      });
    });

    it('rejects an empty update', async () => {
      await expect(service.update('department-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a blank name', async () => {
      await expect(
        service.update('department-id', { name: '  ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the department does not exist', async () => {
      mockUpdate([]);

      await expect(
        service.update('missing-id', { name: 'Computing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects duplicate department codes', async () => {
      mockUpdate([]).returning.mockRejectedValue(postgresError('23505'));

      await expect(
        service.update('department-id', { code: 'CS' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes the department and returns a success message', async () => {
      mockDelete([{ id: 'department-id' }]);

      await expect(service.remove('department-id')).resolves.toEqual({
        message: 'Department deleted successfully',
      });
    });

    it('throws when the department does not exist', async () => {
      mockDelete([]);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects deletion when a foreign key references the department', async () => {
      mockDelete([]).returning.mockRejectedValue(postgresError('23503'));

      await expect(service.remove('department-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
