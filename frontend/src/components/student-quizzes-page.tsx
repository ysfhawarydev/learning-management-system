import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  Send,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  getMyCourses,
  getMyQuizAttempt,
  getQuiz,
  getQuizzes,
  submitQuiz,
} from '@/lib/api';
import type {
  MyCourseRecord,
  QuizAttemptRecord,
  QuizDetailRecord,
  QuizListItem,
} from '@/lib/api';

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function QuizResults({
  attempt,
  onBack,
}: {
  attempt: QuizAttemptRecord;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to quizzes
      </button>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CheckCircle2 size={24} aria-hidden="true" />
        </div>

        <h2 className="mt-5 text-2xl font-semibold tracking-tight">
          Quiz submitted
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your attempt has been recorded. These results come from the server.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-5">
            <p className="text-sm text-muted-foreground">Recorded score</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {attempt.score}
            </p>
          </div>

          <div className="rounded-xl border border-border p-5">
            <p className="text-sm text-muted-foreground">Correct answers</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {attempt.correctAnswers}
              <span className="text-lg font-normal text-muted-foreground">
                {' '}
                / {attempt.totalQuestions}
              </span>
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Submitted {formatDate(attempt.submittedAt)}
        </p>

        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Return to quizzes
        </button>
      </article>
    </section>
  );
}

export function StudentQuizzesPage() {
  const { token } = useAuth();

  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [courses, setCourses] = useState<MyCourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedQuiz, setSelectedQuiz] = useState<QuizListItem | null>(null);
  const [detail, setDetail] = useState<QuizDetailRecord | null>(null);
  const [attempt, setAttempt] = useState<QuizAttemptRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [opening, setOpening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadQuizzes = useCallback(async () => {
    if (!token) {
      setError('Please sign in again to access your quizzes.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [quizRecords, courseRecords] = await Promise.all([
        getQuizzes(token),
        getMyCourses(token),
      ]);

      setQuizzes(quizRecords);
      setCourses(courseRecords);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  function returnToList() {
    setSelectedQuiz(null);
    setDetail(null);
    setAttempt(null);
    setAnswers({});
    setActionError('');
  }

  async function openQuiz(item: QuizListItem) {
    if (!token) {
      setActionError('Please sign in again to continue.');
      return;
    }

    setSelectedQuiz(item);
    setDetail(null);
    setAttempt(null);
    setAnswers({});
    setActionError('');
    setOpening(true);

    try {
      try {
        const existingAttempt = await getMyQuizAttempt(
          token,
          item.assessment.id,
        );

        setAttempt(existingAttempt);
        return;
      } catch (err: unknown) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err;
        }
      }

      const quizDetail = await getQuiz(token, item.assessment.id);
      setDetail(quizDetail);
    } catch (err: unknown) {
      setActionError(errorMessage(err));
    } finally {
      setOpening(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError('');

    if (!token || !selectedQuiz || !detail) {
      setActionError('The quiz could not be loaded. Return and try again.');
      return;
    }

    const unanswered = detail.questions.filter(
      (question) => !answers[question.id],
    );

    if (unanswered.length > 0) {
      setActionError(
        `Answer all questions before submitting. ${unanswered.length} question(s) remain.`,
      );
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitQuiz(
        token,
        selectedQuiz.assessment.id,
        detail.questions.map((question) => ({
          questionId: question.id,
          optionId: answers[question.id],
        })),
      );

      setAttempt(result.attempt);
      setDetail(null);
      setAnswers({});
    } catch (err: unknown) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedQuiz && attempt) {
    return <QuizResults attempt={attempt} onBack={returnToList} />;
  }

  if (selectedQuiz) {
    const course = courses.find(
      (item) => item.courseOfferingId === selectedQuiz.courseOffering.id,
    );

    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={returnToList}
          disabled={submitting}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to quizzes
        </button>

        <header>
          <p className="text-sm font-medium text-primary">
            {course
              ? `${course.courseCode} · ${course.courseTitle}`
              : 'Course quiz'}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {selectedQuiz.assessment.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {selectedQuiz.assessment.maxScore} maximum points ·{' '}
            {selectedQuiz.assessment.weight}% of final grade
          </p>
        </header>

        {opening ? (
          <div
            role="status"
            className="rounded-2xl border border-border bg-card p-8"
          >
            <LoaderCircle
              className="mx-auto animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Loading your quiz…
            </p>
          </div>
        ) : actionError && !detail ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-card p-6"
          >
            <p className="font-medium">Unable to open this quiz</p>
            <p className="mt-2 text-sm text-muted-foreground">{actionError}</p>
            <button
              type="button"
              onClick={() => void openQuiz(selectedQuiz)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : detail ? (
          detail.questions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold">Quiz not ready</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your instructor has not added any questions to this quiz yet.
                Please check back later.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <span className="text-sm text-muted-foreground">Questions</span>
                <span className="text-sm font-semibold tabular-nums">
                  {
                    detail.questions.filter((question) => answers[question.id])
                      .length
                  }
                  {' / '}
                  {detail.questions.length} answered
                </span>
              </div>

              {detail.questions.map((question, index) => (
                <fieldset
                  key={question.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
                  disabled={submitting}
                >
                  <legend className="sr-only">Question {index + 1}</legend>

                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <h2 className="pt-1 font-semibold leading-6">
                      {question.prompt}
                    </h2>
                  </div>

                  <div className="mt-5 space-y-3">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[question.id] === option.id;
                      const inputId = `quiz-${question.id}-option-${option.id}`;

                      return (
                        <label
                          key={option.id}
                          htmlFor={inputId}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={selected}
                            onChange={() =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: option.id,
                              }))
                            }
                            className="mt-1 size-4 accent-primary"
                          />
                          <span className="min-w-0 flex-1 text-sm leading-6">
                            <span className="mr-2 text-xs font-semibold text-muted-foreground">
                              {String.fromCharCode(65 + optionIndex)}.
                            </span>
                            {option.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              {actionError && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                >
                  {actionError}
                </p>
              )}

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  You can submit only once. Review your answers before
                  continuing; your score will be calculated by the server.
                </p>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    detail.questions.some((question) => !answers[question.id])
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send size={16} aria-hidden="true" />
                  )}
                  {submitting ? 'Submitting your answers…' : 'Submit quiz'}
                </button>
              </div>
            </form>
          )
        ) : null}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Student workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Quizzes
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Test your understanding, complete course assessments, and review
            your submitted results.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadQuizzes()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={loading ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-card p-10 text-center"
        >
          <LoaderCircle
            className="mx-auto animate-spin text-primary"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Loading your quizzes…
          </p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-card p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Unable to load quizzes</h2>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void loadQuizzes()}
                className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
            <ClipboardCheck
              size={23}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No quizzes available</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Quizzes for your enrolled courses will appear here when your
            instructors publish them.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quizzes.map((item) => {
            const course = courses.find(
              (record) => record.courseOfferingId === item.courseOffering.id,
            );

            return (
              <article
                key={item.assessment.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardCheck size={21} aria-hidden="true" />
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    Quiz
                  </span>
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-tight">
                  {item.assessment.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {course
                    ? `${course.courseCode} · ${course.courseTitle}`
                    : `Section ${item.courseOffering.sectionCode}`}
                </p>

                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span>{item.assessment.maxScore} points</span>
                  <span>{item.assessment.weight}% of final grade</span>
                </div>

                <button
                  type="button"
                  onClick={() => void openQuiz(item)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Open quiz
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
