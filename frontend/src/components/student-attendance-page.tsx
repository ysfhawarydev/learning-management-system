import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Search,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { ApiError, getMyAttendance } from '@/lib/api';
import type { AttendanceStatus, MyAttendanceRecord } from '@/lib/api';

type AttendanceFilter = 'all' | AttendanceStatus;

const statusStyles: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  absent: 'bg-destructive/10 text-destructive',
  late: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  excused: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatStatus(status: AttendanceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: typeof CalendarCheck;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-black/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}

export function StudentAttendancePage() {
  const { token } = useAuth();

  const [records, setRecords] = useState<MyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AttendanceFilter>('all');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Your session has expired. Please sign in again.');
      return;
    }

    let cancelled = false;
    const accessToken = token;

    async function loadAttendance() {
      setLoading(true);
      setError(null);

      try {
        const result = await getMyAttendance(accessToken);

        if (!cancelled) {
          setRecords(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load your attendance. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [token, retryCount]);

  const summary = useMemo(() => {
    const total = records.length;
    const present = records.filter(
      (record) => record.status === 'present',
    ).length;
    const absent = records.filter(
      (record) => record.status === 'absent',
    ).length;
    const late = records.filter((record) => record.status === 'late').length;
    const attended = present + late;

    return {
      total,
      present,
      absent,
      rate: total === 0 ? 0 : Math.round((attended / total) * 100),
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesStatus = filter === 'all' || record.status === filter;
      const matchesSearch =
        !query ||
        [
          record.courseCode,
          record.courseTitle,
          record.sectionCode,
          record.academicYear,
          record.semesterTerm,
          record.sessionDate,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [records, search, filter]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Student workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            My attendance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review your attendance history across your enrolled courses.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <CalendarCheck size={16} aria-hidden="true" />
          Personal attendance record
        </div>
      </section>

      {error ? (
        <section
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-card p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Unable to load attendance</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {error}
              </p>
              {token && (
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          <section
            aria-label="Attendance summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryCard
              label="Total sessions"
              value={loading ? '—' : summary.total}
              description="Recorded attendance entries"
              icon={CalendarCheck}
            />
            <SummaryCard
              label="Present"
              value={loading ? '—' : summary.present}
              description="Sessions marked present"
              icon={CheckCircle2}
            />
            <SummaryCard
              label="Absent"
              value={loading ? '—' : summary.absent}
              description="Sessions marked absent"
              icon={XCircle}
            />
            <SummaryCard
              label="Attendance rate"
              value={loading ? '—' : `${summary.rate}%`}
              description="Present or late sessions"
              icon={Clock3}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/[0.02]">
            <div className="border-b border-border p-5 sm:p-6">
              <div>
                <h2 className="font-semibold tracking-tight">
                  Attendance history
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search records or filter by attendance status.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="relative block min-w-0 flex-1">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Search attendance records</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search courses, sections, semesters..."
                    className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="block sm:w-48">
                  <span className="sr-only">Filter by status</span>
                  <select
                    value={filter}
                    onChange={(event) =>
                      setFilter(event.target.value as AttendanceFilter)
                    }
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">All statuses</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <div
                role="status"
                className="flex flex-col items-center justify-center px-6 py-16 text-center"
              >
                <span className="size-7 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Loading your attendance records…
                </p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/60 text-muted-foreground">
                  <CalendarCheck size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">
                  No attendance records yet
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Attendance records will appear here when they have been
                  recorded for your courses.
                </p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <h3 className="font-semibold">No matching records</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try another search term or change the status filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                  className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-4 font-medium sm:px-6">
                        Course
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Date
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Section
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Semester
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-5 py-4 sm:px-6">
                          <p className="font-medium">{record.courseCode}</p>
                          <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                            {record.courseTitle}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                          {formatDate(record.sessionDate)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">
                            {record.sectionCode}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium capitalize">
                            {record.semesterTerm}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {record.academicYear}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[record.status]}`}
                          >
                            {formatStatus(record.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground sm:px-6">
                  Showing {filteredRecords.length} of {records.length}{' '}
                  attendance {records.length === 1 ? 'record' : 'records'}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
