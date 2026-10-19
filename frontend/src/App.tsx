import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LogOut,
  Users,
  ClipboardList,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { AppLayout } from '@/components/layout/app-layout';
import type { PageId } from '@/components/layout/app-sidebar';
import { AttendancePage } from '@/components/attendance-page';
import { CoursesPage } from '@/components/courses-page';
import { CourseOfferingsPage } from '@/components/course-offerings-page';
import { DepartmentsPage } from '@/components/departments-page';
import { InstructorsPage } from '@/components/instructors-page';
import { LoginPage } from '@/components/login-page';
import { PendingRegistrationsPanel } from '@/components/pending-registrations-panel';
import { RegisterPage } from '@/components/register-page';
import { SemestersPage } from '@/components/semesters-page';
import { StudentsPage } from '@/components/students-page';
import { SettingsPage } from '@/components/settings-page';
import { StudentAttendancePage } from '@/components/student-attendance-page';
import { StudentCoursesPage } from '@/components/student-courses-page';
import { StudentGradesPage } from '@/components/student-grades-page';
import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  getCourses,
  getMyStudentProfile,
  getStudents,
} from '@/lib/api';
import type { CourseRecord, Student } from '@/lib/api';

const statistics = [
  {
    label: 'Total students',
    icon: Users,
    description: 'Registered student records',
  },
  {
    label: 'Total courses',
    icon: BookOpen,
    description: 'Courses in the academic catalog',
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
  const [courses, setCourses] = useState<CourseRecord[]>([]);
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

    async function loadDashboardData() {
      setIsLoading(true);
      setError(null);

      try {
        const [studentRecords, courseRecords] = await Promise.all([
          getStudents(accessToken),
          getCourses(accessToken),
        ]);

        if (!cancelled) {
          setStudents(studentRecords);
          setCourses(courseRecords);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load dashboard data. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

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
      <PendingRegistrationsPanel />

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
              {isLoading
                ? '…'
                : displayError
                  ? '—'
                  : label === 'Total students'
                    ? students.length
                    : label === 'Total courses'
                      ? courses.length
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
            <h2 className="font-semibold tracking-tight">Quick guide</h2>

            <ArrowUpRight
              size={19}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Manage student records from one place using the Students section.
          </p>

          <div className="mt-6 space-y-4">
            {[
              {
                title: 'View student records',
                description: 'Browse and search existing students.',
              },
              {
                title: 'Add student accounts',
                description: 'Create student profiles with login credentials.',
              },
              {
                title: 'Keep records up to date',
                description:
                  'Edit student details or remove records when needed.',
              },
            ].map((item, index) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>

                <div>
                  <p className="text-sm font-medium">{item.title}</p>

                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
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

type StudentSection =
  'Overview' | 'My Courses' | 'Attendance' | 'Grades' | 'Settings';

const studentNavigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'My Courses', icon: BookOpen },
  { label: 'Attendance', icon: CalendarCheck },
  { label: 'Grades', icon: ClipboardList },
  { label: 'Settings', icon: Settings },
] as const;

function StudentDashboard() {
  const { user, token, logout } = useAuth();
  const [activeSection, setActiveSection] =
    useState<StudentSection>('Overview');
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      if (!token) {
        setError('You must be signed in to view your profile.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await getMyStudentProfile(token);

        if (!cancelled) {
          setProfile(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load your student profile.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap size={22} aria-hidden="true" />
            </div>

            <div>
              <h1 className="font-semibold tracking-tight">EduManage</h1>
              <p className="text-xs text-muted-foreground">
                Academic management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
              {user?.email}
            </span>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100svh-4rem)] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border bg-card p-3 lg:min-h-[calc(100svh-4rem)] lg:border-b-0 lg:border-r lg:p-5">
          <p className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>

          <nav
            aria-label="Student navigation"
            className="flex gap-2 overflow-x-auto lg:flex-col"
          >
            {studentNavigation.map(({ label, icon: Icon }) => {
              const selected = activeSection === label;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveSection(label)}
                  aria-current={selected ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          {activeSection === 'Settings' ? (
            <SettingsPage />
          ) : activeSection === 'Overview' ? (
            <div className="mx-auto max-w-5xl space-y-8">
              <section>
                <p className="text-sm font-medium text-primary">
                  Student workspace
                </p>

                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Welcome back{profile ? `, ${profile.firstName}` : ''}!
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  View your academic profile and access your student services.
                </p>
              </section>

              {loading ? (
                <div
                  role="status"
                  className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground"
                >
                  Loading your academic profile…
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-card p-6"
                >
                  <p className="font-medium">Unable to load your profile</p>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>

                  <button
                    type="button"
                    onClick={() => setActiveSection('Settings')}
                    className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Open Settings
                  </button>
                </div>
              ) : profile ? (
                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div>
                    <h3 className="font-semibold">My academic profile</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your registered student information.
                    </p>
                  </div>

                  <dl className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      {
                        label: 'Full name',
                        value: `${profile.firstName} ${profile.lastName}`,
                      },
                      {
                        label: 'Student number',
                        value: profile.number,
                      },
                      {
                        label: 'Department',
                        value: profile.departmentName,
                      },
                      {
                        label: 'Email address',
                        value: user?.email ?? 'Not available',
                      },
                      {
                        label: 'Academic status',
                        value: profile.status.replaceAll('_', ' '),
                      },
                      {
                        label: 'Phone number',
                        value: profile.phone || 'Not provided',
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-sm text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-1 break-words text-sm font-medium capitalize">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <button
                    type="button"
                    onClick={() => setActiveSection('Settings')}
                    className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Manage my profile
                  </button>
                </section>
              ) : (
                <section className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-semibold">Student profile unavailable</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Your account is signed in, but no student profile could be
                    loaded. Please contact an administrator.
                  </p>
                </section>
              )}
            </div>
          ) : activeSection === 'My Courses' ? (
            <StudentCoursesPage />
          ) : activeSection === 'Attendance' ? (
            <StudentAttendancePage />
          ) : activeSection === 'Grades' ? (
            <StudentGradesPage />
          ) : (
            <section className="mx-auto max-w-5xl rounded-2xl border border-border bg-card p-8 sm:p-10">
              <p className="text-sm font-medium text-primary">
                Student workspace
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {activeSection}
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                This section is not connected to student-specific academic data
                yet. It will be implemented using endpoints that return only
                information the signed-in student is authorized to access.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function InstructorDashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-svh bg-background px-4 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap size={24} aria-hidden="true" />
            </div>

            <div>
              <h1 className="font-semibold tracking-tight">
                Instructor Portal
              </h1>
              <p className="text-sm text-muted-foreground">
                Student Management System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-accent"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </header>

        <section className="py-10">
          <p className="text-sm font-medium text-primary">
            Instructor workspace
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome back!
          </h2>

          <p className="mt-3 text-muted-foreground">
            You are signed in as an instructor.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold">Your account</h3>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email address</p>
              <p className="mt-1 break-all text-sm font-medium">
                {user?.email}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Account role</p>
              <p className="mt-1 text-sm font-medium">Instructor</p>
            </div>
          </div>
        </section>

        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          Teaching assignments, attendance, and grade management can be added to
          this workspace as instructor permissions and workflows are built.
        </p>
      </div>
    </main>
  );
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('Overview');
  const [showRegister, setShowRegister] = useState(false);
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="flex flex-col items-center gap-3 text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="text-sm">Restoring your session…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return showRegister ? (
      <RegisterPage onBackToLogin={() => setShowRegister(false)} />
    ) : (
      <LoginPage onRegister={() => setShowRegister(true)} />
    );
  }

  if (user?.roles.includes('student') && !user.roles.includes('admin')) {
    return <StudentDashboard />;
  }

  if (
    user?.roles.includes('instructor') &&
    !user.roles.includes('admin') &&
    !user.roles.includes('student')
  ) {
    return <InstructorDashboard />;
  }

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'Overview' ? (
        <Overview />
      ) : activePage === 'Students' ? (
        <StudentsPage />
      ) : activePage === 'Instructors' ? (
        <InstructorsPage />
      ) : activePage === 'Departments' ? (
        <DepartmentsPage />
      ) : activePage === 'Courses' ? (
        <CoursesPage />
      ) : activePage === 'Course Offerings' ? (
        <CourseOfferingsPage />
      ) : activePage === 'Semesters' ? (
        <SemestersPage />
      ) : activePage === 'Attendance' ? (
        <AttendancePage />
      ) : activePage === 'Settings' ? (
        <SettingsPage />
      ) : (
        <PlaceholderPage page={activePage} />
      )}
    </AppLayout>
  );
}

export default App;
