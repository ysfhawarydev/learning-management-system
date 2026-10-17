import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CourseOfferingsController } from './course-offerings.controller.js';
import { CourseOfferingsService } from './course-offerings.service.js';

describe('CourseOfferingsController', () => {
  let controller: CourseOfferingsController;

  const courseOfferingsService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseOfferingsController],
      providers: [
        {
          provide: CourseOfferingsService,
          useValue: courseOfferingsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CourseOfferingsController>(
      CourseOfferingsController,
    );
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    const result = [{ id: 'offering-1' }];
    courseOfferingsService.findAll.mockResolvedValue(result);

    await expect(controller.findAll()).resolves.toEqual(result);
    expect(courseOfferingsService.findAll).toHaveBeenCalledOnce();
  });

  it('delegates findOne to the service', async () => {
    const result = { id: 'offering-1' };
    courseOfferingsService.findOne.mockResolvedValue(result);

    await expect(controller.findOne('offering-1')).resolves.toEqual(result);
    expect(courseOfferingsService.findOne).toHaveBeenCalledWith('offering-1');
  });

  it('delegates create to the service', async () => {
    const dto = {
      courseId: '11111111-1111-4111-8111-111111111111',
      semesterId: '22222222-2222-4222-8222-222222222222',
      instructorId: '33333333-3333-4333-8333-333333333333',
      sectionCode: 'A',
      capacity: 30,
    };
    const result = { id: 'offering-1', ...dto };
    courseOfferingsService.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);
    expect(courseOfferingsService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const dto = { capacity: 40 };
    const result = { id: 'offering-1', ...dto };
    courseOfferingsService.update.mockResolvedValue(result);

    await expect(controller.update('offering-1', dto)).resolves.toEqual(result);
    expect(courseOfferingsService.update).toHaveBeenCalledWith(
      'offering-1',
      dto,
    );
  });

  it('delegates remove to the service', async () => {
    const result = { message: 'Course offering deleted successfully' };
    courseOfferingsService.remove.mockResolvedValue(result);

    await expect(controller.remove('offering-1')).resolves.toEqual(result);
    expect(courseOfferingsService.remove).toHaveBeenCalledWith('offering-1');
  });
});
