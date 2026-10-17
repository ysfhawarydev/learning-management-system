import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createStudent,
  deleteStudent,
  getDepartments,
  getStudents,
  updateStudent,
} from '../lib/api';
import type { Department, Student, UpdateStudentInput } from '../lib/api';

const TODAY = new Date().toISOString().slice(0, 10);

const STUDENT_STATUSES = [
  'applicant',
  'enrolled',
  'on_leave',
  'probation',
  'graduated',
  'withdrawn',
] as const;

interface StudentForm {
  email: string;
  password: string;
  departmentId: string;
  number: string;
  firstName: string;
  lastName: string;
  birth: string;
}

interface EditStudentForm {
  departmentId: string;
  number: string;
  firstName: string;
  lastName: string;
  birth: string;
  status: NonNullable<UpdateStudentInput['status']>;
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

function getEditForm(student: Student): EditStudentForm {
  const status = STUDENT_STATUSES.find((item) => item === student.status);

  return {
    departmentId: student.departmentId,
    number: student.number,
    firstName: student.firstName,
    lastName: student.lastName,
    birth: student.birth?.slice(0, 10) ?? '',
    status: status ?? 'enrolled',
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

const inputClassName =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring';

const labelClassName = 'text-sm font-medium';

const secondaryButtonClassName =
  'rounded-lg border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

const errorClassName =
  'rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive';

export function StudentsPage() {
  const { token } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditStudentForm | null>(null);

  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [retryCount, setRetryCount] = useState(0);
  const [form, setForm] = useState<StudentForm>(INITIAL_FORM);

  const editingStudentId = editingStudent?.id;

  useEffect(() => {
    if (!token) {
      return;
    }

    const accessToken: string = token;
    let cancelled = false;

    async function loadStudents() {
      setIsLoading(true);
      setLoadError('');

      try {
        const result = await getStudents(accessToken);

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
    if (!token || (!isFormOpen && !editingStudentId)) {
      return;
    }

    const accessToken: string = token;
    let cancelled = false;

    async function loadDepartments() {
      setIsDepartmentsLoading(true);

      if (editingStudentId) {
        setEditError('');
      } else {
        setCreateError('');
      }

      try {
        const result = await getDepartments(accessToken);

        if (!cancelled) {
          setDepartments(result);

          if (isFormOpen) {
            setForm((current) => ({
              ...current,
              departmentId: current.departmentId || result[0]?.id || '',
            }));
          }
        }
      } catch (error: unknown) {
        if (!cancelled) {
          if (editingStudentId) {
            setEditError(getErrorMessage(error));
          } else {
            setCreateError(getErrorMessage(error));
          }
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
  }, [token, isFormOpen, editingStudentId]);

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
        student.departmentName,
        student.status,
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
    if (isFormOpen) {
      setIsFormOpen(false);
      setForm(INITIAL_FORM);
    } else {
      cancelEditing();
      setIsFormOpen(true);
    }

    setCreateError('');
    setEditError('');
    setDeleteError('');
    setSuccessMessage('');
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setCreateError('');
  }

  function startEditing(student: Student) {
    setIsFormOpen(false);
    setForm(INITIAL_FORM);
    setCreateError('');

    setEditingStudent(student);
    setEditForm(getEditForm(student));

    setEditError('');
    setDeleteError('');
    setSuccessMessage('');
  }

  function cancelEditing() {
    setEditingStudent(null);
    setEditForm(null);
    setEditError('');
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

  async function handleUpdateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !editingStudent || !editForm) {
      setEditError('Your session has expired. Please sign in again.');
      return;
    }

    setIsUpdating(true);
    setEditError('');
    setDeleteError('');
    setSuccessMessage('');

    try {
      const updatedStudent = await updateStudent(token, editingStudent.id, {
        departmentId: editForm.departmentId,
        number: editForm.number.trim(),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        birth: editForm.birth,
        status: editForm.status,
      });

      setStudents((current) =>
        current.map((student) =>
          student.id === updatedStudent.id ? updatedStudent : student,
        ),
      );

      setEditingStudent(null);
      setEditForm(null);
      setSuccessMessage('Student updated successfully.');
    } catch (error: unknown) {
      setEditError(getErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteStudent(student: Student) {
    if (!token || isDeletingId || isUpdating) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${student.firstName} ${student.lastName} (${student.number})?`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingId(student.id);
    setDeleteError('');
    setSuccessMessage('');

    try {
      await deleteStudent(token, student.id);

      setStudents((current) =>
        current.filter((item) => item.id !== student.id),
      );

      if (editingStudent?.id === student.id) {
        cancelEditing();
      }

      setSuccessMessage('Student deleted successfully.');
    } catch (error: unknown) {
      setDeleteError(getErrorMessage(error));
    } finally {
      setIsDeletingId(null);
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
          disabled={isCreating || isUpdating || isDeletingId !== null}
          className={primaryButtonClassName}
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

      {deleteError && (
        <div role="alert" className={errorClassName}>
          {deleteError}
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
            <div role="alert" className={`mb-4 ${errorClassName}`}>
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateStudent} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="firstName" className={labelClassName}>
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
                  className={inputClassName}
                  placeholder="First name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="lastName" className={labelClassName}>
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
                  className={inputClassName}
                  placeholder="Last name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className={labelClassName}>
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
                  className={inputClassName}
                  placeholder="student@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className={labelClassName}>
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
                  className={inputClassName}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="number" className={labelClassName}>
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
                  className={inputClassName}
                  placeholder="e.g. 2026001"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="departmentId" className={labelClassName}>
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
                  className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-60`}
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
                <label htmlFor="birth" className={labelClassName}>
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
                  className={`${inputClassName} sm:max-w-sm`}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={isCreating}
                className={secondaryButtonClassName}
              >
                Reset
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                disabled={isCreating}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isCreating || isDepartmentsLoading || departments.length === 0
                }
                className={primaryButtonClassName}
              >
                {isCreating ? 'Creating student...' : 'Create student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingStudent && editForm && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Edit student</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update {editingStudent.firstName} {editingStudent.lastName}'s
              profile.
            </p>
          </div>

          {editError && (
            <div role="alert" className={`mb-4 ${errorClassName}`}>
              {editError}
            </div>
          )}

          <form onSubmit={handleUpdateStudent} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="edit-firstName" className={labelClassName}>
                  First name
                </label>
                <input
                  id="edit-firstName"
                  required
                  minLength={1}
                  maxLength={100}
                  value={editForm.firstName}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      firstName: event.target.value,
                    })
                  }
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-lastName" className={labelClassName}>
                  Last name
                </label>
                <input
                  id="edit-lastName"
                  required
                  minLength={1}
                  maxLength={100}
                  value={editForm.lastName}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      lastName: event.target.value,
                    })
                  }
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-number" className={labelClassName}>
                  Student number
                </label>
                <input
                  id="edit-number"
                  required
                  minLength={1}
                  maxLength={30}
                  value={editForm.number}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      number: event.target.value,
                    })
                  }
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-department" className={labelClassName}>
                  Department
                </label>
                <select
                  id="edit-department"
                  required
                  value={editForm.departmentId}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      departmentId: event.target.value,
                    })
                  }
                  disabled={isDepartmentsLoading || departments.length === 0}
                  className={`${inputClassName} disabled:opacity-60`}
                >
                  <option value="">Select a department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-birth" className={labelClassName}>
                  Date of birth
                </label>
                <input
                  id="edit-birth"
                  type="date"
                  required
                  max={TODAY}
                  value={editForm.birth}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      birth: event.target.value,
                    })
                  }
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-status" className={labelClassName}>
                  Status
                </label>
                <select
                  id="edit-status"
                  required
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      status: event.target.value as EditStudentForm['status'],
                    })
                  }
                  className={`${inputClassName} capitalize`}
                >
                  {STUDENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isUpdating}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isUpdating || isDepartmentsLoading || departments.length === 0
                }
                className={primaryButtonClassName}
              >
                {isUpdating ? 'Saving changes...' : 'Save changes'}
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
              {filteredStudents.length} student
              {filteredStudents.length === 1 ? '' : 's'} found
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
              className={`${inputClassName} py-2.5 pl-9`}
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
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Date of birth</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
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
                      {student.departmentName || '—'}
                    </td>

                    <td className="px-4 py-4 text-muted-foreground">
                      {student.birth ? student.birth.slice(0, 10) : '—'}
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                        {String(student.status ?? 'unknown').replaceAll(
                          '_',
                          ' ',
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(student)}
                          disabled={isUpdating || isDeletingId !== null}
                          aria-label={`Edit ${student.firstName} ${student.lastName}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteStudent(student)}
                          disabled={isDeletingId !== null || isUpdating}
                          aria-label={`Delete ${student.firstName} ${student.lastName}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeletingId === student.id
                            ? 'Deleting...'
                            : 'Delete'}
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
