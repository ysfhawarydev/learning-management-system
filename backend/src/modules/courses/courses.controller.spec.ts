import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

describe('CoursesController', () => {
  let controller: CoursesController;

  const coursesService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    const result = [{ id: 'course-1' }];
    coursesService.findAll.mockResolvedValue(result);

    await expect(controller.findAll()).resolves.toEqual(result);
    expect(coursesService.findAll).toHaveBeenCalledOnce();
  });

  it('delegates findOne to the service', async () => {
    const result = { id: 'course-1' };
    coursesService.findOne.mockResolvedValue(result);

    await expect(controller.findOne('course-1')).resolves.toEqual(result);
    expect(coursesService.findOne).toHaveBeenCalledWith('course-1');
  });

  it('delegates create to the service', async () => {
    const dto = {
      departmentId: '11111111-1111-4111-8111-111111111111',
      code: 'CS101',
      title: 'Computer Science',
      creditValue: 3,
    };
    const result = { id: 'course-1', ...dto };
    coursesService.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);
    expect(coursesService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const dto = { title: 'Advanced Computer Science' };
    const result = { id: 'course-1', ...dto };
    coursesService.update.mockResolvedValue(result);

    await expect(controller.update('course-1', dto)).resolves.toEqual(result);

    expect(coursesService.update).toHaveBeenCalledWith('course-1', dto);
  });

  it('delegates remove to the service', async () => {
    const result = { message: 'Course deleted successfully' };
    coursesService.remove.mockResolvedValue(result);

    await expect(controller.remove('course-1')).resolves.toEqual(result);
    expect(coursesService.remove).toHaveBeenCalledWith('course-1');
  });
});
