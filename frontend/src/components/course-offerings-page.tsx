import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpenCheck, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createCourseOffering,
  deleteCourseOffering,
  getCourseOfferings,
  getCourses,
  getInstructors,
  getSemesters,
  updateCourseOffering,
} from '@/lib/api';
import type {
  CourseOfferingRecord,
  CourseRecord,
  CreateCourseOfferingInput,
  InstructorRecord,
  SemesterRecord,
} from '@/lib/api';

const EMPTY_FORM = {
  courseId: '',
  semesterId: '',
  instructorId: '',
  sectionCode: '',
  capacity: '',
};

type OfferingForm = typeof EMPTY_FORM;

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

function semesterLabel(semester: SemesterRecord) {
  return `${semester.academicYear} · ${
    semester.term.charAt(0).toUpperCase() + semester.term.slice(1)
  }`;
}

export function CourseOfferingsPage() {
  const { token } = useAuth();

  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);

  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [form, setForm] = useState<OfferingForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<CourseOfferingRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const displayLoadError = !token
    ? 'Your session has expired. Please sign in again.'
    : loadError;

  useEffect(() => {
    if (!token) return;

    const authToken = token;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [offeringResult, courseResult, semesterResult, instructorResult] =
          await Promise.all([
            getCourseOfferings(authToken),
            getCourses(authToken),
            getSemesters(authToken),
            getInstructors(authToken),
          ]);

        if (cancelled) return;

        setOfferings(offeringResult);
        setCourses(courseResult);
        setSemesters(semesterResult);
        setInstructors(instructorResult);
      } catch (error: unknown) {
        if (!cancelled) setLoadError(errorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
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

  const semesterById = useMemo(
    () => new Map(semesters.map((semester) => [semester.id, semester])),
    [semesters],
  );

  const instructorById = useMemo(
    () => new Map(instructors.map((instructor) => [instructor.id, instructor])),
    [instructors],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return offerings.filter((offering) => {
      if (semesterFilter !== 'all' && offering.semesterId !== semesterFilter) {
        return false;
      }

      if (!query) return true;

      const course = courseById.get(offering.courseId);
      const semester = semesterById.get(offering.semesterId);
      const instructor = instructorById.get(offering.instructorId);

      const searchable = [
        offering.sectionCode,
        course?.code,
        course?.title,
        semester ? semesterLabel(semester) : undefined,
        instructor?.firstName,
        instructor?.lastName,
        instructor?.employeeNumber,
        instructor?.departmentName,
      ];

      return searchable.some((value) => value?.toLowerCase().includes(query));
    });
  }, [
    offerings,
    search,
    semesterFilter,
    courseById,
    semesterById,
    instructorById,
  ]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      courseId: courses[0]?.id ?? '',
      semesterId: semesters[0]?.id ?? '',
      instructorId: instructors[0]?.id ?? '',
    });
    setFormError('');
    setActionError('');
    setSuccess('');
    setFormOpen(true);
  }

  function openEdit(offering: CourseOfferingRecord) {
    setEditing(offering);
    setForm({
      courseId: offering.courseId,
      semesterId: offering.semesterId,
      instructorId: offering.instructorId,
      sectionCode: offering.sectionCode,
      capacity: offering.capacity == null ? '' : String(offering.capacity),
    });
    setFormError('');
    setActionError('');
    setSuccess('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFormError('Your session has expired. Please sign in again.');
      return;
    }

    const sectionCode = form.sectionCode.trim();
    const capacity = form.capacity.trim() ? Number(form.capacity) : undefined;

    if (!form.courseId || !form.semesterId || !form.instructorId) {
      setFormError('Select a course, semester, and instructor.');
      return;
    }

    if (!sectionCode || sectionCode.length > 20) {
      setFormError('Section code must contain between 1 and 20 characters.');
      return;
    }

    if (
      capacity !== undefined &&
      (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)
    ) {
      setFormError('Capacity must be a whole number between 1 and 100,000.');
      return;
    }

    const input: CreateCourseOfferingInput = {
      courseId: form.courseId,
      semesterId: form.semesterId,
      instructorId: form.instructorId,
      sectionCode: sectionCode.toUpperCase(),
      ...(capacity !== undefined ? { capacity } : {}),
    };

    setSaving(true);
    setFormError('');
    setActionError('');
    setSuccess('');

    try {
      if (editing) {
        const updated = await updateCourseOffering(token, editing.id, input);

        setOfferings((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSuccess('Course offering updated successfully.');
      } else {
        const created = await createCourseOffering(token, input);

        setOfferings((current) =>
          [...current, created].sort((a, b) =>
            a.sectionCode.localeCompare(b.sectionCode),
          ),
        );
        setSuccess('Course offering created successfully.');
      }

      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (error: unknown) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(offering: CourseOfferingRecord) {
    if (!token || deletingId || saving) return;

    const course = courseById.get(offering.courseId);
    const title = course
      ? `${course.code} — ${course.title}`
      : 'this course offering';

    if (
      !window.confirm(
        `Delete ${title}, section ${offering.sectionCode}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(offering.id);
    setActionError('');
    setSuccess('');

    try {
      await deleteCourseOffering(token, offering.id);

      setOfferings((current) =>
        current.filter((item) => item.id !== offering.id),
      );

      if (editing?.id === offering.id) {
        setFormOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
      }

      setSuccess('Course offering deleted successfully.');
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  const canCreate =
    courses.length > 0 && semesters.length > 0 && instructors.length > 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpenCheck size={16} aria-hidden="true" />
            Academic management
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Course offerings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Schedule courses for academic semesters, assign instructors, and
            manage section capacity.
          </p>
        </div>

        <button
          type="button"
          onClick={formOpen ? closeForm : openCreate}
          disabled={
            saving ||
            deletingId !== null ||
            (!canCreate && !formOpen) ||
            Boolean(displayLoadError)
          }
          className={primaryButton}
        >
          {formOpen ? <X size={16} /> : <Plus size={16} />}
          {formOpen ? 'Close form' : 'Add offering'}
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

      {!loading && !displayLoadError && !canCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">More academic records are required.</p>
          <p className="mt-1 text-muted-foreground">
            Create at least one course, semester, and instructor before adding
            an offering.
          </p>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <div>
            <h2 className="font-semibold">
              {editing ? 'Edit offering' : 'Create offering'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign a course to a semester and instructor.
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
            <div className="space-y-2">
              <label htmlFor="offering-course" className="text-sm font-medium">
                Course
              </label>
              <select
                id="offering-course"
                required
                value={form.courseId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    courseId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="" disabled>
                  Select a course
                </option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} — {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="offering-semester"
                className="text-sm font-medium"
              >
                Semester
              </label>
              <select
                id="offering-semester"
                required
                value={form.semesterId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    semesterId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="" disabled>
                  Select a semester
                </option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semesterLabel(semester)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="offering-instructor"
                className="text-sm font-medium"
              >
                Instructor
              </label>
              <select
                id="offering-instructor"
                required
                value={form.instructorId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instructorId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="" disabled>
                  Select an instructor
                </option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.firstName} {instructor.lastName} ·{' '}
                    {instructor.employeeNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="offering-section" className="text-sm font-medium">
                Section code
              </label>
              <input
                id="offering-section"
                required
                minLength={1}
                maxLength={20}
                autoComplete="off"
                placeholder="e.g. A1"
                value={form.sectionCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sectionCode: event.target.value,
                  }))
                }
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                1–20 characters. Saved in uppercase.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="offering-capacity"
                className="text-sm font-medium"
              >
                Capacity{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <input
                id="offering-capacity"
                type="number"
                min={1}
                max={100000}
                step={1}
                placeholder="e.g. 60"
                value={form.capacity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    capacity: event.target.value,
                  }))
                }
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Enter a whole number between 1 and 100,000, or leave blank to
                use the server default.
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
              {saving
                ? 'Saving...'
                : editing
                  ? 'Save changes'
                  : 'Create offering'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold">Offering directory</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading records…'
                : `${filtered.length} of ${offerings.length} offerings`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block w-full sm:w-56">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">Search offerings</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search offerings..."
                className={`${inputClass} pl-9`}
              />
            </label>

            <label>
              <span className="sr-only">Filter by semester</span>
              <select
                value={semesterFilter}
                onChange={(event) => setSemesterFilter(event.target.value)}
                className={`${inputClass} sm:w-48`}
              >
                <option value="all">All semesters</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semesterLabel(semester)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {displayLoadError ? (
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
                Retry
              </button>
            )}
          </div>
        ) : loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Loading course offerings…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <BookOpenCheck
              size={28}
              className="mx-auto text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium">
              {offerings.length === 0
                ? 'No course offerings yet'
                : 'No matching offerings'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {offerings.length === 0
                ? 'Create an offering to assign a course to a semester and instructor.'
                : 'Try another search term or semester filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Course</th>
                  <th className="px-5 py-3 font-medium">Semester</th>
                  <th className="px-5 py-3 font-medium">Instructor</th>
                  <th className="px-5 py-3 font-medium">Section</th>
                  <th className="px-5 py-3 font-medium">Capacity</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((offering) => {
                  const course = courseById.get(offering.courseId);
                  const semester = semesterById.get(offering.semesterId);
                  const instructor = instructorById.get(offering.instructorId);

                  return (
                    <tr
                      key={offering.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {course?.code ?? 'Unknown course'}
                        </p>
                        <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                          {course?.title ?? offering.courseId}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {semester ? (
                          <>
                            <p className="font-medium">
                              {semesterLabel(semester)}
                            </p>
                            <p className="mt-1 text-xs capitalize text-muted-foreground">
                              {semester.status}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Unknown semester
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {instructor ? (
                          <>
                            <p className="font-medium">
                              {instructor.firstName} {instructor.lastName}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {instructor.departmentName}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Unknown instructor
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-md border border-border bg-muted/40 px-2 py-1 font-medium">
                          {offering.sectionCode}
                        </span>
                      </td>
                      <td className="px-5 py-4 tabular-nums">
                        {offering.capacity ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Edit section ${offering.sectionCode}`}
                            title="Edit offering"
                            disabled={saving || deletingId !== null}
                            onClick={() => openEdit(offering)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete section ${offering.sectionCode}`}
                            title="Delete offering"
                            disabled={saving || deletingId !== null}
                            onClick={() => void handleDelete(offering)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          >
                            {deletingId === offering.id ? (
                              <span className="text-xs">…</span>
                            ) : (
                              <Trash2 size={16} aria-hidden="true" />
                            )}
                          </button>
                        </div>
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
