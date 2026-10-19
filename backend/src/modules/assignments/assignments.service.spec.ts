import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { AssignmentsService } from './assignments.service.js';

describe('AssignmentsService', () => {
  let service: AssignmentsService;

  const studentUserId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const enrollmentId = '33333333-3333-4333-8333-333333333333';
  const assignmentId = '44444444-4444-4444-8444-444444444444';
  const assessmentId = '55555555-5555-4555-8555-555555555555';
  const offeringId = '66666666-6666-4666-8666-666666666666';
  const submissionId = '77777777-7777-4777-8777-777777777777';
  const instructorId = '88888888-8888-4888-8888-888888888888';
  const otherInstructorId = '99999999-9999-4999-8999-999999999999';

  const studentUser: AuthenticatedUser = {
    sub: studentUserId,
    email: 'student@example.com',
    roles: ['student'],
  };

  const adminUser: AuthenticatedUser = {
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'admin@example.com',
    roles: ['admin'],
  };

  const instructorUser: AuthenticatedUser = {
    sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'instructor@example.com',
    roles: ['instructor'],
  };

  const assignmentResult = {
    assignment: {
      id: assignmentId,
      assessmentId,
      instructions: 'Complete the assignment',
      dueAt: new Date(Date.now() + 60 * 60 * 1000),
      allowLateSubmissions: false,
    },
    assessment: {
      id: assessmentId,
      type: 'assignment',
      maxScore: '100.00',
    },
    courseOffering: {
      id: offeringId,
      instructorId,
    },
  };

  const student = { id: studentId };
  const enrollment = { id: enrollmentId };

  const savedSubmission = {
    id: submissionId,
    assignmentId,
    enrollmentId,
    content: 'My completed work',
    submissionUrl: null,
    submittedAt: new Date(),
    feedback: null,
    reviewedAt: null,
  };

  let selectChain: {
    innerJoin: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };

  const mockLimit = vi.fn();
  let limitResults: unknown[][] = [];

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();

  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();

  const mockUpdateWhere = vi.fn();
  const mockUpdateSet = vi.fn();
  const mockUpdate = vi.fn();

  const mockTransaction = vi.fn();

  const transactionDatabase = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };

  const database = {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      transaction: mockTransaction,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    limitResults = [];
    mockLimit.mockImplementation(async () => limitResults.shift() ?? []);

    selectChain = {
      innerJoin: vi.fn(() => selectChain),
      leftJoin: vi.fn(() => selectChain),
      where: vi.fn(() => selectChain),
      limit: mockLimit,
    };

    mockFrom.mockReturnValue(selectChain);
    mockSelect.mockReturnValue({ from: mockFrom });

    mockReturning.mockResolvedValue([savedSubmission]);
    mockOnConflictDoUpdate.mockReturnValue({
      returning: mockReturning,
    });
    mockValues.mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
      returning: mockReturning,
    });
    mockInsert.mockReturnValue({ values: mockValues });

    mockUpdateWhere.mockReturnValue({ returning: mockReturning });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    mockTransaction.mockImplementation(
      async (callback: (tx: typeof transactionDatabase) => unknown) =>
        callback(transactionDatabase),
    );

    service = new AssignmentsService(database as unknown as DatabaseService);
  });

  function queueStudentAndAssignmentLookups() {
    limitResults.push([student], [assignmentResult]);
  }

  it('resubmits work and clears the previous review and grade', async () => {
    queueStudentAndAssignmentLookups();
    limitResults.push([enrollment]);

    await expect(
      service.submit(
        assignmentId,
        { content: '  My updated work  ' },
        studentUser,
      ),
    ).resolves.toEqual(savedSubmission);

    expect(mockTransaction).toHaveBeenCalledOnce();

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId,
        enrollmentId,
        content: 'My updated work',
        submissionUrl: null,
        feedback: null,
        reviewedAt: null,
        submittedAt: expect.any(Date),
      }),
    );

    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          content: 'My updated work',
          feedback: null,
          reviewedAt: null,
          updatedAt: expect.any(Date),
        }),
      }),
    );

    expect(mockUpdate).toHaveBeenCalledOnce();

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        score: null,
        gradedAt: null,
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('rejects a submission containing only whitespace', async () => {
    limitResults.push([student]);

    await expect(
      service.submit(
        assignmentId,
        { content: '   ', submissionUrl: ' ' },
        studentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects submissions after the deadline when late work is disabled', async () => {
    limitResults.push(
      [student],
      [
        {
          ...assignmentResult,
          assignment: {
            ...assignmentResult.assignment,
            dueAt: new Date(Date.now() - 60 * 60 * 1000),
            allowLateSubmissions: false,
          },
        },
      ],
      [enrollment],
    );

    await expect(
      service.submit(assignmentId, { content: 'Completed work' }, studentUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('hides a previous grade until the submission has been reviewed', async () => {
    queueStudentAndAssignmentLookups();

    limitResults.push(
      [enrollment],
      [
        {
          submission: savedSubmission,
          grade: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            score: '85.00',
            gradedAt: new Date(),
          },
        },
      ],
    );

    const result = await service.findMySubmission(assignmentId, studentUser);

    expect(result).toMatchObject({
      submission: savedSubmission,
      grade: null,
    });
  });

  it('returns the grade when the submission has been reviewed', async () => {
    queueStudentAndAssignmentLookups();

    limitResults.push(
      [enrollment],
      [
        {
          submission: {
            ...savedSubmission,
            reviewedAt: new Date(),
          },
          grade: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            score: '85.00',
            gradedAt: new Date(),
          },
        },
      ],
    );

    const result = await service.findMySubmission(assignmentId, studentUser);

    expect(result?.grade).toMatchObject({
      score: '85.00',
    });
  });

  it('rejects a review score above the assessment maximum', async () => {
    limitResults.push([assignmentResult]);

    await expect(
      service.review(assignmentId, submissionId, { score: 100.01 }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects a score above the maximum supported grade value', async () => {
    limitResults.push([
      {
        ...assignmentResult,
        assessment: {
          ...assignmentResult.assessment,
          maxScore: '2000.00',
        },
      },
    ]);

    await expect(
      service.review(assignmentId, submissionId, { score: 1000 }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects students attempting to review submissions', async () => {
    limitResults.push([assignmentResult]);

    await expect(
      service.review(assignmentId, submissionId, { score: 85 }, studentUser),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects instructors who do not own the course offering', async () => {
    limitResults.push([assignmentResult], [{ id: otherInstructorId }]);

    await expect(
      service.review(assignmentId, submissionId, { score: 85 }, instructorUser),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('reviews a submission and saves its grade and feedback', async () => {
    const reviewedSubmission = {
      ...savedSubmission,
      feedback: 'Good work',
      reviewedAt: new Date(),
    };

    const savedGrade = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      enrollmentId,
      assessmentId,
      score: '85.00',
      gradedAt: new Date(),
    };

    limitResults.push(
      [assignmentResult],
      [savedSubmission],
      [{ id: enrollmentId, courseOfferingId: offeringId }],
    );

    mockReturning
      .mockResolvedValueOnce([reviewedSubmission])
      .mockResolvedValueOnce([savedGrade]);

    await expect(
      service.review(
        assignmentId,
        submissionId,
        { score: 85, feedback: '  Good work  ' },
        adminUser,
      ),
    ).resolves.toEqual({
      submission: reviewedSubmission,
      grade: savedGrade,
    });

    expect(mockTransaction).toHaveBeenCalledOnce();

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: 'Good work',
        reviewedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId,
        assessmentId,
        score: '85.00',
        gradedAt: expect.any(Date),
      }),
    );
  });

  it('returns not found when the submission does not exist', async () => {
    limitResults.push([assignmentResult], []);

    await expect(
      service.review(assignmentId, submissionId, { score: 85 }, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an instructor to review submissions for their own course', async () => {
    const reviewedSubmission = {
      ...savedSubmission,
      feedback: 'Well done',
      reviewedAt: new Date(),
    };

    const savedGrade = {
      enrollmentId,
      assessmentId,
      score: '90.00',
      gradedAt: new Date(),
    };

    limitResults.push(
      [assignmentResult],
      [{ id: instructorId }],
      [savedSubmission],
      [{ id: enrollmentId, courseOfferingId: offeringId }],
    );

    mockReturning
      .mockResolvedValueOnce([reviewedSubmission])
      .mockResolvedValueOnce([savedGrade]);

    await expect(
      service.review(
        assignmentId,
        submissionId,
        { score: 90, feedback: 'Well done' },
        instructorUser,
      ),
    ).resolves.toEqual({
      submission: reviewedSubmission,
      grade: savedGrade,
    });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: 'Well done',
        reviewedAt: expect.any(Date),
      }),
    );
  });

  it('rejects reviewing a submission from another course offering', async () => {
    limitResults.push(
      [assignmentResult],
      [savedSubmission],
      [
        {
          id: enrollmentId,
          courseOfferingId: otherInstructorId,
        },
      ],
    );

    await expect(
      service.review(assignmentId, submissionId, { score: 85 }, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
