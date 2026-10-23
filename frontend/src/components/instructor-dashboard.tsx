import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Users,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createAssignment,
  getAssignments,
  getAssignmentSubmissions,
  getAssessments,
  getCourses,
  getCourseOfferings,
  getSemesters,
  reviewAssignmentSubmission,
} from '@/lib/api';
import type {
  AssignmentDetailRecord,
  AssignmentSubmissionWithStudent,
  AssessmentRecord,
  CourseOfferingRecord,
  CourseRecord,
  SemesterRecord,
} from '@/lib/api';
import InstructorQuizManager from '@/components/instructor-quiz-manager';

type WorkspaceTab = 'Assignments' | 'Submissions' | 'Quiz Management';

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function InstructorDashboard() {
  const { user, token, logout } = useAuth();

  const [tab, setTab] = useState<WorkspaceTab>('Assignments');
  const [assignments, setAssignments] = useState<AssignmentDetailRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courseOfferings, setCourseOfferings] = useState<
    CourseOfferingRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<
    AssignmentSubmissionWithStudent[]
  >([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [assessmentId, setAssessmentId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(
    null,
  );
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [
        assignmentRecords,
        assessmentRecords,
        courseRecords,
        semesterRecords,
        courseOfferingRecords,
      ] = await Promise.all([
        getAssignments(token),
        getAssessments(token),
        getCourses(token),
        getSemesters(token),
        getCourseOfferings(token),
      ]);

      setAssignments(assignmentRecords);
      setAssessments(assessmentRecords);
      setCourses(courseRecords);
      setSemesters(semesterRecords);
      setCourseOfferings(courseOfferingRecords);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, refreshKey]);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const semesterById = useMemo(
    () => new Map(semesters.map((semester) => [semester.id, semester])),
    [semesters],
  );

  const courseOfferingById = useMemo(
    () => new Map(courseOfferings.map((offering) => [offering.id, offering])),
    [courseOfferings],
  );

  const assignedAssessments = useMemo(() => {
    const assignmentAssessmentIds = new Set(
      assignments.map((item) => item.assessment.id),
    );

    const instructorOfferingIds = new Set(
      courseOfferings.map((offering) => offering.id),
    );

    return assessments.filter(
      (assessment) =>
        assessment.type === 'assignment' &&
        instructorOfferingIds.has(assessment.courseOfferingId) &&
        !assignmentAssessmentIds.has(assessment.id),
    );
  }, [assessments, assignments, courseOfferings]);

  const selectedAssignment = assignments.find(
    (item) => item.assignment.id === selectedAssignmentId,
  );

  const loadSubmissions = useCallback(
    async (assignmentId: string) => {
      if (!token) {
        setSubmissionError('Your session has expired. Please sign in again.');
        return;
      }

      setIsLoadingSubmissions(true);
      setSubmissionError(null);
      setReviewError(null);
      setReviewSuccess(null);

      try {
        const records = await getAssignmentSubmissions(token, assignmentId);
        setSubmissions(records);

        setScores((current) => {
          const next = { ...current };
          for (const record of records) {
            if (!(record.submission.id in next)) {
              next[record.submission.id] = '';
            }
          }
          return next;
        });

        setFeedback((current) => {
          const next = { ...current };
          for (const record of records) {
            if (!(record.submission.id in next)) {
              next[record.submission.id] = record.submission.feedback ?? '';
            }
          }
          return next;
        });
      } catch (err: unknown) {
        setSubmissionError(errorMessage(err));
        setSubmissions([]);
      } finally {
        setIsLoadingSubmissions(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (tab !== 'Submissions' || !selectedAssignmentId) {
      setSubmissions([]);
      return;
    }

    void loadSubmissions(selectedAssignmentId);
  }, [tab, selectedAssignmentId, loadSubmissions]);

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setCreateError('Your session has expired. Please sign in again.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      await createAssignment(token, {
        assessmentId,
        instructions: instructions.trim(),
        dueAt: new Date(dueAt).toISOString(),
        allowLateSubmissions,
      });

      setAssessmentId('');
      setInstructions('');
      setDueAt('');
      setAllowLateSubmissions(false);
      setShowCreateForm(false);
      setCreateSuccess('Assignment created successfully.');
      setRefreshKey((value) => value + 1);
    } catch (err: unknown) {
      setCreateError(errorMessage(err));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleReview(
    event: FormEvent<HTMLFormElement>,
    record: AssignmentSubmissionWithStudent,
  ) {
    event.preventDefault();

    if (!token || !selectedAssignmentId) {
      setReviewError('Your session has expired. Please sign in again.');
      return;
    }

    const submissionId = record.submission.id;
    const scoreText = scores[submissionId] ?? '';
    const score = Number(scoreText);
    const maxScore = Number(selectedAssignment?.assessment.maxScore);

    if (scoreText.trim() === '' || !Number.isFinite(score)) {
      setReviewError('Enter a valid score before saving the review.');
      return;
    }

    if (score < 0 || score > maxScore) {
      setReviewError(`The score must be between 0 and ${maxScore}.`);
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(scoreText.trim())) {
      setReviewError('Scores can have at most two decimal places.');
      return;
    }

    setSavingSubmissionId(submissionId);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      await reviewAssignmentSubmission(
        token,
        selectedAssignmentId,
        submissionId,
        {
          score,
          feedback: (feedback[submissionId] ?? '').trim(),
        },
      );

      setReviewSuccess(
        `Saved review for ${record.student.firstName} ${record.student.lastName}.`,
      );

      await loadSubmissions(selectedAssignmentId);
    } catch (err: unknown) {
      setReviewError(errorMessage(err));
    } finally {
      setSavingSubmissionId(null);
    }
  }

  const submissionCount = submissions.length;
  const reviewedCount = submissions.filter(
    (record) => record.submission.reviewedAt !== null,
  ).length;

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold tracking-tight">
                Instructor workspace
              </h1>
              <p className="text-sm text-muted-foreground">
                EduManage · Teaching and assessment
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-accent"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-primary">
              Teaching overview
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Manage assignment instructions, review student work, and record
              grades for your course offerings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Unable to load instructor data</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="mt-3 font-medium text-primary underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={BookOpen}
            label="Teaching offerings"
            value={isLoading ? '…' : String(courseOfferings.length)}
            hint="Course offerings assigned to you"
          />
          <StatCard
            icon={ClipboardList}
            label="Assignments"
            value={isLoading ? '…' : String(assignments.length)}
            hint="Assignment details you manage"
          />
          <StatCard
            icon={Users}
            label="Assessment options"
            value={isLoading ? '…' : String(assignedAssessments.length)}
            hint="Eligible assessments without assignment details"
          />
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
              {(['Assignments', 'Submissions', 'Quiz Management'] as const).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    aria-pressed={tab === item}
                    className={[
                      'rounded-lg px-4 py-2 text-sm font-medium transition',
                      tab === item
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>

            {tab === 'Quiz Management' && <InstructorQuizManager />}

            {tab === 'Assignments' && (
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm((value) => !value);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
                disabled={assignedAssessments.length === 0 || isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} aria-hidden="true" />
                Create assignment
              </button>
            )}
          </div>

          {tab === 'Assignments' && (
            <>
              {createSuccess && (
                <p
                  role="status"
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-2 inline size-4" />
                  {createSuccess}
                </p>
              )}

              {showCreateForm && (
                <form
                  onSubmit={handleCreateAssignment}
                  className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7"
                >
                  <div>
                    <h3 className="text-lg font-semibold">New assignment</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose an existing assignment assessment, then add the
                      instructions and deadline.
                    </p>
                  </div>

                  {createError && (
                    <p role="alert" className="text-sm text-destructive">
                      {createError}
                    </p>
                  )}

                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                      <span>Assessment</span>
                      <select
                        required
                        value={assessmentId}
                        onChange={(event) =>
                          setAssessmentId(event.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select an assessment</option>
                        {assignedAssessments.map((assessment) => {
                          const offering = courseOfferingById.get(
                            assessment.courseOfferingId,
                          );
                          const course = offering
                            ? courseById.get(offering.courseId)
                            : undefined;

                          return (
                            <option key={assessment.id} value={assessment.id}>
                              {assessment.name} · {course?.code ?? 'Course'} ·
                              max {assessment.maxScore}
                            </option>
                          );
                        })}
                      </select>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Only unused assignment assessments belonging to your
                        course offerings are listed.
                      </span>
                    </label>

                    <label className="space-y-2 text-sm font-medium">
                      <span>Due date and time</span>
                      <input
                        required
                        type="datetime-local"
                        value={dueAt}
                        onChange={(event) => setDueAt(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  </div>

                  <label className="block space-y-2 text-sm font-medium">
                    <span>Instructions</span>
                    <textarea
                      required
                      minLength={1}
                      maxLength={10000}
                      rows={5}
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="Explain the task, expected deliverables, and submission requirements…"
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="block text-xs font-normal text-muted-foreground">
                      {instructions.length}/10,000 characters
                    </span>
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={allowLateSubmissions}
                      onChange={(event) =>
                        setAllowLateSubmissions(event.target.checked)
                      }
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>
                      <span className="font-medium">
                        Allow late submissions
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        Students can submit after the deadline if this is
                        enabled.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isCreating ||
                        !assessmentId ||
                        !dueAt ||
                        !instructions.trim()
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {isCreating ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {isCreating ? 'Creating…' : 'Create assignment'}
                    </button>
                  </div>
                </form>
              )}

              {isLoading ? (
                <LoadingState label="Loading assignments…" />
              ) : assignments.length === 0 ? (
                <EmptyState
                  title="No assignments yet"
                  description="Once assignment details are created for your assessments, they will appear here."
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {assignments.map((item) => {
                    const course = courseById.get(item.courseOffering.courseId);
                    const semester = semesterById.get(
                      item.courseOffering.semesterId,
                    );

                    return (
                      <article
                        key={item.assignment.id}
                        className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                              {course?.code ?? 'Course'} · Section{' '}
                              {item.courseOffering.sectionCode}
                            </p>
                            <h3 className="mt-2 text-lg font-semibold">
                              {item.assessment.name}
                            </h3>
                          </div>
                          <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {item.assessment.maxScore} points
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {item.assignment.instructions}
                        </p>

                        <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-muted-foreground">Due date</p>
                            <p className="mt-1 font-medium">
                              {formatDate(item.assignment.dueAt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Semester</p>
                            <p className="mt-1 font-medium">
                              {semester
                                ? `${semester.term} · ${semester.academicYear}`
                                : 'Semester details unavailable'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {item.assignment.allowLateSubmissions
                              ? 'Late work allowed'
                              : 'Late work not allowed'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignmentId(item.assignment.id);
                              setTab('Submissions');
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                          >
                            Review submissions
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'Submissions' && (
            <section className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <label className="block max-w-2xl space-y-2 text-sm font-medium">
                  <span>Select an assignment to review</span>
                  <select
                    value={selectedAssignmentId}
                    onChange={(event) =>
                      setSelectedAssignmentId(event.target.value)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Choose an assignment</option>
                    {assignments.map((item) => {
                      const course = courseById.get(
                        item.courseOffering.courseId,
                      );
                      return (
                        <option
                          key={item.assignment.id}
                          value={item.assignment.id}
                        >
                          {course?.code ?? 'Course'} · {item.assessment.name}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {selectedAssignment && (
                  <div className="mt-5 flex flex-wrap gap-5 border-t border-border pt-4 text-sm">
                    <p>
                      <span className="text-muted-foreground">
                        Maximum score:{' '}
                      </span>
                      <strong>{selectedAssignment.assessment.maxScore}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Due: </span>
                      <strong>
                        {formatDate(selectedAssignment.assignment.dueAt)}
                      </strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reviewed: </span>
                      <strong>
                        {reviewedCount}/{submissionCount}
                      </strong>
                    </p>
                  </div>
                )}
              </div>

              {reviewError && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {reviewError}
                </p>
              )}

              {reviewSuccess && (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-2 inline size-4" />
                  {reviewSuccess}
                </p>
              )}

              {submissionError && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 p-4 text-sm"
                >
                  <p className="font-medium">Unable to load submissions</p>
                  <p className="mt-1 text-muted-foreground">
                    {submissionError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadSubmissions(selectedAssignmentId)}
                    className="mt-3 font-medium text-primary underline underline-offset-4"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!selectedAssignmentId ? (
                <EmptyState
                  title="Choose an assignment"
                  description="Select one of your assignments above to inspect submissions and record grades."
                />
              ) : isLoadingSubmissions ? (
                <LoadingState label="Loading student submissions…" />
              ) : submissions.length === 0 && !submissionError ? (
                <EmptyState
                  title="No submissions yet"
                  description="Student submissions will appear here when they submit their work."
                />
              ) : (
                <div className="space-y-4">
                  {submissions.map((record) => {
                    const submission = record.submission;
                    const studentName = `${record.student.firstName} ${record.student.lastName}`;
                    const reviewed = submission.reviewedAt !== null;

                    return (
                      <article
                        key={submission.id}
                        className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <h3 className="font-semibold">{studentName}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Student no. {record.student.number}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Submitted {formatDate(submission.submittedAt)}
                            </p>
                          </div>
                          <span
                            className={[
                              'inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium',
                              reviewed
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                            ].join(' ')}
                          >
                            {reviewed ? 'Reviewed' : 'Awaiting review'}
                          </span>
                        </div>

                        {submission.content && (
                          <div className="mt-5 rounded-xl bg-muted/50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Student response
                            </p>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                              {submission.content}
                            </p>
                          </div>
                        )}

                        {submission.submissionUrl && (
                          <a
                            href={submission.submissionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-2 break-all text-sm font-medium text-primary underline underline-offset-4"
                          >
                            Open submitted work
                            <ExternalLink size={15} className="shrink-0" />
                          </a>
                        )}

                        <form
                          onSubmit={(event) => void handleReview(event, record)}
                          className="mt-5 space-y-4 border-t border-border pt-5"
                        >
                          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                            <label className="space-y-2 text-sm font-medium">
                              <span>
                                Score (max{' '}
                                {selectedAssignment?.assessment.maxScore})
                              </span>
                              <input
                                type="number"
                                required
                                min={0}
                                max={Number(
                                  selectedAssignment?.assessment.maxScore,
                                )}
                                step="0.01"
                                value={scores[submission.id] ?? ''}
                                onChange={(event) =>
                                  setScores((current) => ({
                                    ...current,
                                    [submission.id]: event.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                              />
                            </label>

                            <label className="space-y-2 text-sm font-medium">
                              <span>Feedback (optional)</span>
                              <textarea
                                rows={2}
                                maxLength={5000}
                                value={feedback[submission.id] ?? ''}
                                onChange={(event) =>
                                  setFeedback((current) => ({
                                    ...current,
                                    [submission.id]: event.target.value,
                                  }))
                                }
                                placeholder="Share feedback to help the student improve…"
                                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring"
                              />
                            </label>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {reviewed && (
                              <p className="text-xs text-muted-foreground">
                                Last reviewed{' '}
                                {formatDate(submission.reviewedAt!)}
                              </p>
                            )}
                            <button
                              type="submit"
                              disabled={savingSubmissionId === submission.id}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:ml-auto"
                            >
                              {savingSubmissionId === submission.id ? (
                                <LoaderCircle className="size-4 animate-spin" />
                              ) : (
                                <Save size={16} />
                              )}
                              {savingSubmissionId === submission.id
                                ? 'Saving…'
                                : reviewed
                                  ? 'Update grade and feedback'
                                  : 'Save grade and feedback'}
                            </button>
                          </div>
                        </form>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </section>

        <footer className="border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
          Signed in as {user?.email ?? 'instructor'} · Assignment access and
          grade limits are enforced by the server.
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-14 text-sm text-muted-foreground">
      <LoaderCircle className="size-5 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-14 text-center">
      <ClipboardList className="mx-auto size-8 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export { InstructorDashboard };
