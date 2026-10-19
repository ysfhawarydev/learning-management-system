import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpenCheck, GraduationCap, Plus, RefreshCw } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  createEnrollment,
  getCourseOfferings,
  getCourses,
  getEnrollments,
  getInstructors,
  getSemesters,
  getStudents,
  updateEnrollment,
} from '@/lib/api';
import type {
  CourseOfferingRecord,
  CourseRecord,
  EnrollmentRecord,
  InstructorRecord,
  SemesterRecord,
  Student,
} from '@/lib/api';

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60';

const statuses = ['enrolled', 'dropped', 'completed', 'withdrawn'] as const;

type EnrollmentStatus = (typeof statuses)[number];

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function semesterLabel(semester: SemesterRecord) {
  return `${semester.academicYear} · ${
    semester.term.charAt(0).toUpperCase() + semester.term.slice(1)
  }`;
}

export function EnrollmentsPage() {
  const { token } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);

  const [studentId, setStudentId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const displayLoadError = !token
    ? 'Your session has expired. Please sign in again.'
    : loadError;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const authToken = token;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [
          studentRecords,
          offeringRecords,
          courseRecords,
          semesterRecords,
          instructorRecords,
          enrollmentRecords,
        ] = await Promise.all([
          getStudents(authToken),
          getCourseOfferings(authToken),
          getCourses(authToken),
          getSemesters(authToken),
          getInstructors(authToken),
          getEnrollments(authToken),
        ]);

        if (cancelled) return;

        setStudents(studentRecords);
        setOfferings(offeringRecords);
        setCourses(courseRecords);
        setSemesters(semesterRecords);
        setInstructors(instructorRecords);
        setEnrollments(enrollmentRecords);
      } catch (error: unknown) {
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

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const semesterById = useMemo(
    () => new Map(semesters.map((semester) => [semester.id, semester])),
    [semesters],
  );

  const instructorById = useMemo(
    () => new Map(instructors.map((instructor) => [instructor.id, instructor])),
    [instructors],
  );

  const studentById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  );

  const offeringById = useMemo(
    () => new Map(offerings.map((offering) => [offering.id, offering])),
    [offerings],
  );

  const activeStudents = useMemo(
    () =>
      students
        .filter((student) => student.status === 'enrolled')
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
          ),
        ),
    [students],
  );

  const availableOfferings = useMemo(
    () =>
      offerings
        .filter((offering) => {
          const semester = semesterById.get(offering.semesterId);
          return semester?.status !== 'completed';
        })
        .sort((a, b) => {
          const courseA = courseById.get(a.courseId)?.code ?? '';
          const courseB = courseById.get(b.courseId)?.code ?? '';
          return (
            courseA.localeCompare(courseB) ||
            a.sectionCode.localeCompare(b.sectionCode)
          );
        }),
    [offerings, semesterById, courseById],
  );

  const filteredEnrollments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...enrollments]
      .sort(
        (a, b) =>
          new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime(),
      )
      .filter((enrollment) => {
        if (!query) return true;

        const student = studentById.get(enrollment.studentId);
        const offering = offeringById.get(enrollment.courseOfferingId);
        const course = offering ? courseById.get(offering.courseId) : undefined;
        const semester = offering
          ? semesterById.get(offering.semesterId)
          : undefined;

        return [
          student?.number,
          student?.firstName,
          student?.lastName,
          course?.code,
          course?.title,
          offering?.sectionCode,
          semester ? semesterLabel(semester) : undefined,
          enrollment.status,
        ].some((value) => value?.toLowerCase().includes(query));
      });
  }, [
    enrollments,
    search,
    studentById,
    offeringById,
    courseById,
    semesterById,
  ]);

  function offeringLabel(offering: CourseOfferingRecord) {
    const course = courseById.get(offering.courseId);
    const semester = semesterById.get(offering.semesterId);
    const instructor = instructorById.get(offering.instructorId);
    const courseLabel = course
      ? `${course.code} — ${course.title}`
      : 'Unknown course';
    const semesterText = semester
      ? semesterLabel(semester)
      : 'Unknown semester';
    const instructorText = instructor
      ? `${instructor.firstName} ${instructor.lastName}`
      : 'Unassigned instructor';

    return `${courseLabel} · Section ${offering.sectionCode} · ${semesterText} · ${instructorText}`;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setActionError('Your session has expired. Please sign in again.');
      return;
    }

    if (!studentId || !offeringId) {
      setActionError('Select a student and course offering.');
      return;
    }

    const alreadyExists = enrollments.some(
      (item) =>
        item.studentId === studentId && item.courseOfferingId === offeringId,
    );

    if (alreadyExists) {
      setActionError(
        'This student already has an enrollment for this course offering.',
      );
      return;
    }

    setSaving(true);
    setActionError('');
    setSuccess('');

    try {
      const created = await createEnrollment(token, {
        studentId,
        courseOfferingId: offeringId,
        status: 'enrolled',
      });

      setEnrollments((current) => [created, ...current]);
      setSuccess(
        'Student enrolled successfully. Their course and assignments should now be visible.',
      );
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    enrollment: EnrollmentRecord,
    status: EnrollmentStatus,
  ) {
    if (!token || status === enrollment.status || updatingId) return;

    setUpdatingId(enrollment.id);
    setActionError('');
    setSuccess('');

    try {
      const updated = await updateEnrollment(token, enrollment.id, { status });
      setEnrollments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess('Enrollment status updated successfully.');
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpenCheck size={16} aria-hidden="true" />
            Academic management
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Enrollments
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Enroll students in course offerings to give them access to their
            courses, assignments, and academic progress.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
          className={secondaryButton}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {displayLoadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
        >
          <p className="text-sm text-destructive">{displayLoadError}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className={secondaryButton}
          >
            Try again
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Enroll a student</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a student and a course section.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="grid gap-4 lg:grid-cols-[1fr_2fr_auto] lg:items-end"
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium">Student</span>
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className={inputClass}
              disabled={loading || saving || activeStudents.length === 0}
              required
            >
              <option value="">Select a student</option>
              {activeStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.number} · {student.firstName} {student.lastName}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Course offering</span>
            <select
              value={offeringId}
              onChange={(event) => setOfferingId(event.target.value)}
              className={inputClass}
              disabled={loading || saving || availableOfferings.length === 0}
              required
            >
              <option value="">Select a course offering</option>
              {availableOfferings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offeringLabel(offering)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={
              loading ||
              saving ||
              Boolean(displayLoadError) ||
              !studentId ||
              !offeringId
            }
            className={primaryButton}
          >
            <Plus size={16} aria-hidden="true" />
            {saving ? 'Enrolling…' : 'Enroll student'}
          </button>
        </form>

        {!loading && !displayLoadError && activeStudents.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            No students with enrolled status are available. Create or activate a
            student record first.
          </p>
        )}

        {!loading && !displayLoadError && availableOfferings.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No course offerings are available. Create a course offering first.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-semibold">Enrollment records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {enrollments.length} total{' '}
              {enrollments.length === 1 ? 'enrollment' : 'enrollments'}
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search students or courses…"
            aria-label="Search enrollments"
            className={`${inputClass} sm:max-w-xs`}
            disabled={loading}
          />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading enrollment records…
          </div>
        ) : displayLoadError ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Enrollment records could not be loaded.
          </div>
        ) : filteredEnrollments.length === 0 ? (
          <div className="p-10 text-center">
            <GraduationCap
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium">
              {search ? 'No matching enrollments' : 'No enrollments yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? 'Try another student number, name, or course.'
                : 'Enroll a student above to connect them to a course offering.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Course offering</th>
                  <th className="px-5 py-3 font-medium">Enrolled</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEnrollments.map((enrollment) => {
                  const student = studentById.get(enrollment.studentId);
                  const offering = offeringById.get(
                    enrollment.courseOfferingId,
                  );
                  const course = offering
                    ? courseById.get(offering.courseId)
                    : undefined;
                  const semester = offering
                    ? semesterById.get(offering.semesterId)
                    : undefined;

                  return (
                    <tr key={enrollment.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {student
                            ? `${student.firstName} ${student.lastName}`
                            : 'Unknown student'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {student?.number ?? enrollment.studentId}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {course
                            ? `${course.code} — ${course.title}`
                            : 'Unknown course'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {offering
                            ? `Section ${offering.sectionCode}`
                            : enrollment.courseOfferingId}
                          {semester ? ` · ${semesterLabel(semester)}` : ''}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          aria-label={`Status for ${student?.firstName ?? 'student'} ${student?.lastName ?? ''} in ${course?.code ?? 'course'}`}
                          value={enrollment.status}
                          onChange={(event) =>
                            void handleStatusChange(
                              enrollment,
                              event.target.value as EnrollmentStatus,
                            )
                          }
                          disabled={updatingId !== null || saving}
                          className={`${inputClass} min-w-36`}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                        {updatingId === enrollment.id && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Updating…
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
