import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceStatus } from './dto/create-attendance.dto.js';

describe('AttendanceService', () => {
  let service: AttendanceService;

  const mockLimit = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockOrderBy = vi.fn();

  const mockSelectFrom = vi.fn(() => ({
    where: mockSelectWhere,
    orderBy: mockOrderBy,
  }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({
    returning: mockUpdateReturning,
  }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

  const mockDeleteReturning = vi.fn();
  const mockDeleteWhere = vi.fn(() => ({
    returning: mockDeleteReturning,
  }));
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  const database = {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };

  const enrollmentId = '11111111-1111-4111-8111-111111111111';
  const attendanceId = '22222222-2222-4222-8222-222222222222';
  const sessionDate = '2026-10-17';

  const enrollment = { id: enrollmentId };

  const attendance = {
    id: attendanceId,
    enrollmentId,
    sessionDate,
    status: AttendanceStatus.PRESENT,
    notes: 'On time',
    recordedAt: new Date('2026-10-17T08:00:00.000Z'),
    createdAt: new Date('2026-10-17T08:00:00.000Z'),
    updatedAt: new Date('2026-10-17T08:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AttendanceService(database as unknown as DatabaseService);

    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockOrderBy,
    });
    mockSelectWhere.mockReturnValue({ limit: mockLimit });

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({
      returning: mockUpdateReturning,
    });

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({
      returning: mockDeleteReturning,
    });
  });

  it('creates an attendance record', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]);
    mockReturning.mockResolvedValueOnce([attendance]);

    await expect(
      service.create({
        enrollmentId,
        sessionDate,
        status: AttendanceStatus.PRESENT,
        notes: 'On time',
      }),
    ).resolves.toEqual(attendance);

    expect(mockValues).toHaveBeenCalledWith({
      enrollmentId,
      sessionDate,
      status: AttendanceStatus.PRESENT,
      notes: 'On time',
    });
  });

  it('creates an attendance record without notes', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]);
    mockReturning.mockResolvedValueOnce([{ ...attendance, notes: null }]);

    await service.create({
      enrollmentId,
      sessionDate,
      status: AttendanceStatus.PRESENT,
    });

    expect(mockValues).toHaveBeenCalledWith({
      enrollmentId,
      sessionDate,
      status: AttendanceStatus.PRESENT,
      notes: null,
    });
  });

  it('throws when the enrollment does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.create({
        enrollmentId,
        sessionDate,
        status: AttendanceStatus.PRESENT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('maps duplicate attendance errors to conflicts', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]);
    mockReturning.mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.create({
        enrollmentId,
        sessionDate,
        status: AttendanceStatus.PRESENT,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps foreign key errors during creation to bad requests', async () => {
    mockLimit.mockResolvedValueOnce([enrollment]);
    mockReturning.mockRejectedValueOnce({
      cause: { code: '23503' },
    });

    await expect(
      service.create({
        enrollmentId,
        sessionDate,
        status: AttendanceStatus.PRESENT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists attendance records ordered by date and creation time', async () => {
    mockOrderBy.mockResolvedValueOnce([attendance]);

    await expect(service.findAll()).resolves.toEqual([attendance]);

    expect(mockOrderBy).toHaveBeenCalledOnce();
  });

  it('retrieves an attendance record by ID', async () => {
    mockLimit.mockResolvedValueOnce([attendance]);

    await expect(service.findOne(attendanceId)).resolves.toEqual(attendance);
  });

  it('throws when retrieving a nonexistent attendance record', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.findOne(attendanceId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates attendance status and refreshes the timestamp', async () => {
    const updatedAttendance = {
      ...attendance,
      status: AttendanceStatus.LATE,
    };

    mockUpdateReturning.mockResolvedValueOnce([updatedAttendance]);

    await expect(
      service.update(attendanceId, {
        status: AttendanceStatus.LATE,
      }),
    ).resolves.toEqual(updatedAttendance);

    expect(mockUpdateSet).toHaveBeenCalledWith({
      status: AttendanceStatus.LATE,
      updatedAt: expect.any(Date),
    });
  });

  it('updates attendance notes', async () => {
    const updatedAttendance = {
      ...attendance,
      notes: 'Arrived late',
    };

    mockUpdateReturning.mockResolvedValueOnce([updatedAttendance]);

    await expect(
      service.update(attendanceId, {
        notes: 'Arrived late',
      }),
    ).resolves.toEqual(updatedAttendance);

    expect(mockUpdateSet).toHaveBeenCalledWith({
      notes: 'Arrived late',
      updatedAt: expect.any(Date),
    });
  });

  it('allows clearing attendance notes', async () => {
    mockUpdateReturning.mockResolvedValueOnce([{ ...attendance, notes: null }]);

    await service.update(attendanceId, { notes: null });

    expect(mockUpdateSet).toHaveBeenCalledWith({
      notes: null,
      updatedAt: expect.any(Date),
    });
  });

  it('rejects an update without any fields', async () => {
    await expect(service.update(attendanceId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws when updating a nonexistent attendance record', async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);

    await expect(
      service.update(attendanceId, {
        status: AttendanceStatus.ABSENT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate attendance errors during update to conflicts', async () => {
    mockUpdateReturning.mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.update(attendanceId, {
        sessionDate: '2026-10-18',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps foreign key errors during update to bad requests', async () => {
    mockUpdateReturning.mockRejectedValueOnce({
      cause: { code: '23503' },
    });

    await expect(
      service.update(attendanceId, {
        sessionDate: '2026-10-18',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes an attendance record successfully', async () => {
    mockDeleteReturning.mockResolvedValueOnce([{ id: attendanceId }]);

    await expect(service.remove(attendanceId)).resolves.toEqual({
      id: attendanceId,
    });
  });

  it('throws when deleting a nonexistent attendance record', async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);

    await expect(service.remove(attendanceId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
