import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  Send,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  getAssignments,
  getMyAssignmentSubmission,
  getMyCourses,
  submitAssignment,
} from '@/lib/api';
import type {
  AssignmentDetailRecord,
  MyAssignmentSubmissionRecord,
  MyCourseRecord,
} from '@/lib/api';

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getDeadlineState(dueAt: string, allowLate: boolean) {
  const overdue = Date.now() > new Date(dueAt).getTime();

  if (!overdue) {
    return { label: 'Open', className: 'bg-primary/10 text-primary' };
  }

  return allowLate
    ? {
        label: 'Late submissions allowed',
        className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      }
    : {
        label: 'Deadline passed',
        className: 'bg-destructive/10 text-destructive',
      };
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}

interface AssignmentCardProps {
  item: AssignmentDetailRecord;
  course: MyCourseRecord | undefined;
  existing: MyAssignmentSubmissionRecord | null;
  token: string;
  onSubmitted: (
    assignmentId: string,
    submission: MyAssignmentSubmissionRecord,
  ) => void;
}

function AssignmentCard({
  item,
  course,
  existing,
  token,
  onSubmitted,
}: AssignmentCardProps) {
  const [content, setContent] = useState(existing?.submission.content ?? '');
  const [submissionUrl, setSubmissionUrl] = useState(
    existing?.submission.submissionUrl ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { assignment, assessment } = item;
  const deadline = getDeadlineState(
    assignment.dueAt,
    assignment.allowLateSubmissions,
  );
  const isPastDeadline = Date.now() > new Date(assignment.dueAt).getTime();
  const isReviewed =
    existing?.submission.reviewedAt !== null &&
    existing?.submission.reviewedAt !== undefined;
  const canSubmit = !isPastDeadline || assignment.allowLateSubmissions;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!content.trim() && !submissionUrl.trim()) {
      setError('Enter your work or provide a submission URL.');
      return;
    }

    setSaving(true);

    try {
      const submission = await submitAssignment(token, assignment.id, {
        ...(content.trim() ? { content: content.trim() } : {}),
        ...(submissionUrl.trim()
          ? { submissionUrl: submissionUrl.trim() }
          : {}),
      });

      onSubmitted(assignment.id, { submission, grade: null });
      setSuccess(
        existing
          ? 'Your submission has been updated.'
          : 'Your assignment has been submitted.',
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-primary">
              {course
                ? `${course.courseCode} · Section ${course.sectionCode}`
                : 'Course assignment'}
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">
              {assessment.name}
            </h3>
            {course && (
              <p className="mt-1 text-sm text-muted-foreground">
                {course.courseTitle}
              </p>
            )}
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${deadline.className}`}
          >
            {deadline.label}
          </span>
        </div>

        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-sm font-medium">Instructions</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {assignment.instructions}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <CalendarClock
              size={18}
              className="mt-0.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="mt-1 text-sm font-medium">
                {formatDate(assignment.dueAt)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <ClipboardList
              size={18}
              className="mt-0.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs text-muted-foreground">Maximum score</p>
              <p className="mt-1 text-sm font-medium">
                {Number(assessment.maxScore)} points
                <span className="ml-2 text-xs text-muted-foreground">
                  · {Number(assessment.weight)}% of final grade
                </span>
              </p>
            </div>
          </div>
        </div>

        {existing && (
          <section className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">Your submission</h4>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isReviewed
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isReviewed ? 'Reviewed' : 'Submitted · Awaiting review'}
              </span>
            </div>

            {existing.submission.content && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Submitted work
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                  {existing.submission.content}
                </p>
              </div>
            )}

            {existing.submission.submissionUrl && (
              <a
                href={existing.submission.submissionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 break-all text-sm font-medium text-primary underline underline-offset-4"
              >
                Open submitted link
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}

            <p className="text-xs text-muted-foreground">
              Submitted {formatDate(existing.submission.submittedAt)}
            </p>

            {isReviewed && (
              <div className="space-y-3 border-t border-border pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Your grade</p>
                  <p className="mt-1 text-lg font-semibold">
                    {existing.grade?.score !== null &&
                    existing.grade?.score !== undefined
                      ? `${Number(existing.grade.score)} / ${Number(assessment.maxScore)}`
                      : 'Not available'}
                  </p>
                </div>

                {existing.submission.feedback && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Instructor feedback
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                      {existing.submission.feedback}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {canSubmit ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={`assignment-content-${assignment.id}`}
                className="text-sm font-medium"
              >
                Your work
              </label>
              <textarea
                id={`assignment-content-${assignment.id}`}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={20000}
                rows={5}
                placeholder="Write your answer or describe your work…"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {content.length.toLocaleString()} / 20,000
              </p>
            </div>

            <div>
              <label
                htmlFor={`assignment-url-${assignment.id}`}
                className="text-sm font-medium"
              >
                Submission URL
                <span className="ml-2 font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <input
                id={`assignment-url-${assignment.id}`}
                type="url"
                value={submissionUrl}
                onChange={(event) => setSubmissionUrl(event.target.value)}
                maxLength={2048}
                placeholder="https://github.com/you/your-project"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {success && (
              <p role="status" className="text-sm text-primary">
                {success}
              </p>
            )}

            {isReviewed && (
              <p className="text-xs leading-5 text-muted-foreground">
                Resubmitting replaces your previous submission and clears its
                grade and feedback until your instructor reviews it again.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {saving
                ? 'Submitting…'
                : existing
                  ? 'Update submission'
                  : 'Submit assignment'}
            </button>
          </form>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">Submissions are closed</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                The deadline has passed and late submissions are not allowed.
                {existing
                  ? ' Your previous submission remains available above.'
                  : ' Contact your instructor if you need assistance.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function StudentAssignmentsPage() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentDetailRecord[]>([]);
  const [courses, setCourses] = useState<MyCourseRecord[]>([]);
  const [submissions, setSubmissions] = useState<
    Record<string, MyAssignmentSubmissionRecord | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAssignments = useCallback(async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [assignmentRecords, courseRecords] = await Promise.all([
        getAssignments(token),
        getMyCourses(token),
      ]);

      const submissionEntries = await Promise.all(
        assignmentRecords.map(async (item) => {
          const result = await getMyAssignmentSubmission(
            token,
            item.assignment.id,
          );
          return [item.assignment.id, result] as const;
        }),
      );

      setAssignments(
        [...assignmentRecords].sort(
          (a, b) =>
            new Date(a.assignment.dueAt).getTime() -
            new Date(b.assignment.dueAt).getTime(),
        ),
      );
      setCourses(courseRecords);
      setSubmissions(Object.fromEntries(submissionEntries));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  function handleSubmitted(
    assignmentId: string,
    submission: MyAssignmentSubmissionRecord,
  ) {
    setSubmissions((current) => ({
      ...current,
      [assignmentId]: submission,
    }));
  }

  const courseByOfferingId = new Map(
    courses.map((course) => [course.courseOfferingId, course]),
  );

  const submittedCount = assignments.filter(
    (item) => submissions[item.assignment.id] != null,
  ).length;

  const pendingCount = assignments.length - submittedCount;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Student workspace</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              My Assignments
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Review assignment instructions, submit your work, and check
              instructor feedback.
            </p>
          </div>

          {!loading && !error && (
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              {assignments.length}{' '}
              {assignments.length === 1 ? 'assignment' : 'assignments'}
            </span>
          )}
        </div>
      </header>

      {!loading && !error && assignments.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total assignments</p>
            <p className="mt-2 text-2xl font-semibold">{assignments.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="mt-2 text-2xl font-semibold">{submittedCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Not submitted</p>
            <p className="mt-2 text-2xl font-semibold">{pendingCount}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground"
        >
          Loading your assignments…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-card p-6"
        >
          <p className="font-semibold">We couldn’t load your assignments</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void loadAssignments()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <ClipboardList
            size={40}
            className="mx-auto text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="mt-4 font-semibold">No assignments yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Assignments for your enrolled courses will appear here when your
            instructors publish them.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {assignments.map((item) => (
            <AssignmentCard
              key={item.assignment.id}
              item={item}
              course={courseByOfferingId.get(item.courseOffering.id)}
              existing={submissions[item.assignment.id] ?? null}
              token={token!}
              onSubmitted={handleSubmitted}
            />
          ))}
        </div>
      )}
    </section>
  );
}
