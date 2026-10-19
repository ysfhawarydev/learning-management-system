import {
  AlertCircle,
  CalendarCheck,
  Check,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createAttendance,
  deleteAttendance,
  getAttendance,
  getCourseOfferings,
  getCourses,
  getEnrollments,
  getStudents,
  updateAttendance,
} from '@/lib/api';
import type {
  AttendanceRecord,
  AttendanceStatus,
  CourseOfferingRecord,
  CourseRecord,
  EnrollmentRecord,
  Student,
} from '@/lib/api';

const TODAY = new Date().toISOString().slice(0, 10);

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60';

const statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

type AttendanceForm = {
  enrollmentId: string;
  sessionDate: string;
  status: AttendanceStatus;
  notes: string;
};

const emptyForm: AttendanceForm = {
  enrollmentId: '',
  sessionDate: TODAY,
  status: 'present',
  notes: '',
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

function statusClass(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'absent':
      return 'bg-destructive/10 text-destructive';
    case 'late':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'excused':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-400';
  }
}

function humanize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AttendancePage() {
  const { token } = useAuth();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [form, setForm] = useState<AttendanceForm>(emptyForm);

  const [retryCount, setRetryCount] = useState(0);

  const loading = Boolean(token) && isLoading;
  const displayError = token
    ? error
    : 'Your session has expired. Please sign in again.';

  const loadData = useCallback(async (accessToken: string) => {
    const [
      attendanceData,
      enrollmentData,
      studentData,
      offeringData,
      courseData,
    ] = await Promise.all([
      getAttendance(accessToken),
      getEnrollments(accessToken),
      getStudents(accessToken),
      getCourseOfferings(accessToken),
      getCourses(accessToken),
    ]);

    setRecords(attendanceData);
    setEnrollments(enrollmentData);
    setStudents(studentData);
    setOfferings(offeringData);
    setCourses(courseData);
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const accessToken = token;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        await loadData(accessToken);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              err,
              'Unable to load attendance records. Please try again.',
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, retryCount, loadData]);

  const enrollmentOptions = useMemo(() => {
    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );
    const offeringById = new Map(
      offerings.map((offering) => [offering.id, offering]),
    );
    const courseById = new Map(courses.map((course) => [course.id, course]));

    return enrollments
      .filter((enrollment) => enrollment.status === 'enrolled')
      .map((enrollment) => {
        const student = studentById.get(enrollment.studentId);
        const offering = offeringById.get(enrollment.courseOfferingId);
        const course = offering ? courseById.get(offering.courseId) : undefined;

        return {
          id: enrollment.id,
          label: [
            student
              ? `${student.firstName} ${student.lastName} (${student.number})`
              : 'Unknown student',
            course ? `${course.code} — ${course.title}` : 'Unknown course',
            offering?.sectionCode ? `Section ${offering.sectionCode}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enrollments, students, offerings, courses]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        `${record.firstName} ${record.lastName}`
          .toLowerCase()
          .includes(query) ||
        record.studentNumber.toLowerCase().includes(query) ||
        record.courseCode.toLowerCase().includes(query) ||
        record.courseTitle.toLowerCase().includes(query) ||
        record.sectionCode.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' || record.status === statusFilter;

      const matchesDate =
        !dateFilter || record.sessionDate.slice(0, 10) === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [records, search, statusFilter, dateFilter]);

  const statistics = useMemo(
    () => [
      {
        label: 'Total records',
        value: records.length,
        icon: CalendarCheck,
        color: 'text-primary bg-primary/10',
      },
      {
        label: 'Present',
        value: records.filter((record) => record.status === 'present').length,
        icon: Check,
        color: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-400',
      },
      {
        label: 'Absent',
        value: records.filter((record) => record.status === 'absent').length,
        icon: XCircle,
        color: 'text-destructive bg-destructive/10',
      },
      {
        label: 'Late',
        value: records.filter((record) => record.status === 'late').length,
        icon: Clock3,
        color: 'text-amber-700 bg-amber-500/10 dark:text-amber-400',
      },
    ],
    [records],
  );

  function openCreateForm() {
    setEditingRecord(null);
    setForm({
      ...emptyForm,
      enrollmentId: enrollmentOptions[0]?.id ?? '',
    });
    setError(null);
    setNotice(null);
    setIsFormOpen(true);
  }

  function openEditForm(record: AttendanceRecord) {
    setEditingRecord(record);
    setForm({
      enrollmentId: record.enrollmentId,
      sessionDate: record.sessionDate.slice(0, 10),
      status: record.status,
      notes: record.notes ?? '',
    });
    setError(null);
    setNotice(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;

    setIsFormOpen(false);
    setEditingRecord(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    if (!editingRecord && !form.enrollmentId) {
      setError('Select an active enrollment before recording attendance.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (editingRecord) {
        await updateAttendance(token, editingRecord.id, {
          sessionDate: form.sessionDate,
          status: form.status,
          notes: form.notes.trim() || null,
        });
      } else {
        await createAttendance(token, {
          enrollmentId: form.enrollmentId,
          sessionDate: form.sessionDate,
          status: form.status,
          notes: form.notes.trim() || null,
        });
      }

      await loadData(token);
      setIsFormOpen(false);
      setEditingRecord(null);
      setForm(emptyForm);
      setNotice(
        editingRecord
          ? 'Attendance record updated successfully.'
          : 'Attendance recorded successfully.',
      );
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          'Unable to save this attendance record. Please try again.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: AttendanceRecord) {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    const confirmed = window.confirm(
      `Delete the attendance record for ${record.firstName} ${record.lastName} on ${formatDate(record.sessionDate)}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError(null);
    setNotice(null);

    try {
      await deleteAttendance(token, record.id);
      await loadData(token);
      setNotice('Attendance record deleted.');
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, 'Unable to delete this record. Please try again.'),
      );
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Academic records</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Attendance
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Track attendance across enrolled students and course sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          disabled={loading || enrollmentOptions.length === 0}
          className={primaryButton}
        >
          <Plus size={18} aria-hidden="true" />
          Record attendance
        </button>
      </section>

      {displayError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 text-muted-foreground">{displayError}</p>
          </div>
          {token && (
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="inline-flex shrink-0 items-center gap-1.5 font-medium hover:underline"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
        </div>
      )}

      {notice && !displayError && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}

      <section
        aria-label="Attendance statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {statistics.map(({ label, value, icon: Icon, color }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
              <span
                className={`flex size-10 items-center justify-center rounded-xl ${color}`}
              >
                <Icon size={19} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight">
              {loading ? '—' : value.toLocaleString()}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Attendance records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading records…'
                : `${filteredRecords.length} of ${records.length} records`}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="relative block">
              <span className="sr-only">Search attendance</span>
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, number or course…"
                className={`${inputClass} pl-9`}
              />
            </label>

            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Filter by session date</span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className={inputClass}
                />
              </label>
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className={secondaryButton}
                  aria-label="Clear date filter"
                  title="Clear date filter"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin" />
            Loading attendance records…
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <CalendarCheck size={22} />
            </span>
            <h3 className="mt-4 font-semibold">
              {records.length === 0
                ? 'No attendance records yet'
                : 'No matching records'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {records.length === 0
                ? 'Record attendance for an enrolled student to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
            {records.length === 0 && enrollmentOptions.length > 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className={`${primaryButton} mt-5`}
              >
                <Plus size={17} />
                Record attendance
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Student</th>
                  <th className="px-5 py-3.5 font-medium">Course</th>
                  <th className="px-5 py-3.5 font-medium">Session date</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Notes</th>
                  <th className="px-5 py-3.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {record.firstName} {record.lastName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {record.studentNumber}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{record.courseCode}</p>
                      <p className="mt-1 max-w-[230px] truncate text-xs text-muted-foreground">
                        {record.courseTitle}
                        {record.sectionCode ? ` · ${record.sectionCode}` : ''}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                      {formatDate(record.sessionDate)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(record.status)}`}
                      >
                        {humanize(record.status)}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-5 py-4">
                      <span
                        className="block truncate text-muted-foreground"
                        title={record.notes ?? ''}
                      >
                        {record.notes || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(record)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Edit attendance for ${record.firstName} ${record.lastName}`}
                          title="Edit record"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(record)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete attendance for ${record.firstName} ${record.lastName}`}
                          title="Delete record"
                        >
                          <Trash2 size={16} />
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

      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-form-title"
            className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="attendance-form-title"
                  className="text-lg font-semibold"
                >
                  {editingRecord ? 'Edit attendance' : 'Record attendance'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {editingRecord
                    ? 'Update the session details below.'
                    : 'Choose an enrolled student and record their attendance.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {!editingRecord && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    Student enrollment
                  </span>
                  <select
                    required
                    value={form.enrollmentId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        enrollmentId: event.target.value,
                      }))
                    }
                    className={inputClass}
                    disabled={isSaving}
                  >
                    <option value="">Select an enrollment</option>
                    {enrollmentOptions.map((enrollment) => (
                      <option key={enrollment.id} value={enrollment.id}>
                        {enrollment.label}
                      </option>
                    ))}
                  </select>
                  {enrollmentOptions.length === 0 && (
                    <span className="block text-xs text-muted-foreground">
                      No active enrollments are available. Enroll a student in a
                      course before recording attendance.
                    </span>
                  )}
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Session date</span>
                  <input
                    type="date"
                    required
                    value={form.sessionDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sessionDate: event.target.value,
                      }))
                    }
                    className={inputClass}
                    disabled={isSaving}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Attendance status</span>
                  <select
                    required
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as AttendanceStatus,
                      }))
                    }
                    className={inputClass}
                    disabled={isSaving}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {humanize(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">
                  Notes{' '}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="Add a note about this session…"
                  className={`${inputClass} resize-y`}
                  disabled={isSaving}
                />
                <span className="block text-right text-xs text-muted-foreground">
                  {form.notes.length}/500
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    (!editingRecord && enrollmentOptions.length === 0)
                  }
                  className={primaryButton}
                >
                  {isSaving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Users size={17} />
                  )}
                  {isSaving
                    ? 'Saving…'
                    : editingRecord
                      ? 'Save changes'
                      : 'Record attendance'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
