import { ArrowUpRight, BookOpen, CalendarCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import type { PageId } from '@/components/layout/app-sidebar';
import { LoginPage } from '@/components/login-page';
import { StudentsPage } from '@/components/students-page';
import { useAuth } from '@/hooks/use-auth';
import { ApiError, getStudents } from '@/lib/api';
import type { Student } from '@/lib/api';

const statistics = [
  {
    label: 'Total students',
    icon: Users,
    description: 'Registered student records',
  },
  {
    label: 'Active courses',
    icon: BookOpen,
    description: 'Currently available courses',
  },
  {
    label: 'Attendance rate',
    icon: CalendarCheck,
    description: 'Attendance across your institution',
  },
];

function Overview() {
  const { token } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const displayError = !token
    ? 'Your session has expired. Please sign in again.'
    : error;

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const accessToken = token;

    async function loadStudents() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getStudents(accessToken);

        if (!cancelled) {
          setStudents(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load student records. Please try again.',
          );
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

  const recentStudents = [...students]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Workspace overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Manage student records and keep academic information organized from
            one place.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <span
            className={`size-2 rounded-full ${
              displayError
                ? 'bg-destructive'
                : isLoading
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
          />
          {displayError
            ? 'API connection issue'
            : isLoading
              ? 'Loading dashboard data'
              : 'Connected to API'}
        </div>
      </section>

      <section
        aria-label="Student management statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {statistics.map(({ label, icon: Icon, description }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-black/[0.02] sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={19} aria-hidden="true" />
              </span>
            </div>

            <p className="mt-5 text-3xl font-semibold tracking-tight">
              {label === 'Total students'
                ? isLoading
                  ? '…'
                  : displayError
                    ? '—'
                    : students.length
                : '—'}
            </p>

            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold tracking-tight">Recent students</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The latest student records
              </p>
            </div>

            <Users
              size={19}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <div className="min-h-56 px-5 py-5 sm:px-6">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Loading student records…
              </p>
            ) : displayError ? (
              <div className="py-10 text-center">
                <p role="alert" className="text-sm text-destructive">
                  {displayError}
                </p>

                {token && (
                  <button
                    type="button"
                    onClick={() => setRetryCount((count) => count + 1)}
                    className="mt-3 text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : recentStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/60 text-muted-foreground">
                  <Users size={22} aria-hidden="true" />
                </span>

                <h3 className="mt-4 text-sm font-semibold">
                  No student records found
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Student records will appear here once they are added to the
                  system.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {student.firstName} {student.lastName}
                      </p>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {student.number} · {student.departmentName}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {student.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold tracking-tight">Next steps</h2>
            <ArrowUpRight
              size={19}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The application shell is ready for the next stage of development.
          </p>

          <div className="mt-6 space-y-4">
            {[
              'Build the student management page',
              'Add forms and validation',
              'Connect courses and attendance APIs',
            ].map((item, index) => (
              <div key={item} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function PlaceholderPage({ page }: { page: PageId }) {
  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">{page}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        This page is part of the application navigation. We will implement it in
        a dedicated step.
      </p>
    </section>
  );
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('Overview');
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'Overview' ? (
        <Overview />
      ) : activePage === 'Students' ? (
        <StudentsPage />
      ) : (
        <PlaceholderPage page={activePage} />
      )}
    </AppLayout>
  );
}

export default App;
