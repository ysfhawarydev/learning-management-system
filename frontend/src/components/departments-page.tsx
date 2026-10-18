import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createDepartment,
  deleteDepartment,
  getAcademicDepartments,
  updateDepartment,
} from '@/lib/api';
import type { DepartmentRecord, CreateDepartmentInput } from '@/lib/api';

const EMPTY_FORM = { code: '', name: '', description: '' };

type DepartmentForm = typeof EMPTY_FORM;

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

export function DepartmentsPage() {
  const { token } = useAuth();

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DepartmentForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
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
        const result = await getAcademicDepartments(authToken);

        if (!cancelled) {
          setDepartments(result);
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return departments;
    }

    return departments.filter((department) =>
      [department.code, department.name, department.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [departments, search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setActionError('');
    setSuccess('');
    setFormOpen(true);
  }

  function openEdit(department: DepartmentRecord) {
    setEditing(department);
    setForm({
      code: department.code,
      name: department.name,
      description: department.description ?? '',
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

    const input: CreateDepartmentInput = {
      code: form.code.trim(),
      name: form.name.trim(),
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
    };

    if (!input.code || !input.name) {
      setFormError('Department code and name are required.');
      return;
    }

    setSaving(true);
    setFormError('');
    setActionError('');
    setSuccess('');

    try {
      if (editing) {
        const updated = await updateDepartment(token, editing.id, input);

        setDepartments((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );

        setSuccess('Department updated successfully.');
      } else {
        const created = await createDepartment(token, input);

        setDepartments((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
        );

        setSuccess('Department created successfully.');
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

  async function handleDelete(department: DepartmentRecord) {
    if (!token || deletingId || saving) {
      return;
    }

    if (
      !window.confirm(
        `Delete department "${department.name}" (${department.code})? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(department.id);
    setActionError('');
    setSuccess('');

    try {
      await deleteDepartment(token, department.id);

      setDepartments((current) =>
        current.filter((item) => item.id !== department.id),
      );

      if (editing?.id === department.id) {
        setFormOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
      }

      setSuccess('Department deleted successfully.');
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
            <Building2 size={16} aria-hidden="true" />
            Academic management
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Departments
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Organize academic departments and maintain their institutional
            codes.
          </p>
        </div>

        <button
          type="button"
          onClick={formOpen ? closeForm : openCreate}
          disabled={saving || deletingId !== null}
          className={primaryButton}
        >
          {formOpen ? <X size={16} /> : <Plus size={16} />}
          {formOpen ? 'Close form' : 'Add department'}
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

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <div>
            <h2 className="font-semibold">
              {editing ? 'Edit department' : 'Create department'}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {editing
                ? 'Update the department information.'
                : 'Add a department to your academic organization.'}
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
              <label htmlFor="department-code" className="text-sm font-medium">
                Department code
              </label>

              <input
                id="department-code"
                required
                minLength={2}
                maxLength={20}
                autoComplete="off"
                placeholder="e.g. CS"
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
                2–20 characters. Codes are normalized by the server.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="department-name" className="text-sm font-medium">
                Department name
              </label>

              <input
                id="department-name"
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Computer Science"
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

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="department-description"
                className="text-sm font-medium"
              >
                Description{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>

              <textarea
                id="department-description"
                maxLength={1000}
                rows={3}
                placeholder="Describe the department's academic focus..."
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
                {form.description.length}/1000
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
                  : 'Create department'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold">All departments</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading records…'
                : `${filtered.length} of ${departments.length} departments`}
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <span className="sr-only">Search departments</span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments..."
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
          <div className="space-y-3 p-5" aria-label="Loading departments">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
              <Building2 size={22} aria-hidden="true" />
            </span>

            <h3 className="mt-4 font-semibold">
              {departments.length
                ? 'No matching departments'
                : 'No departments yet'}
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              {departments.length
                ? 'Try a different search term.'
                : 'Create your first department to start organizing academic records.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Department
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Description
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filtered.map((department) => (
                  <tr
                    key={department.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Building2 size={17} aria-hidden="true" />
                        </span>

                        <span className="font-medium">{department.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs">
                        {department.code}
                      </span>
                    </td>

                    <td className="max-w-sm px-5 py-4 text-muted-foreground">
                      <span className="line-clamp-2">
                        {department.description || 'No description'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${department.name}`}
                          title="Edit department"
                          onClick={() => openEdit(department)}
                          disabled={saving || deletingId !== null}
                          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`Delete ${department.name}`}
                          title="Delete department"
                          onClick={() => void handleDelete(department)}
                          disabled={saving || deletingId !== null}
                          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          {deletingId === department.id ? (
                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Trash2 size={16} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
