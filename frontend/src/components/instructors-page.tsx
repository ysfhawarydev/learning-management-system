import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createInstructorAccount,
  deleteInstructor,
  getAcademicDepartments,
  getInstructors,
  updateInstructor,
} from '@/lib/api';
import type {
  CreateInstructorAccountInput,
  DepartmentRecord,
  InstructorRecord,
  UpdateInstructorInput,
} from '@/lib/api';

type InstructorForm = CreateInstructorAccountInput;

type EditForm = Required<
  Pick<
    UpdateInstructorInput,
    'departmentId' | 'employeeNumber' | 'firstName' | 'lastName'
  >
> & { phone: string };

const EMPTY_FORM: InstructorForm = {
  email: '',
  password: '',
  departmentId: '',
  employeeNumber: '',
  firstName: '',
  lastName: '',
  phone: '',
};

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';

const labelClass = 'mb-1.5 block text-sm font-medium';

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function getEditForm(instructor: InstructorRecord): EditForm {
  return {
    departmentId: instructor.departmentId,
    employeeNumber: instructor.employeeNumber,
    firstName: instructor.firstName,
    lastName: instructor.lastName,
    phone: instructor.phone ?? '',
  };
}

export function InstructorsPage() {
  const { token } = useAuth();

  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorRecord | null>(null);
  const [form, setForm] = useState<InstructorForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [instructorRecords, departmentRecords] = await Promise.all([
          getInstructors(token!),
          getAcademicDepartments(token!),
        ]);

        if (!cancelled) {
          setInstructors(instructorRecords);
          setDepartments(departmentRecords);
          setForm((current) => ({
            ...current,
            departmentId:
              current.departmentId || departmentRecords[0]?.id || '',
          }));
        }
      } catch (error) {
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

  const filteredInstructors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return instructors;

    return instructors.filter((instructor) =>
      [
        instructor.firstName,
        instructor.lastName,
        instructor.employeeNumber,
        instructor.departmentName,
        instructor.phone,
      ].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [instructors, search]);

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditForm(null);
    setFormError('');
  }

  function startCreate() {
    setNotice('');
    setFormError('');
    setEditing(null);
    setEditForm(null);
    setForm({
      ...EMPTY_FORM,
      departmentId: departments[0]?.id ?? '',
    });
    setFormOpen(true);
  }

  function startEdit(instructor: InstructorRecord) {
    setNotice('');
    setFormError('');
    setFormOpen(false);
    setEditing(instructor);
    setEditForm(getEditForm(instructor));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setFormError('');
    setNotice('');

    try {
      const created = await createInstructorAccount(token, {
        ...form,
        email: form.email.trim(),
        employeeNumber: form.employeeNumber.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone?.trim() || undefined,
      });

      setInstructors((current) =>
        [...current, created].sort((a, b) =>
          a.lastName.localeCompare(b.lastName),
        ),
      );
      closeForm();
      setNotice('Instructor account created successfully.');
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editing || !editForm) return;

    setSaving(true);
    setFormError('');
    setNotice('');

    try {
      const updated = await updateInstructor(token, editing.id, {
        ...editForm,
        employeeNumber: editForm.employeeNumber.trim(),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim() || null,
      });

      setInstructors((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      closeForm();
      setNotice('Instructor profile updated successfully.');
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(instructor: InstructorRecord) {
    if (!token) return;

    const confirmed = window.confirm(
      `Delete the profile for ${instructor.firstName} ${instructor.lastName}?\n\nThis removes the instructor profile, not necessarily their login account.`,
    );

    if (!confirmed) return;

    setDeletingId(instructor.id);
    setNotice('');
    setLoadError('');

    try {
      await deleteInstructor(token, instructor.id);
      setInstructors((current) =>
        current.filter((item) => item.id !== instructor.id),
      );
      setNotice('Instructor profile deleted.');
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  const total = instructors.length;
  const departmentCount = new Set(
    instructors.map((instructor) => instructor.departmentId),
  ).size;

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">People management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Instructors
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage instructor profiles and create accounts for your teaching
            staff.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          disabled={departments.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={17} aria-hidden="true" />
          Add instructor
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total instructors</p>
            <UsersRound size={19} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Instructor profiles in the system
          </p>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Departments covered</p>
            <UserRound size={19} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {departmentCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Departments with instructor profiles
          </p>
        </article>
      </section>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={17} aria-hidden="true" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="font-medium underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      )}

      {(formOpen || (editing && editForm)) && (
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                {editing
                  ? 'Edit instructor profile'
                  : 'Create instructor account'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {editing
                  ? 'Update profile and department details.'
                  : 'The new account will be created as an active instructor.'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form
            onSubmit={editing ? handleUpdate : handleCreate}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!editing && (
                <>
                  <label className="text-sm">
                    <span className={labelClass}>Email address</span>
                    <input
                      className={inputClass}
                      type="email"
                      autoComplete="off"
                      maxLength={255}
                      required
                      value={form.email}
                      onChange={(event) =>
                        setForm({ ...form, email: event.target.value })
                      }
                      placeholder="instructor@university.edu"
                    />
                  </label>
                  <label className="text-sm">
                    <span className={labelClass}>Temporary password</span>
                    <input
                      className={inputClass}
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      value={form.password}
                      onChange={(event) =>
                        setForm({ ...form, password: event.target.value })
                      }
                      placeholder="At least 12 characters"
                    />
                  </label>
                </>
              )}

              <label className="text-sm">
                <span className={labelClass}>First name</span>
                <input
                  className={inputClass}
                  maxLength={100}
                  required
                  value={editing ? (editForm?.firstName ?? '') : form.firstName}
                  onChange={(event) =>
                    editing
                      ? setEditForm((current) =>
                          current
                            ? { ...current, firstName: event.target.value }
                            : current,
                        )
                      : setForm({ ...form, firstName: event.target.value })
                  }
                />
              </label>

              <label className="text-sm">
                <span className={labelClass}>Last name</span>
                <input
                  className={inputClass}
                  maxLength={100}
                  required
                  value={editing ? (editForm?.lastName ?? '') : form.lastName}
                  onChange={(event) =>
                    editing
                      ? setEditForm((current) =>
                          current
                            ? { ...current, lastName: event.target.value }
                            : current,
                        )
                      : setForm({ ...form, lastName: event.target.value })
                  }
                />
              </label>

              <label className="text-sm">
                <span className={labelClass}>Employee number</span>
                <input
                  className={inputClass}
                  maxLength={30}
                  required
                  value={
                    editing
                      ? (editForm?.employeeNumber ?? '')
                      : form.employeeNumber
                  }
                  onChange={(event) =>
                    editing
                      ? setEditForm((current) =>
                          current
                            ? { ...current, employeeNumber: event.target.value }
                            : current,
                        )
                      : setForm({ ...form, employeeNumber: event.target.value })
                  }
                />
              </label>

              <label className="text-sm">
                <span className={labelClass}>Department</span>
                <select
                  className={inputClass}
                  required
                  value={
                    editing ? (editForm?.departmentId ?? '') : form.departmentId
                  }
                  onChange={(event) =>
                    editing
                      ? setEditForm((current) =>
                          current
                            ? { ...current, departmentId: event.target.value }
                            : current,
                        )
                      : setForm({ ...form, departmentId: event.target.value })
                  }
                >
                  <option value="" disabled>
                    Select department
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className={labelClass}>Phone (optional)</span>
                <input
                  className={inputClass}
                  maxLength={50}
                  type="tel"
                  value={editing ? (editForm?.phone ?? '') : (form.phone ?? '')}
                  onChange={(event) =>
                    editing
                      ? setEditForm((current) =>
                          current
                            ? { ...current, phone: event.target.value }
                            : current,
                        )
                      : setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="+20..."
                />
              </label>
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                {formError}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || departments.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save changes'
                    : 'Create account'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold">Instructor directory</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredInstructors.length} of {total} instructors
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              className={`${inputClass} pl-9`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search instructors..."
              aria-label="Search instructors"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
            Loading instructors...
          </div>
        ) : filteredInstructors.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UsersRound
              size={28}
              className="mx-auto text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="mt-3 font-medium">
              {search ? 'No matching instructors' : 'No instructors yet'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? 'Try a different name, employee number, or department.'
                : 'Create an instructor account to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Instructor</th>
                  <th className="px-5 py-3 font-medium">Employee no.</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInstructors.map((instructor) => (
                  <tr
                    key={instructor.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {instructor.firstName.charAt(0)}
                          {instructor.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">
                            {instructor.firstName} {instructor.lastName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Profile ID: {instructor.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {instructor.employeeNumber}
                    </td>
                    <td className="px-5 py-4">{instructor.departmentName}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {instructor.phone || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${instructor.firstName} ${instructor.lastName}`}
                          title="Edit profile"
                          onClick={() => startEdit(instructor)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${instructor.firstName} ${instructor.lastName}`}
                          title="Delete profile"
                          disabled={deletingId === instructor.id}
                          onClick={() => void handleDelete(instructor)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          {deletingId === instructor.id ? (
                            <LoaderCircle
                              size={16}
                              className="animate-spin"
                              aria-hidden="true"
                            />
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
      </section>

      {departments.length === 0 && !loading && !loadError && (
        <p className="text-sm text-muted-foreground">
          Create a department first before adding instructor accounts.
        </p>
      )}
    </div>
  );
}
