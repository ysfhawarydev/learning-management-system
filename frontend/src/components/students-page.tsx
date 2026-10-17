import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Search, Users, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createStudent,
  getDepartments,
  getStudents,
} from '../lib/api';
import type { Department, Student } from '../lib/api';

const TODAY = new Date().toISOString().slice(0, 10);

interface StudentForm {
  email: string;
  password: string;
  departmentId: string;
  number: string;
  firstName: string;
  lastName: string;
  birth: string;
}

const INITIAL_FORM: StudentForm = {
  email: '',
  password: '',
  departmentId: '',
  number: '',
  firstName: '',
  lastName: '',
  birth: '',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export function StudentsPage() {
  const { token } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [form, setForm] = useState<StudentForm>(INITIAL_FORM);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadStudents() {
      setIsLoading(true);
      setLoadError('');

      try {
        const result = await getStudents(token!);

        if (!cancelled) {
          setStudents(result);
        }
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

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, [token, retryCount]);

  useEffect(() => {
    if (!token || !isFormOpen) {
      return;
    }

    let cancelled = false;

    async function loadDepartments() {
      setIsDepartmentsLoading(true);
      setCreateError('');

      try {
        const result = await getDepartments(token!);

        if (!cancelled) {
          setDepartments(result);

          setForm((current) => ({
            ...current,
            departmentId: current.departmentId || result[0]?.id || '',
          }));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setCreateError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsDepartmentsLoading(false);
        }
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [token, isFormOpen]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter((student) => {
      const searchableValues = [
        student.firstName,
        student.lastName,
        student.number,
        student.id,
      ];

      return searchableValues.some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      );
    });
  }, [students, search]);

  function updateForm<K extends keyof StudentForm>(
    field: K,
    value: StudentForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleForm() {
    setIsFormOpen((current) => !current);
    setCreateError('');
    setSuccessMessage('');
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setCreateError('');
  }

  async function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setCreateError('Your session has expired. Please sign in again.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    setSuccessMessage('');

    try {
      await createStudent(token, {
        ...form,
        email: form.email.trim(),
        number: form.number.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });

      setSuccessMessage('Student created successfully.');
      setForm(INITIAL_FORM);
      setIsFormOpen(false);
      setRetryCount((current) => current + 1);
    } catch (error: unknown) {
      setCreateError(getErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage student accounts and profiles.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {isFormOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isFormOpen ? 'Close form' : 'Add Student'}
        </button>
      </div>

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
        >
          {successMessage}
        </div>
      )}

      {isFormOpen && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Create student account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the student's login credentials and profile together.
            </p>
          </div>

          {createError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateStudent} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  minLength={1}
                  maxLength={100}
                  value={form.firstName}
                  onChange={(event) =>
                    updateForm('firstName', event.target.value)
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="First name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  minLength={1}
                  maxLength={100}
                  value={form.lastName}
                  onChange={(event) =>
                    updateForm('lastName', event.target.value)
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Last name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="student@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Temporary password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={(event) =>
                    updateForm('password', event.target.value)
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="number" className="text-sm font-medium">
                  Student number
                </label>
                <input
                  id="number"
                  name="number"
                  type="text"
                  required
                  minLength={1}
                  maxLength={30}
                  value={form.number}
                  onChange={(event) => updateForm('number', event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. 2026001"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="departmentId" className="text-sm font-medium">
                  Department
                </label>
                <select
                  id="departmentId"
                  name="departmentId"
                  required
                  value={form.departmentId}
                  onChange={(event) =>
                    updateForm('departmentId', event.target.value)
                  }
                  disabled={isDepartmentsLoading || departments.length === 0}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {isDepartmentsLoading
                      ? 'Loading departments...'
                      : departments.length === 0
                        ? 'No departments available'
                        : 'Select a department'}
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="birth" className="text-sm font-medium">
                  Date of birth
                </label>
                <input
                  id="birth"
                  name="birth"
                  type="date"
                  required
                  max={TODAY}
                  value={form.birth}
                  onChange={(event) => updateForm('birth', event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-sm"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  toggleForm();
                  resetForm();
                }}
                disabled={isCreating}
                className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isCreating || isDepartmentsLoading || departments.length === 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? 'Creating student...' : 'Create student'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">All students</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {students.length} student
              {students.length === 1 ? '' : 's'} found
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students..."
              aria-label="Search students"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setRetryCount((current) => current + 1)}
              className="mt-2 font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            Loading students...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">
              {search.trim() ? 'No matching students' : 'No students yet'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {search.trim()
                ? 'Try another search term.'
                : 'Create a student account to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Student number</th>
                  <th className="px-4 py-3 font-medium">Date of birth</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {student.firstName} {student.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {student.number}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {student.birth ? String(student.birth).slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                        {String(student.status ?? 'unknown').replaceAll(
                          '_',
                          ' ',
                        )}
                      </span>
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
