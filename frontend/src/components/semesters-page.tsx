import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import {
  ApiError,
  createSemester,
  deleteSemester,
  getSemesters,
  updateSemester,
} from '@/lib/api';
import type {
  CreateSemesterInput,
  SemesterRecord,
  SemesterStatus,
  SemesterTerm,
} from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

const TERMS: { value: SemesterTerm; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

const STATUSES: { value: SemesterStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY_FORM = {
  academicYear: '',
  term: 'fall' as SemesterTerm,
  status: 'planned' as SemesterStatus,
  startDate: '',
  endDate: '',
};

const inputClass =
  'mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function statusClass(status: SemesterStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'completed':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'cancelled':
      return 'bg-red-500/10 text-red-700 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function readable(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SemestersPage() {
  const { token } = useAuth();

  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<SemesterRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const displayLoadError = !token
    ? 'Your session is unavailable. Please sign in again.'
    : loadError;

  useEffect(() => {
    if (!token) return;

    const authToken = token;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError('');

      try {
        const result = await getSemesters(authToken);
        if (!cancelled) setSemesters(result);
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, retry]);

  const filteredSemesters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return semesters.filter((semester) => {
      const matchesSearch =
        !query ||
        semester.academicYear.toLowerCase().includes(query) ||
        semester.term.toLowerCase().includes(query) ||
        semester.status.toLowerCase().includes(query);

      const matchesTerm = termFilter === 'all' || semester.term === termFilter;

      const matchesStatus =
        statusFilter === 'all' || semester.status === statusFilter;

      return matchesSearch && matchesTerm && matchesStatus;
    });
  }, [semesters, search, termFilter, statusFilter]);

  function openCreateForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setNotice('');
    setIsFormOpen(true);
  }

  function openEditForm(semester: SemesterRecord) {
    setEditing(semester);
    setForm({
      academicYear: semester.academicYear,
      term: semester.term,
      status: semester.status,
      startDate: semester.startDate.slice(0, 10),
      endDate: semester.endDate.slice(0, 10),
    });
    setFormError('');
    setNotice('');
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || isSaving) return;

    const academicYear = form.academicYear.trim();

    if (!academicYear) {
      setFormError('Enter an academic year.');
      return;
    }

    if (academicYear.length > 50) {
      setFormError('Academic year must be 50 characters or fewer.');
      return;
    }

    if (!form.startDate || !form.endDate) {
      setFormError('Enter both the start date and end date.');
      return;
    }

    if (form.startDate > form.endDate) {
      setFormError('The start date must be on or before the end date.');
      return;
    }

    const input: CreateSemesterInput = {
      academicYear,
      term: form.term,
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
    };

    setIsSaving(true);
    setFormError('');

    try {
      if (editing) {
        const updated = await updateSemester(token, editing.id, input);
        setSemesters((current) =>
          current.map((semester) =>
            semester.id === updated.id ? updated : semester,
          ),
        );
        setNotice('Semester updated successfully.');
      } else {
        const created = await createSemester(token, input);
        setSemesters((current) =>
          [...current, created].sort((a, b) =>
            a.startDate.localeCompare(b.startDate),
          ),
        );
        setNotice('Semester created successfully.');
      }

      setIsFormOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(semester: SemesterRecord) {
    if (!token || deletingId) return;

    const confirmed = window.confirm(
      `Delete ${semester.academicYear} ${semester.term}? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(semester.id);
    setNotice('');

    try {
      await deleteSemester(token, semester.id);
      setSemesters((current) =>
        current.filter((item) => item.id !== semester.id),
      );
      setNotice('Semester deleted successfully.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  const activeCount = semesters.filter(
    (semester) => semester.status === 'active',
  ).length;

  const plannedCount = semesters.filter(
    (semester) => semester.status === 'planned',
  ).length;

  const completedCount = semesters.filter(
    (semester) => semester.status === 'completed',
  ).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            Academic structure
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Semesters
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Organize academic years, manage terms, and track semester dates and
            status.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className={primaryButtonClass}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add semester
        </button>
      </section>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Dismiss message"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total semesters', value: semesters.length },
          { label: 'Active', value: activeCount },
          { label: 'Planned', value: plannedCount },
          { label: 'Completed', value: completedCount },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search academic years or terms..."
              aria-label="Search semesters"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>

          <select
            value={termFilter}
            onChange={(event) => setTermFilter(event.target.value)}
            aria-label="Filter by term"
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            <option value="all">All terms</option>
            {TERMS.map((term) => (
              <option key={term.value} value={term.value}>
                {term.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {displayLoadError ? (
          <div className="p-8 text-center">
            <p role="alert" className="text-sm text-destructive">
              {displayLoadError}
            </p>
            {token && (
              <button
                type="button"
                onClick={() => setRetry((count) => count + 1)}
                className={`${secondaryButtonClass} mt-4`}
              >
                Try again
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading semesters...
          </div>
        ) : filteredSemesters.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CalendarDays className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-medium">
              {semesters.length === 0
                ? 'No semesters yet'
                : 'No matching semesters'}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {semesters.length === 0
                ? 'Create your first semester to start organizing the academic calendar.'
                : 'Try adjusting your search or filters.'}
            </p>
            {semesters.length === 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className={`${primaryButtonClass} mt-5`}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add semester
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Academic year</th>
                  <th className="px-5 py-3.5 font-medium">Term</th>
                  <th className="px-5 py-3.5 font-medium">Dates</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSemesters.map((semester) => (
                  <tr
                    key={semester.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4 font-medium">
                      {semester.academicYear}
                    </td>
                    <td className="px-5 py-4">{readable(semester.term)}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <span>{formatDate(semester.startDate)}</span>
                      <span className="mx-2">–</span>
                      <span>{formatDate(semester.endDate)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(semester.status)}`}
                      >
                        {readable(semester.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(semester)}
                          aria-label={`Edit ${semester.academicYear} ${semester.term}`}
                          title="Edit semester"
                          className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(semester)}
                          disabled={deletingId === semester.id}
                          aria-label={`Delete ${semester.academicYear} ${semester.term}`}
                          title="Delete semester"
                          className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !displayLoadError && (
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Showing {filteredSemesters.length} of {semesters.length} semesters
          </div>
        )}
      </section>

      {isFormOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="semester-form-title"
            className="my-auto w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="semester-form-title" className="text-lg font-semibold">
                  {editing ? 'Edit semester' : 'Create semester'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure the academic year, term, dates, and status.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                aria-label="Close form"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="semester-academic-year"
                  className="text-sm font-medium"
                >
                  Academic year
                </label>
                <input
                  id="semester-academic-year"
                  value={form.academicYear}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      academicYear: event.target.value,
                    }))
                  }
                  placeholder="e.g. 2026-2027"
                  maxLength={50}
                  required
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="semester-term"
                    className="text-sm font-medium"
                  >
                    Term
                  </label>
                  <select
                    id="semester-term"
                    value={form.term}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        term: event.target.value as SemesterTerm,
                      }))
                    }
                    className={inputClass}
                  >
                    {TERMS.map((term) => (
                      <option key={term.value} value={term.value}>
                        {term.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="semester-status"
                    className="text-sm font-medium"
                  >
                    Status
                  </label>
                  <select
                    id="semester-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as SemesterStatus,
                      }))
                    }
                    className={inputClass}
                  >
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="semester-start-date"
                    className="text-sm font-medium"
                  >
                    Start date
                  </label>
                  <input
                    id="semester-start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="semester-end-date"
                    className="text-sm font-medium"
                  >
                    End date
                  </label>
                  <input
                    id="semester-end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    min={form.startDate || undefined}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={primaryButtonClass}
                >
                  {isSaving
                    ? 'Saving...'
                    : editing
                      ? 'Save changes'
                      : 'Create semester'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
