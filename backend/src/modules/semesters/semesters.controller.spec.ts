import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SemestersController } from './semesters.controller.js';
import { SemestersService } from './semesters.service.js';

describe('SemestersController', () => {
  let controller: SemestersController;

  const semestersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const semesterId = '11111111-1111-4111-8111-111111111111';

  const semester = {
    id: semesterId,
    academicYear: '2026-2027',
    term: 'fall',
    status: 'planned',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemestersController],
      providers: [
        {
          provide: SemestersService,
          useValue: semestersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: vi.fn(() => true) })
      .compile();

    controller = module.get<SemestersController>(SemestersController);
  });

  it('creates a semester', async () => {
    const dto = {
      academicYear: '2026-2027',
      term: 'fall' as const,
      startDate: '2026-09-01',
      endDate: '2026-12-31',
    };

    semestersService.create.mockResolvedValue(semester);

    await expect(controller.create(dto)).resolves.toEqual(semester);
    expect(semestersService.create).toHaveBeenCalledWith(dto);
  });

  it('returns all semesters', async () => {
    semestersService.findAll.mockResolvedValue([semester]);

    await expect(controller.findAll()).resolves.toEqual([semester]);
    expect(semestersService.findAll).toHaveBeenCalledOnce();
  });

  it('returns a semester by ID', async () => {
    semestersService.findOne.mockResolvedValue(semester);

    await expect(controller.findOne(semesterId)).resolves.toEqual(semester);
    expect(semestersService.findOne).toHaveBeenCalledWith(semesterId);
  });

  it('updates a semester by ID', async () => {
    const dto = { status: 'active' as const };
    const updatedSemester = { ...semester, status: 'active' };

    semestersService.update.mockResolvedValue(updatedSemester);

    await expect(controller.update(semesterId, dto)).resolves.toEqual(
      updatedSemester,
    );

    expect(semestersService.update).toHaveBeenCalledWith(semesterId, dto);
  });

  it('deletes a semester by ID', async () => {
    const result = { message: 'Semester deleted successfully' };

    semestersService.remove.mockResolvedValue(result);

    await expect(controller.remove(semesterId)).resolves.toEqual(result);
    expect(semestersService.remove).toHaveBeenCalledWith(semesterId);
  });
});
