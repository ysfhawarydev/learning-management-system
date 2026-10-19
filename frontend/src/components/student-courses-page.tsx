import { useCallback, useEffect, useState } from 'react';
import { BookOpen, GraduationCap, RefreshCw } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { ApiError, getMyCourses } from '@/lib/api';
import type { MyCourseRecord } from '@/lib/api';

function formatTerm(term: string) {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

export function StudentCoursesPage() {
  const { token } = useAuth();
  const [courses, setCourses] = useState<MyCourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCourses = useCallback(async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setCourses(await getMyCourses(token));
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to load your courses. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Student workspace</p>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              My Courses
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your enrolled courses, instructors, and academic terms.
            </p>
          </div>

          {!loading && (
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'}
            </span>
          )}
        </div>
      </header>

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground"
        >
          Loading your courses…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-card p-6"
        >
          <p className="font-semibold">We couldn’t load your courses</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>

          <button
            type="button"
            onClick={() => void loadCourses()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <BookOpen className="mx-auto size-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No courses yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Courses will appear here when an administrator enrolls you in a
            course offering.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.enrollmentId}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen size={21} />
                </div>

                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                  {course.enrollmentStatus.replaceAll('_', ' ')}
                </span>
              </div>

              <p className="mt-5 text-xs font-semibold tracking-wide text-primary">
                {course.courseCode}
              </p>

              <h3 className="mt-1 text-lg font-semibold tracking-tight">
                {course.courseTitle}
              </h3>

              {course.courseDescription && (
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {course.courseDescription}
                </p>
              )}

              <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Instructor</dt>
                  <dd className="text-right font-medium">
                    {course.instructorFirstName} {course.instructorLastName}
                  </dd>
                </div>

                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Section</dt>
                  <dd className="font-medium">{course.sectionCode}</dd>
                </div>

                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Academic term</dt>
                  <dd className="text-right font-medium">
                    {course.academicYear} · {formatTerm(course.semesterTerm)}
                  </dd>
                </div>

                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Credits</dt>
                  <dd className="font-medium">{course.creditValue}</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap size={15} />
                <span className="capitalize">
                  Semester status: {course.semesterStatus.replaceAll('_', ' ')}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
