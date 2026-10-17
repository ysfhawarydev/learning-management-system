import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { TimetableController } from './timetable.controller.js';
import { TimetableService } from './timetable.service.js';

describe('TimetableController', () => {
  let controller: TimetableController;
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TimetableController],
      providers: [{ provide: TimetableService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TimetableController);
  });

  it('is defined', () => expect(controller).toBeDefined());
  it('delegates create', async () => {
    const dto = {
      courseOfferingId: 'id',
      dayOfWeek: 'monday',
      startTime: '09:00',
      endTime: '10:00',
    } as never;

    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll', async () => {
    await controller.findAll();
    expect(service.findAll).toHaveBeenCalledOnce();
  });

  it('delegates findOne', async () => {
    await controller.findOne('id');
    expect(service.findOne).toHaveBeenCalledWith('id');
  });

  it('delegates update', async () => {
    const dto = { room: 'A1' };
    await controller.update('id', dto);
    expect(service.update).toHaveBeenCalledWith('id', dto);
  });

  it('delegates remove', async () => {
    await controller.remove('id');
    expect(service.remove).toHaveBeenCalledWith('id');
  });
});
