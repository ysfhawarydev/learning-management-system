import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { GradesController } from './grades.controller.js';
import { GradesService } from './grades.service.js';

describe('GradesController', () => {
  let controller: GradesController;

  const gradesService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradesController],
      providers: [
        {
          provide: GradesService,
          useValue: gradesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GradesController>(GradesController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    const result = [{ id: 'grade-1' }];
    gradesService.findAll.mockResolvedValue(result);

    await expect(controller.findAll()).resolves.toEqual(result);
    expect(gradesService.findAll).toHaveBeenCalledOnce();
  });

  it('delegates findOne to the service', async () => {
    const result = { id: 'grade-1' };
    gradesService.findOne.mockResolvedValue(result);

    await expect(controller.findOne('grade-1')).resolves.toEqual(result);
    expect(gradesService.findOne).toHaveBeenCalledWith('grade-1');
  });

  it('delegates create to the service', async () => {
    const dto = {
      enrollmentId: '11111111-1111-4111-8111-111111111111',
      assessmentId: '22222222-2222-4222-8222-222222222222',
      score: 85,
    };
    const result = { id: 'grade-1', ...dto };
    gradesService.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);
    expect(gradesService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const dto = { score: 90 };
    const result = { id: 'grade-1', ...dto };
    gradesService.update.mockResolvedValue(result);

    await expect(controller.update('grade-1', dto)).resolves.toEqual(result);
    expect(gradesService.update).toHaveBeenCalledWith('grade-1', dto);
  });

  it('delegates remove to the service', async () => {
    const result = { id: 'grade-1' };
    gradesService.remove.mockResolvedValue(result);

    await expect(controller.remove('grade-1')).resolves.toEqual(result);
    expect(gradesService.remove).toHaveBeenCalledWith('grade-1');
  });
});
