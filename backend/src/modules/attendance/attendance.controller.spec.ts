import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceStatus } from './dto/create-attendance.dto.js';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  const attendanceService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        {
          provide: AttendanceService,
          useValue: attendanceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    const result = [{ id: 'attendance-1' }];
    attendanceService.findAll.mockResolvedValue(result);

    await expect(controller.findAll()).resolves.toEqual(result);
    expect(attendanceService.findAll).toHaveBeenCalledOnce();
  });

  it('delegates findOne to the service', async () => {
    const result = { id: 'attendance-1' };
    attendanceService.findOne.mockResolvedValue(result);

    await expect(controller.findOne('attendance-1')).resolves.toEqual(result);
    expect(attendanceService.findOne).toHaveBeenCalledWith('attendance-1');
  });

  it('delegates create to the service', async () => {
    const dto = {
      enrollmentId: '11111111-1111-4111-8111-111111111111',
      sessionDate: '2026-10-17',
      status: AttendanceStatus.PRESENT,
      notes: 'On time',
    };
    const result = { id: 'attendance-1', ...dto };
    attendanceService.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);
    expect(attendanceService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const dto = {
      status: AttendanceStatus.LATE,
      notes: 'Arrived late',
    };
    const result = { id: 'attendance-1', ...dto };
    attendanceService.update.mockResolvedValue(result);

    await expect(controller.update('attendance-1', dto)).resolves.toEqual(
      result,
    );
    expect(attendanceService.update).toHaveBeenCalledWith('attendance-1', dto);
  });

  it('delegates remove to the service', async () => {
    const result = { id: 'attendance-1' };
    attendanceService.remove.mockResolvedValue(result);

    await expect(controller.remove('attendance-1')).resolves.toEqual(result);
    expect(attendanceService.remove).toHaveBeenCalledWith('attendance-1');
  });
});
