import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createCourse,
  deleteCourse,
  getAcademicDepartments,
  getCourses,
  updateCourse,
} from '@/lib/api';
import type {
  CourseRecord,
  CreateCourseInput,
  DepartmentRecord,
} from '@/lib/api';

const EMPTY_FORM = {
  departmentId: '',
  code: '',
  title: '',
  description: '',
  creditValue: '3',
};

type CourseForm = typeof EMPTY_FORM;

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

export function CoursesPage() {
  const { token } = useAuth();

  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<CourseRecord | null>(null);
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
    if (!token) {
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [courseResult, departmentResult] = await Promise.all([
          getCourses(authToken),
          getAcademicDepartments(authToken),
        ]);

        if (!cancelled) {
          setCourses(courseResult);
          setDepartments(departmentResult);
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

  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return courses;
    }

    return courses.filter((course) => {
      const department = departmentById.get(course.departmentId);

      return [
        course.code,
        course.title,
        course.description,
        department?.name,
        department?.code,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [courses, departmentById, search]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      departmentId: departments[0]?.id ?? '',
    });
    setFormError('');
    setActionError('');
    setSuccess('');
    setFormOpen(true);
  }

  function openEdit(course: CourseRecord) {
    setEditing(course);
    setForm({
      departmentId: course.departmentId,
      code: course.code,
      title: course.title,
      description: course.description ?? '',
      creditValue: String(course.creditValue),
    });
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

    const creditValue = Number(form.creditValue);

    if (!form.departmentId) {
      setFormError('Please select a department.');
      return;
    }

    if (!form.code.trim() || !form.title.trim()) {
      setFormError('Course code and title are required.');
      return;
    }

    if (
      !Number.isInteger(creditValue) ||
      creditValue < 1 ||
      creditValue > 1000
    ) {
      setFormError('Credit value must be a whole number between 1 and 1000.');
      return;
    }

    const input: CreateCourseInput = {
      departmentId: form.departmentId,
      code: form.code.trim(),
      title: form.title.trim(),
      creditValue,
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
    };

    setSaving(true);
    setFormError('');
    setActionError('');
    setSuccess('');

    try {
      if (editing) {
        const updated = await updateCourse(token, editing.id, input);

        setCourses((current) =>
          current.map((course) =>
            course.id === updated.id ? updated : course,
          ),
        );

        setSuccess('Course updated successfully.');
      } else {
        const created = await createCourse(token, input);

        setCourses((current) =>
          [...current, created].sort((a, b) => a.title.localeCompare(b.title)),
        );

        setSuccess('Course created successfully.');
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

  async function handleDelete(course: CourseRecord) {
    if (!token || deletingId || saving) {
      return;
    }

    if (
      !window.confirm(
        `Delete course "${course.title}" (${course.code})? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(course.id);
    setActionError('');
    setSuccess('');

    try {
      await deleteCourse(token, course.id);

      setCourses((current) => current.filter((item) => item.id !== course.id));

      if (editing?.id === course.id) {
        setFormOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
      }

      setSuccess('Course deleted successfully.');
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen size={16} aria-hidden="true" />
            Academic management
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Courses
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Manage course details, academic departments, and credit values.
          </p>
        </div>

        <button
          type="button"
          onClick={formOpen ? closeForm : openCreate}
          disabled={saving || deletingId !== null || departments.length === 0}
          className={primaryButton}
        >
          {formOpen ? <X size={16} /> : <Plus size={16} />}
          {formOpen ? 'Close form' : 'Add course'}
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

      {!loading && !displayLoadError && departments.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">A department is required first.</p>
          <p className="mt-1 text-muted-foreground">
            Create a department before adding courses.
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
              {editing ? 'Edit course' : 'Create course'}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {editing
                ? 'Update the course information.'
                : 'Add a course to your academic catalog.'}
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
              <label
                htmlFor="course-department"
                className="text-sm font-medium"
              >
                Department
              </label>

              <select
                id="course-department"
                required
                value={form.departmentId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    departmentId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="" disabled>
                  Select a department
                </option>

                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.code} — {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="course-code" className="text-sm font-medium">
                Course code
              </label>

              <input
                id="course-code"
                required
                minLength={2}
                maxLength={20}
                autoComplete="off"
                placeholder="e.g. CS101"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                className={inputClass}
              />

              <p className="text-xs text-muted-foreground">
                2–20 characters; unique across the institution.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="course-title" className="text-sm font-medium">
                Course title
              </label>

              <input
                id="course-title"
                required
                minLength={2}
                maxLength={150}
                placeholder="e.g. Introduction to Programming"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="course-credits" className="text-sm font-medium">
                Credit value
              </label>

              <input
                id="course-credits"
                type="number"
                required
                min={1}
                max={1000}
                step={1}
                value={form.creditValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    creditValue: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="course-description"
                className="text-sm font-medium"
              >
                Description{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>

              <textarea
                id="course-description"
                maxLength={5000}
                rows={4}
                placeholder="Describe the course content and learning objectives..."
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={inputClass}
              />

              <p className="text-right text-xs text-muted-foreground">
                {form.description.length}/5000
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
                  : 'Create course'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold">Course catalog</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading records…'
                : `${filtered.length} of ${courses.length} courses`}
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <span className="sr-only">Search courses</span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courses..."
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
                onClick={() => setRetry((value) => value + 1)}
                className="mt-3 text-sm font-medium text-primary underline underline-offset-4"
              >
                Retry
              </button>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-3 p-5" aria-label="Loading courses">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
              <BookOpen size={22} aria-hidden="true" />
            </span>

            <h3 className="mt-4 font-semibold">
              {courses.length ? 'No matching courses' : 'No courses yet'}
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              {courses.length
                ? 'Try a different search term.'
                : 'Create your first course to start building the academic catalog.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Course
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Department
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Credits
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filtered.map((course) => {
                  const department = departmentById.get(course.departmentId);

                  return (
                    <tr
                      key={course.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="max-w-xs px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <BookOpen size={17} aria-hidden="true" />
                          </span>

                          <div className="min-w-0">
                            <p className="font-medium">{course.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {course.description || 'No description'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs">
                          {course.code}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {department ? (
                          <div>
                            <p className="font-medium">{department.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {department.code}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Department unavailable
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                          {course.creditValue}{' '}
                          {course.creditValue === 1 ? 'credit' : 'credits'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${course.title}`}
                            title="Edit course"
                            onClick={() => openEdit(course)}
                            disabled={saving || deletingId !== null}
                            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            aria-label={`Delete ${course.title}`}
                            title="Delete course"
                            onClick={() => void handleDelete(course)}
                            disabled={saving || deletingId !== null}
                            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          >
                            {deletingId === course.id ? (
                              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
