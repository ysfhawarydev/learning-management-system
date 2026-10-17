import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsController', () => {
  let controller: EnrollmentsController;

  const enrollmentsService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [
        {
          provide: EnrollmentsService,
          useValue: enrollmentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EnrollmentsController>(EnrollmentsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    const result = [{ id: 'enrollment-1' }];
    enrollmentsService.findAll.mockResolvedValue(result);

    await expect(controller.findAll()).resolves.toEqual(result);
    expect(enrollmentsService.findAll).toHaveBeenCalledOnce();
  });

  it('delegates findOne to the service', async () => {
    const result = { id: 'enrollment-1' };
    enrollmentsService.findOne.mockResolvedValue(result);

    await expect(controller.findOne('enrollment-1')).resolves.toEqual(result);
    expect(enrollmentsService.findOne).toHaveBeenCalledWith('enrollment-1');
  });

  it('delegates create to the service', async () => {
    const dto = {
      studentId: '11111111-1111-4111-8111-111111111111',
      courseOfferingId: '22222222-2222-4222-8222-222222222222',
      status: 'enrolled' as const,
    };
    const result = { id: 'enrollment-1', ...dto };
    enrollmentsService.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);
    expect(enrollmentsService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const dto = { status: 'completed' as const };
    const result = { id: 'enrollment-1', ...dto };
    enrollmentsService.update.mockResolvedValue(result);

    await expect(controller.update('enrollment-1', dto)).resolves.toEqual(
      result,
    );
    expect(enrollmentsService.update).toHaveBeenCalledWith('enrollment-1', dto);
  });

  it('delegates remove to the service', async () => {
    const result = { message: 'Enrollment deleted successfully' };
    enrollmentsService.remove.mockResolvedValue(result);

    await expect(controller.remove('enrollment-1')).resolves.toEqual(result);
    expect(enrollmentsService.remove).toHaveBeenCalledWith('enrollment-1');
  });
});
