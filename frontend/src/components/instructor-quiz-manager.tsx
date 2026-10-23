import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createQuiz,
  getCourses,
  getCourseOfferings,
  getQuiz,
  getQuizAttempts,
  getQuizzes,
} from '@/lib/api';
import type {
  CreateQuizQuestionInput,
  CourseRecord,
  CourseOfferingRecord,
  QuizListItem,
  QuizAttemptResult,
} from '@/lib/api';

type DraftOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type DraftQuestion = {
  id: string;
  prompt: string;
  options: DraftOption[];
};

function createQuestion(): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    options: [
      {
        id: crypto.randomUUID(),
        text: '',
        isCorrect: true,
      },
      {
        id: crypto.randomUUID(),
        text: '',
        isCorrect: false,
      },
    ],
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}

export default function InstructorQuizManager() {
  const { token } = useAuth();

  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>(
    {},
  );
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    createQuestion(),
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<QuizAttemptResult[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('Your session has expired. Please sign in again.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [quizRecords, courseRecords, offeringRecords] = await Promise.all(
          [getQuizzes(token!), getCourses(token!), getCourseOfferings(token!)],
        );

        if (cancelled) return;

        const offeringIds = new Set(
          offeringRecords.map((offering) => offering.id),
        );

        setQuizzes(
          quizRecords.filter(
            (item) =>
              item.assessment.type === 'quiz' &&
              offeringIds.has(item.courseOffering.id),
          ),
        );
        setCourses(courseRecords);
        setOfferings(offeringRecords);
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) return;
    if (questionCounts[selectedId] !== undefined) return;

    let cancelled = false;

    async function loadQuizDetails() {
      try {
        const quiz = await getQuiz(token!, selectedId);

        if (cancelled) return;

        setQuestionCounts((current) => ({
          ...current,
          [selectedId]: quiz.questions.length,
        }));

        setDetailErrors((current) => {
          const next = { ...current };
          delete next[selectedId];
          return next;
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setDetailErrors((current) => ({
            ...current,
            [selectedId]: getErrorMessage(error),
          }));
        }
      }
    }

    void loadQuizDetails();

    return () => {
      cancelled = true;
    };
  }, [token, selectedId, questionCounts]);

  useEffect(() => {
    if (!token || !selectedId) {
      setAttempts([]);
      setAttemptsError(null);
      setAttemptsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAttempts() {
      setAttemptsLoading(true);
      setAttemptsError(null);
      setAttempts([]);

      try {
        const result = await getQuizAttempts(token!, selectedId);

        if (!cancelled) {
          setAttempts(result);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setAttemptsError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setAttemptsLoading(false);
        }
      }
    }

    void loadAttempts();

    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  function selectAssessment(id: string) {
    setSelectedId(id);
    setSaveError(null);
    setSaveSuccess(null);
    setQuestions([createQuestion()]);
  }

  function updateQuestion(
    questionId: string,
    update: (question: DraftQuestion) => DraftQuestion,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? update(question) : question,
      ),
    );
  }

  function addQuestion() {
    setQuestions((current) =>
      current.length >= 100 ? current : [...current, createQuestion()],
    );
  }

  function addOption(questionId: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options:
        question.options.length >= 10
          ? question.options
          : [
              ...question.options,
              {
                id: crypto.randomUUID(),
                text: '',
                isCorrect: false,
              },
            ],
    }));
  }

  function removeOption(questionId: string, optionId: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.filter((option) => option.id !== optionId),
    }));
  }

  function markCorrect(questionId: string, optionId: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.map((option) => ({
        ...option,
        isCorrect: option.id === optionId,
      })),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!token || !selectedId) {
      setSaveError('Select a quiz assessment first.');
      return;
    }

    for (const [index, question] of questions.entries()) {
      if (!question.prompt.trim()) {
        setSaveError(`Question ${index + 1} needs a prompt.`);
        return;
      }

      if (question.prompt.trim().length > 2000) {
        setSaveError(`Question ${index + 1} exceeds 2,000 characters.`);
        return;
      }

      if (question.options.length < 2 || question.options.length > 10) {
        setSaveError(
          `Question ${index + 1} must have between 2 and 10 options.`,
        );
        return;
      }

      if (question.options.some((option) => !option.text.trim())) {
        setSaveError(`Every option in question ${index + 1} needs text.`);
        return;
      }

      if (question.options.some((option) => option.text.trim().length > 500)) {
        setSaveError(
          `An option in question ${index + 1} exceeds 500 characters.`,
        );
        return;
      }

      if (question.options.filter((option) => option.isCorrect).length !== 1) {
        setSaveError(
          `Question ${index + 1} must have exactly one correct answer.`,
        );
        return;
      }
    }

    const payloadQuestions: CreateQuizQuestionInput[] = questions.map(
      (question, questionIndex) => ({
        prompt: question.prompt.trim(),
        position: questionIndex,
        options: question.options.map((option, optionIndex) => ({
          text: option.text.trim(),
          position: optionIndex,
          isCorrect: option.isCorrect,
        })),
      }),
    );

    setIsSaving(true);

    try {
      await createQuiz(token, {
        assessmentId: selectedId,
        questions: payloadQuestions,
      });

      setQuestionCounts((current) => ({
        ...current,
        [selectedId]: payloadQuestions.length,
      }));

      setSaveSuccess(
        `Successfully created ${payloadQuestions.length} quiz question${
          payloadQuestions.length === 1 ? '' : 's'
        }.`,
      );

      setQuestions([createQuestion()]);
    } catch (error: unknown) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const selectedQuiz = quizzes.find(
    (quiz) => quiz.assessment.id === selectedId,
  );

  const selectedOffering = offerings.find(
    (offering) => offering.id === selectedQuiz?.courseOffering.id,
  );

  const selectedCourse = courses.find(
    (course) => course.id === selectedOffering?.courseId,
  );

  const questionCount = questionCounts[selectedId];
  const isConfigured = questionCount !== undefined && questionCount > 0;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Quiz management
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Build quizzes for your course assessments and review student results.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mr-2 inline size-4" />
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border p-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading quiz assessments…
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <label className="block space-y-2 text-sm font-medium">
              <span>Quiz assessment</span>
              <select
                value={selectedId}
                onChange={(event) => selectAssessment(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Choose an assessment</option>
                {quizzes.map((quiz) => {
                  const offering = offerings.find(
                    (item) => item.id === quiz.courseOffering.id,
                  );
                  const course = courses.find(
                    (item) => item.id === offering?.courseId,
                  );

                  return (
                    <option key={quiz.assessment.id} value={quiz.assessment.id}>
                      {course?.title ?? 'Course'} · {quiz.assessment.name}
                    </option>
                  );
                })}
              </select>
            </label>

            {quizzes.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No quiz assessments are available for your course offerings.
                Create a quiz-type assessment before building its questions.
              </p>
            )}

            {selectedQuiz && (
              <p className="mt-3 text-sm text-muted-foreground">
                {selectedCourse?.title ?? 'Course'} ·{' '}
                {selectedOffering?.sectionCode ?? 'Section'} · Maximum score{' '}
                {selectedQuiz.assessment.maxScore}
              </p>
            )}
          </div>

          {selectedId && isConfigured && (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Student results</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review submitted attempts and quiz performance.
                  </p>
                </div>

                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {attempts.length} submission
                  {attempts.length === 1 ? '' : 's'}
                </span>
              </div>

              {attemptsLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading student results…
                </div>
              ) : attemptsError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
                >
                  <AlertCircle className="mr-2 inline size-4" />
                  {attemptsError}
                </div>
              ) : attempts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <ClipboardList className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">No submissions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Student results will appear here after they submit this
                    quiz.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Student</th>
                        <th className="px-4 py-3 font-medium">
                          Student number
                        </th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">
                          Correct answers
                        </th>
                        <th className="px-4 py-3 font-medium">Performance</th>
                        <th className="px-4 py-3 font-medium">Submitted</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {attempts.map((attempt) => {
                        const score = Number(attempt.score);
                        const maxScore = Number(attempt.maxScore);
                        const percentage =
                          maxScore > 0 ? (score / maxScore) * 100 : 0;

                        return (
                          <tr key={attempt.attemptId}>
                            <td className="px-4 py-3">
                              <p className="font-medium">
                                {attempt.firstName} {attempt.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {attempt.email}
                              </p>
                            </td>

                            <td className="px-4 py-3">
                              {attempt.studentNumber}
                            </td>

                            <td className="px-4 py-3 font-medium">
                              {score.toFixed(2)} / {maxScore.toFixed(2)}
                            </td>

                            <td className="px-4 py-3">
                              {attempt.correctAnswers} /{' '}
                              {attempt.totalQuestions}
                            </td>

                            <td className="px-4 py-3">
                              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                                {percentage.toFixed(1)}%
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {new Date(attempt.submittedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {selectedId && detailErrors[selectedId] && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
            >
              Could not load this quiz: {detailErrors[selectedId]}
            </div>
          )}

          {selectedId &&
            questionCount === undefined &&
            !detailErrors[selectedId] && (
              <div className="flex items-center gap-2 rounded-xl border border-border p-5 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Checking quiz configuration…
              </div>
            )}

          {selectedId && isConfigured && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <CheckCircle2 className="mb-2 size-5 text-emerald-600" />
              <h3 className="font-semibold">Quiz questions configured</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This quiz has {questionCount} question
                {questionCount === 1 ? '' : 's'}. Editing existing questions is
                not supported yet.
              </p>
            </div>
          )}

          {selectedId && questionCount === 0 && !detailErrors[selectedId] && (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Build your quiz</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add at least one question. Each question needs 2–10 options
                    and exactly one correct answer.
                  </p>
                </div>

                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {questions.length} question
                  {questions.length === 1 ? '' : 's'}
                </span>
              </div>

              {saveError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="mr-2 inline size-4" />
                  {saveError}
                </p>
              )}

              {saveSuccess && (
                <p
                  role="status"
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-2 inline size-4" />
                  {saveSuccess}
                </p>
              )}

              <div className="space-y-5">
                {questions.map((question, questionIndex) => (
                  <fieldset
                    key={question.id}
                    className="space-y-4 rounded-xl border border-border p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <legend className="font-semibold">
                        Question {questionIndex + 1}
                      </legend>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuestions((current) =>
                              current.filter((item) => item.id !== question.id),
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      )}
                    </div>

                    <label className="block space-y-2 text-sm font-medium">
                      <span>Question prompt</span>
                      <textarea
                        required
                        maxLength={2000}
                        rows={3}
                        value={question.prompt}
                        onChange={(event) =>
                          updateQuestion(question.id, (current) => ({
                            ...current,
                            prompt: event.target.value,
                          }))
                        }
                        placeholder="Enter your question…"
                        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>

                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        Answer options
                        <span className="ml-2 font-normal text-muted-foreground">
                          Select the radio button for the correct answer.
                        </span>
                      </p>

                      {question.options.map((option, optionIndex) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-3"
                        >
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={option.isCorrect}
                            onChange={() => markCorrect(question.id, option.id)}
                            aria-label={`Mark option ${optionIndex + 1} as correct`}
                            className="size-4 accent-primary"
                          />

                          <input
                            required
                            maxLength={500}
                            value={option.text}
                            onChange={(event) =>
                              updateQuestion(question.id, (current) => ({
                                ...current,
                                options: current.options.map((item) =>
                                  item.id === option.id
                                    ? {
                                        ...item,
                                        text: event.target.value,
                                      }
                                    : item,
                                ),
                              }))
                            }
                            placeholder={`Option ${optionIndex + 1}`}
                            aria-label={`Question ${questionIndex + 1}, option ${optionIndex + 1}`}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                          />

                          {option.isCorrect && (
                            <span className="hidden text-xs font-medium text-emerald-600 sm:inline">
                              Correct
                            </span>
                          )}

                          {question.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeOption(question.id, option.id)
                              }
                              aria-label={`Remove option ${optionIndex + 1}`}
                              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        disabled={question.options.length >= 10}
                        onClick={() => addOption(question.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Plus size={15} />
                        Add option
                      </button>
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  disabled={questions.length >= 100 || isSaving}
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Plus size={16} />
                  Add question
                </button>

                <button
                  type="submit"
                  disabled={isSaving || !selectedId}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <ClipboardList size={16} />
                  )}
                  {isSaving ? 'Saving quiz…' : 'Save quiz'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
