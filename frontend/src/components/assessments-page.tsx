import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ClipboardList, Plus, Search, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createAssessment,
  getAssessments,
  getCourseOfferings,
  getCourses,
} from '@/lib/api';
import type {
  AssessmentRecord,
  AssessmentType,
  CourseOfferingRecord,
  CourseRecord,
  CreateAssessmentInput,
} from '@/lib/api';

const EMPTY_FORM = {
  courseOfferingId: '',
  name: '',
  type: 'assignment' as AssessmentType,
  maxScore: '100',
  weight: '20',
};

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60';

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function formatAssessmentType(type: AssessmentType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function AssessmentsPage() {
  const { token } = useAuth();

  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const displayLoadError = !token
    ? 'Your session has expired. Please sign in again.'
    : loadError;

  useEffect(() => {
    if (!token) {
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [assessmentResult, offeringResult, courseResult] =
          await Promise.all([
            getAssessments(authToken),
            getCourseOfferings(authToken),
            getCourses(authToken),
          ]);

        if (!cancelled) {
          setAssessments(assessmentResult);
          setOfferings(offeringResult);
          setCourses(courseResult);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, retry]);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const offeringById = useMemo(
    () => new Map(offerings.map((offering) => [offering.id, offering])),
    [offerings],
  );

  const offeringLabel = (offering: CourseOfferingRecord) => {
    const course = courseById.get(offering.courseId);

    return [
      course ? `${course.code} — ${course.title}` : 'Unknown course',
      `Section ${offering.sectionCode}`,
    ].join(' · ');
  };

  const filteredAssessments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return assessments;
    }

    return assessments.filter((assessment) => {
      const offering = offeringById.get(assessment.courseOfferingId);
      const course = offering ? courseById.get(offering.courseId) : undefined;

      return [
        assessment.name,
        assessment.type,
        course?.code,
        course?.title,
        offering?.sectionCode,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [assessments, offeringById, courseById, search]);

  function openForm() {
    setForm(EMPTY_FORM);
    setFormError('');
    setActionError('');
    setSuccess('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFormError('Your session has expired. Please sign in again.');
      return;
    }

    const name = form.name.trim();
    const maxScore = Number(form.maxScore);
    const weight = Number(form.weight);

    if (!form.courseOfferingId) {
      setFormError('Please select a course offering.');
      return;
    }

    if (name.length < 1 || name.length > 50) {
      setFormError('The assessment name must be between 1 and 50 characters.');
      return;
    }

    if (
      !Number.isFinite(maxScore) ||
      maxScore < 0.01 ||
      maxScore > 9999.99 ||
      Math.round(maxScore * 100) !== maxScore * 100
    ) {
      setFormError(
        'Maximum score must be between 0.01 and 9999.99, with up to 2 decimal places.',
      );
      return;
    }

    if (
      !Number.isFinite(weight) ||
      weight < 0.01 ||
      weight > 100 ||
      Math.round(weight * 100) !== weight * 100
    ) {
      setFormError(
        'Weight must be between 0.01 and 100, with up to 2 decimal places.',
      );
      return;
    }

    const input: CreateAssessmentInput = {
      courseOfferingId: form.courseOfferingId,
      name,
      type: form.type,
      maxScore,
      weight,
    };

    setSaving(true);
    setFormError('');
    setActionError('');
    setSuccess('');

    try {
      const created = await createAssessment(token, input);

      setAssessments((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setSuccess('Assessment created successfully.');
    } catch (error: unknown) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList size={16} aria-hidden="true" />
            Academic management
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Assessments
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create assessments for course offerings and configure their scoring
            weights.
          </p>
        </div>

        <button
          type="button"
          onClick={formOpen ? closeForm : openForm}
          disabled={loading || saving || offerings.length === 0}
          className={primaryButton}
        >
          {formOpen ? <X size={16} /> : <Plus size={16} />}
          {formOpen ? 'Close form' : 'Add assessment'}
        </button>
      </header>

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {success}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {!loading && !displayLoadError && offerings.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">A course offering is required first.</p>
          <p className="mt-1 text-muted-foreground">
            Create a course offering before adding assessments.
          </p>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <div>
            <h2 className="font-semibold">Create assessment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a course offering, then set the assessment type and grading
              values.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="assessment-offering"
                className="text-sm font-medium"
              >
                Course offering
              </label>
              <select
                id="assessment-offering"
                required
                value={form.courseOfferingId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    courseOfferingId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="" disabled>
                  Select a course offering
                </option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offeringLabel(offering)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="assessment-name" className="text-sm font-medium">
                Assessment name
              </label>
              <input
                id="assessment-name"
                required
                minLength={1}
                maxLength={50}
                autoComplete="off"
                placeholder="e.g. Assignment 1"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="assessment-type" className="text-sm font-medium">
                Assessment type
              </label>
              <select
                id="assessment-type"
                required
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as AssessmentType,
                  }))
                }
                className={inputClass}
              >
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
                <option value="project">Project</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="assessment-max-score"
                className="text-sm font-medium"
              >
                Maximum score
              </label>
              <input
                id="assessment-max-score"
                type="number"
                required
                min={0.01}
                max={9999.99}
                step={0.01}
                value={form.maxScore}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxScore: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="assessment-weight"
                className="text-sm font-medium"
              >
                Course grade weight (%)
              </label>
              <input
                id="assessment-weight"
                type="number"
                required
                min={0.01}
                max={100}
                step={0.01}
                value={form.weight}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    weight: event.target.value,
                  }))
                }
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                The percentage this assessment contributes to the final grade.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={secondaryButton}
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={primaryButton} disabled={saving}>
              {saving ? 'Creating…' : 'Create assessment'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold">Assessment catalog</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading records…'
                : `${filteredAssessments.length} of ${assessments.length} assessments`}
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">Search assessments</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assessments..."
              className={`${inputClass} pl-9`}
            />
          </label>
        </div>

        {!token || displayLoadError ? (
          <div className="px-5 py-12 text-center">
            <p role="alert" className="text-sm text-destructive">
              {displayLoadError}
            </p>
            {token && (
              <button
                type="button"
                onClick={() => setRetry((current) => current + 1)}
                className={`${secondaryButton} mt-4`}
              >
                Try again
              </button>
            )}
          </div>
        ) : loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Loading assessments…
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardList
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium">
              {search ? 'No matching assessments' : 'No assessments yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? 'Try a different search term.'
                : 'Create an assignment assessment so instructors can add instructions and due dates.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Assessment</th>
                  <th className="px-5 py-3 font-medium">Course offering</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">
                    Max score
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Weight</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssessments.map((assessment) => {
                  const offering = offeringById.get(
                    assessment.courseOfferingId,
                  );

                  return (
                    <tr key={assessment.id} className="hover:bg-muted/20">
                      <td className="px-5 py-4">
                        <span className="font-medium">{assessment.name}</span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {offering
                          ? offeringLabel(offering)
                          : 'Unavailable offering'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                          {formatAssessmentType(assessment.type)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {assessment.maxScore}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {assessment.weight}%
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {formatDate(assessment.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
