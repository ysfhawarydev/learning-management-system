import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

describe('DepartmentsController', () => {
  let controller: DepartmentsController;

  const departmentsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DepartmentsService,
          useValue: departmentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns all departments', async () => {
    const expected = [{ id: 'department-id', code: 'CS' }];
    departmentsService.findAll.mockResolvedValue(expected);

    await expect(controller.findAll()).resolves.toEqual(expected);
    expect(departmentsService.findAll).toHaveBeenCalledOnce();
  });

  it('returns one department', async () => {
    const expected = { id: 'department-id', code: 'CS' };
    departmentsService.findOne.mockResolvedValue(expected);

    await expect(controller.findOne('department-id')).resolves.toEqual(
      expected,
    );
    expect(departmentsService.findOne).toHaveBeenCalledWith('department-id');
  });

  it('creates a department', async () => {
    const dto = { code: 'CS', name: 'Computer Science' };
    const expected = { id: 'department-id', ...dto };
    departmentsService.create.mockResolvedValue(expected);

    await expect(controller.create(dto)).resolves.toEqual(expected);
    expect(departmentsService.create).toHaveBeenCalledWith(dto);
  });

  it('updates a department', async () => {
    const dto = { name: 'Computing' };
    const expected = { id: 'department-id', name: 'Computing' };
    departmentsService.update.mockResolvedValue(expected);

    await expect(controller.update('department-id', dto)).resolves.toEqual(
      expected,
    );
    expect(departmentsService.update).toHaveBeenCalledWith(
      'department-id',
      dto,
    );
  });

  it('deletes a department', async () => {
    const expected = { message: 'Department deleted successfully' };
    departmentsService.remove.mockResolvedValue(expected);

    await expect(controller.remove('department-id')).resolves.toEqual(expected);
    expect(departmentsService.remove).toHaveBeenCalledWith('department-id');
  });
});
