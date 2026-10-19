import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';

describe('AssessmentsController', () => {
  let controller: AssessmentsController;

  const assessmentsService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const adminUser = {
    sub: 'admin-user-id',
    roles: ['admin'],
  } as AuthenticatedUser;

  const request = {
    user: adminUser,
  } as Request & { user: AuthenticatedUser };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [
        {
          provide: AssessmentsService,
          useValue: assessmentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssessmentsController>(AssessmentsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service with the authenticated user', async () => {
    const result = [{ id: 'assessment-1' }];
    assessmentsService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(request)).resolves.toEqual(result);
    expect(assessmentsService.findAll).toHaveBeenCalledWith(adminUser);
  });

  it('delegates findOne to the service with the authenticated user', async () => {
    const result = { id: 'assessment-1' };
    assessmentsService.findOne.mockResolvedValue(result);

    await expect(controller.findOne('assessment-1', request)).resolves.toEqual(
      result,
    );

    expect(assessmentsService.findOne).toHaveBeenCalledWith(
      'assessment-1',
      adminUser,
    );
  });

  it('delegates create to the service', async () => {
    const dto = {
      courseOfferingId: '22222222-2222-4222-8222-222222222222',
      name: 'Midterm Exam',
      type: 'midterm' as const,
      maxScore: 100,
      weight: 30,
    };
    const result = { id: 'assessment-1', ...dto };
    assessmentsService.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);
    expect(assessmentsService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const dto = { name: 'Updated Midterm' };
    const result = { id: 'assessment-1', ...dto };
    assessmentsService.update.mockResolvedValue(result);

    await expect(controller.update('assessment-1', dto)).resolves.toEqual(
      result,
    );

    expect(assessmentsService.update).toHaveBeenCalledWith('assessment-1', dto);
  });

  it('delegates remove to the service', async () => {
    const result = { id: 'assessment-1' };
    assessmentsService.remove.mockResolvedValue(result);

    await expect(controller.remove('assessment-1')).resolves.toEqual(result);
    expect(assessmentsService.remove).toHaveBeenCalledWith('assessment-1');
  });
});
