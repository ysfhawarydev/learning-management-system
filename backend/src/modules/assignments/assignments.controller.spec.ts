import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { AssignmentsController } from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';
import type { Request } from 'express';

describe('AssignmentsController', () => {
  let controller: AssignmentsController;

  const user: AuthenticatedUser = {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'student@example.com',
    roles: ['student'],
  };

  const request = { user } as Request & { user: AuthenticatedUser };

  const assignmentsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    submit: vi.fn(),
    findMySubmission: vi.fn(),
    review: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        {
          provide: AssignmentsService,
          useValue: assignmentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssignmentsController>(AssignmentsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create to the service with the authenticated user', async () => {
    const dto = {
      assessmentId: '22222222-2222-4222-8222-222222222222',
      instructions: 'Complete the assignment',
      dueAt: '2026-12-01T12:00:00.000Z',
      allowLateSubmissions: false,
    };
    const result = { id: 'assignment-1', ...dto };

    assignmentsService.create.mockResolvedValue(result);

    await expect(controller.create(dto, request)).resolves.toEqual(result);
    expect(assignmentsService.create).toHaveBeenCalledWith(dto, user);
  });

  it('delegates findAll to the service with the authenticated user', async () => {
    const result = [{ id: 'assignment-1' }];
    assignmentsService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(request)).resolves.toEqual(result);
    expect(assignmentsService.findAll).toHaveBeenCalledWith(user);
  });

  it('delegates findOne with the assignment ID and authenticated user', async () => {
    const assignmentId = '33333333-3333-4333-8333-333333333333';
    const result = { id: assignmentId };

    assignmentsService.findOne.mockResolvedValue(result);

    await expect(controller.findOne(assignmentId, request)).resolves.toEqual(
      result,
    );
    expect(assignmentsService.findOne).toHaveBeenCalledWith(assignmentId, user);
  });

  it('delegates submit with the assignment ID, DTO, and authenticated user', async () => {
    const assignmentId = '33333333-3333-4333-8333-333333333333';
    const dto = { content: 'My completed work' };
    const result = { id: 'submission-1', ...dto };

    assignmentsService.submit.mockResolvedValue(result);

    await expect(
      controller.submit(assignmentId, dto, request),
    ).resolves.toEqual(result);

    expect(assignmentsService.submit).toHaveBeenCalledWith(
      assignmentId,
      dto,
      user,
    );
  });

  it('delegates findMySubmission with the assignment ID and authenticated user', async () => {
    const assignmentId = '33333333-3333-4333-8333-333333333333';
    const result = { id: 'submission-1' };

    assignmentsService.findMySubmission.mockResolvedValue(result);

    await expect(
      controller.findMySubmission(assignmentId, request),
    ).resolves.toEqual(result);

    expect(assignmentsService.findMySubmission).toHaveBeenCalledWith(
      assignmentId,
      user,
    );
  });

  it('delegates review with both IDs, the DTO, and the authenticated user', async () => {
    const assignmentId = '33333333-3333-4333-8333-333333333333';
    const submissionId = '44444444-4444-4444-8444-444444444444';
    const dto = { score: 90, feedback: 'Well done' };
    const result = {
      submission: { id: submissionId },
      grade: { score: '90.00' },
    };

    assignmentsService.review.mockResolvedValue(result);

    await expect(
      controller.review(assignmentId, submissionId, dto, request),
    ).resolves.toEqual(result);

    expect(assignmentsService.review).toHaveBeenCalledWith(
      assignmentId,
      submissionId,
      dto,
      user,
    );
  });
});
