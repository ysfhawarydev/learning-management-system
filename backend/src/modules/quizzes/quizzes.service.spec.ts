import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../database/database.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { QuizzesService } from './quizzes.service.js';

describe('QuizzesService', () => {
  let service: QuizzesService;

  const userId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const enrollmentId = '33333333-3333-4333-8333-333333333333';
  const assessmentId = '44444444-4444-4444-8444-444444444444';
  const question1Id = '55555555-5555-4555-8555-555555555555';
  const question2Id = '66666666-6666-4666-8666-666666666666';
  const option1Id = '77777777-7777-4777-8777-777777777777';
  const option2Id = '88888888-8888-4888-8888-888888888888';
  const attemptId = '99999999-9999-4999-8999-999999999999';
  const gradeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const instructorId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const otherInstructorId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  const studentUser: AuthenticatedUser = {
    sub: userId,
    email: 'student@example.com',
    roles: ['student'],
  };

  const adminUser: AuthenticatedUser = {
    sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    email: 'admin@example.com',
    roles: ['admin'],
  };

  const instructorUser: AuthenticatedUser = {
    sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    email: 'instructor@example.com',
    roles: ['instructor'],
  };

  const student = { id: studentId };
  const enrollment = { id: enrollmentId };

  const assessment = {
    id: assessmentId,
    maxScore: '100.00',
    type: 'quiz',
    courseOfferingId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };

  const questions = [
    { id: question1Id, assessmentId, prompt: 'Question 1', position: 0 },
    { id: question2Id, assessmentId, prompt: 'Question 2', position: 1 },
  ];

  const attempt = {
    id: attemptId,
    assessmentId,
    enrollmentId,
    answers: [
      { questionId: question1Id, optionId: option1Id },
      { questionId: question2Id, optionId: option2Id },
    ],
    score: '50.00',
    totalQuestions: 2,
    correctAnswers: 1,
  };

  const grade = {
    id: gradeId,
    enrollmentId,
    assessmentId,
    score: '50.00',
    gradedAt: new Date(),
  };

  const quizDto = {
    assessmentId,
    questions: [
      {
        prompt: 'What is 2 + 2?',
        position: 0,
        options: [
          { text: 'Four', position: 0, isCorrect: true },
          { text: 'Five', position: 1, isCorrect: false },
        ],
      },
    ],
  };

  let limitResults: unknown[][];
  let whereResults: unknown[][];
  let returningResults: unknown[][];

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();

  const mockReturning = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();
  const mockTransaction = vi.fn();

  const transactionDatabase = {
    insert: mockInsert,
  };

  function createQueryChain() {
    const chain = {
      innerJoin: vi.fn(),
      where: vi.fn(),
    };

    chain.innerJoin.mockReturnValue(chain);

    chain.where.mockImplementation(() => {
      let terminalUsed = false;

      const query = new Promise<unknown[]>((resolve) => {
        queueMicrotask(() => {
          if (!terminalUsed) {
            resolve(whereResults.shift() ?? []);
          }
        });
      }) as Promise<unknown[]> & {
        limit: () => Promise<unknown[]>;
        orderBy: () => Promise<unknown[]>;
      };

      query.limit = async () => {
        terminalUsed = true;
        return limitResults.shift() ?? [];
      };

      query.orderBy = async () => {
        terminalUsed = true;
        return whereResults.shift() ?? [];
      };

      return query;
    });

    return chain;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    limitResults = [];
    whereResults = [];
    returningResults = [];

    mockFrom.mockImplementation(() => createQueryChain());
    mockSelect.mockReturnValue({ from: mockFrom });

    mockReturning.mockImplementation(
      async () => returningResults.shift() ?? [],
    );
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    mockTransaction.mockImplementation(
      async (callback: (tx: typeof transactionDatabase) => unknown) =>
        callback(transactionDatabase),
    );

    service = new QuizzesService({
      db: {
        select: mockSelect,
        transaction: mockTransaction,
      },
    } as unknown as DatabaseService);
  });

  function queueSubmissionLookups() {
    limitResults.push([student], [assessment], [enrollment]);
    whereResults.push(questions);
  }

  function queueOptions(firstCorrect: boolean, secondCorrect: boolean) {
    limitResults.push(
      [{ id: option1Id, isCorrect: firstCorrect }],
      [{ id: option2Id, isCorrect: secondCorrect }],
    );
  }

  function queueSuccessfulWrites() {
    returningResults.push([attempt], [grade]);
  }

  it('calculates the score and saves the attempt and grade transactionally', async () => {
    queueSubmissionLookups();
    queueOptions(true, false);
    queueSuccessfulWrites();

    const result = await service.submit(
      assessmentId,
      {
        answers: [
          { questionId: question1Id, optionId: option1Id },
          { questionId: question2Id, optionId: option2Id },
        ],
      },
      studentUser,
    );

    expect(result).toEqual({ attempt, grade });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockInsert).toHaveBeenCalledTimes(2);

    expect(mockValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        assessmentId,
        enrollmentId,
        score: '50.00',
        totalQuestions: 2,
        correctAnswers: 1,
      }),
    );

    expect(mockValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        assessmentId,
        enrollmentId,
        score: '50.00',
        gradedAt: expect.any(Date),
      }),
    );
  });

  it('awards the full score when every answer is correct', async () => {
    queueSubmissionLookups();
    queueOptions(true, true);
    queueSuccessfulWrites();

    await service.submit(
      assessmentId,
      {
        answers: [
          { questionId: question1Id, optionId: option1Id },
          { questionId: question2Id, optionId: option2Id },
        ],
      },
      studentUser,
    );

    expect(mockValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        score: '100.00',
        correctAnswers: 2,
        totalQuestions: 2,
      }),
    );
  });

  it('rejects students without an active enrollment', async () => {
    limitResults.push([student], [assessment], []);

    await expect(
      service.submit(
        assessmentId,
        {
          answers: [
            { questionId: question1Id, optionId: option1Id },
            { questionId: question2Id, optionId: option2Id },
          ],
        },
        studentUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects incomplete answers before saving anything', async () => {
    queueSubmissionLookups();

    await expect(
      service.submit(
        assessmentId,
        {
          answers: [{ questionId: question1Id, optionId: option1Id }],
        },
        studentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects duplicate answers for the same question', async () => {
    queueSubmissionLookups();

    await expect(
      service.submit(
        assessmentId,
        {
          answers: [
            { questionId: question1Id, optionId: option1Id },
            { questionId: question1Id, optionId: option2Id },
          ],
        },
        studentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects an option that belongs to a different question', async () => {
    queueSubmissionLookups();
    limitResults.push([{ id: option1Id, isCorrect: true }], []);

    await expect(
      service.submit(
        assessmentId,
        {
          answers: [
            { questionId: question1Id, optionId: option1Id },
            { questionId: question2Id, optionId: option1Id },
          ],
        },
        studentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('converts a duplicate database constraint error into a conflict', async () => {
    queueSubmissionLookups();
    queueOptions(true, true);

    mockTransaction.mockRejectedValueOnce({
      cause: { code: '23505' },
    });

    await expect(
      service.submit(
        assessmentId,
        {
          answers: [
            { questionId: question1Id, optionId: option1Id },
            { questionId: question2Id, optionId: option2Id },
          ],
        },
        studentUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects students attempting to create quizzes', async () => {
    await expect(service.create(quizDto, studentUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects creation when the assessment does not exist', async () => {
    limitResults.push([]);

    await expect(service.create(quizDto, adminUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects adding questions to a non-quiz assessment', async () => {
    limitResults.push([
      {
        id: assessmentId,
        type: 'assignment',
        instructorId,
      },
    ]);

    await expect(service.create(quizDto, adminUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects an instructor who does not own the course offering', async () => {
    limitResults.push(
      [
        {
          id: assessmentId,
          type: 'quiz',
          instructorId: otherInstructorId,
        },
      ],
      [{ id: instructorId }],
    );

    await expect(
      service.create(quizDto, instructorUser),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate question positions', async () => {
    limitResults.push(
      [
        {
          id: assessmentId,
          type: 'quiz',
          instructorId,
        },
      ],
      [],
      [],
    );

    const invalidDto = {
      ...quizDto,
      questions: [
        { ...quizDto.questions[0], position: 0 },
        { ...quizDto.questions[0], position: 0 },
      ],
    };

    await expect(service.create(invalidDto, adminUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects questions without exactly one correct option', async () => {
    limitResults.push(
      [
        {
          id: assessmentId,
          type: 'quiz',
          instructorId,
        },
      ],
      [],
      [],
    );

    const invalidDto = {
      ...quizDto,
      questions: [
        {
          ...quizDto.questions[0],
          options: [
            { text: 'Four', position: 0, isCorrect: false },
            { text: 'Five', position: 1, isCorrect: false },
          ],
        },
      ],
    };

    await expect(service.create(invalidDto, adminUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does not reveal correct answers to students', async () => {
    const publicQuestion = {
      id: question1Id,
      assessmentId,
      prompt: 'What is 2 + 2?',
      position: 0,
    };

    const publicOptions = [
      { id: option1Id, text: 'Four', position: 0 },
      { id: option2Id, text: 'Five', position: 1 },
    ];

    limitResults.push([{ assessment, instructorId }], [student], [enrollment]);
    whereResults.push([publicQuestion], publicOptions);

    const result = await service.findOne(assessmentId, studentUser);

    expect(result).toEqual({
      assessmentId,
      questions: [
        {
          ...publicQuestion,
          options: publicOptions,
        },
      ],
    });

    expect(JSON.stringify(result)).not.toContain('isCorrect');
  });

  it('returns quiz attempts with student details for an admin', async () => {
    const submittedAt = new Date('2026-10-23T10:00:00.000Z');

    const resultRow = {
      attemptId,
      assessmentId,
      studentId,
      studentNumber: 'STU-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      score: '50.00',
      maxScore: '100.00',
      totalQuestions: 2,
      correctAnswers: 1,
      submittedAt,
    };

    limitResults.push([{ id: assessmentId, instructorId }]);
    whereResults.push([resultRow]);

    const result = await service.findAttempts(assessmentId, adminUser);

    expect(result).toEqual([resultRow]);
    expect(result[0]).not.toHaveProperty('answers');
    expect(result[0]).not.toHaveProperty('isCorrect');
  });

  it('allows an instructor to view attempts for their own quiz', async () => {
    const resultRow = {
      attemptId,
      assessmentId,
      studentId,
      studentNumber: 'STU-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      score: '50.00',
      maxScore: '100.00',
      totalQuestions: 2,
      correctAnswers: 1,
      submittedAt: new Date('2026-10-23T10:00:00.000Z'),
    };

    limitResults.push(
      [{ id: assessmentId, instructorId }],
      [{ id: instructorId }],
    );
    whereResults.push([resultRow]);

    const result = await service.findAttempts(assessmentId, instructorUser);

    expect(result).toEqual([resultRow]);
  });

  it('denies instructors access to another instructor’s quiz attempts', async () => {
    limitResults.push(
      [{ id: assessmentId, instructorId }],
      [{ id: otherInstructorId }],
    );

    await expect(
      service.findAttempts(assessmentId, instructorUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for a nonexistent quiz when listing attempts', async () => {
    limitResults.push([]);

    await expect(
      service.findAttempts(assessmentId, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
