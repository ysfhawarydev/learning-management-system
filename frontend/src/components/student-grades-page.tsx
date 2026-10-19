import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { ApiError, getMyGrades } from '@/lib/api';
import type { MyGradeRecord } from '@/lib/api';

type CourseGradeGroup = {
  key: string;
  title: string;
  code: string;
  term: string;
  section: string;
  rows: MyGradeRecord[];
};

function formatScore(score: string | null, maxScore: string) {
  return score === null ? 'Ungraded' : `${Number(score)} / ${Number(maxScore)}`;
}

function formatWeight(weight: string) {
  return `${Number(weight)}%`;
}

function getCourseGroups(records: MyGradeRecord[]): CourseGradeGroup[] {
  const groups = new Map<string, CourseGradeGroup>();

  for (const record of records) {
    let group = groups.get(record.courseOfferingId);

    if (!group) {
      group = {
        key: record.courseOfferingId,
        title: record.courseTitle,
        code: record.courseCode,
        term: `${record.academicYear} · ${record.semesterTerm}`,
        section: record.sectionCode,
        rows: [],
      };
      groups.set(record.courseOfferingId, group);
    }

    group.rows.push(record);
  }

  return [...groups.values()];
}

function getCourseProgress(rows: MyGradeRecord[]) {
  const totalWeight = rows.reduce(
    (total, row) => total + Number(row.weight),
    0,
  );

  const gradedRows = rows.filter((row) => row.score !== null);
  const gradedWeight = gradedRows.reduce(
    (total, row) => total + Number(row.weight),
    0,
  );

  const weightedPoints = gradedRows.reduce((total, row) => {
    const score = Number(row.score);
    const maxScore = Number(row.maxScore);

    return total + (score / maxScore) * Number(row.weight);
  }, 0);

  const weightsTotalOneHundred = Math.abs(totalWeight - 100) < 0.01;
  const allGraded = gradedRows.length === rows.length;

  return {
    totalWeight,
    gradedWeight,
    weightedPoints,
    finalResultAvailable:
      allGraded && weightsTotalOneHundred && rows.length > 0,
  };
}

export function StudentGradesPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<MyGradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGrades = useCallback(async () => {
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setRecords(await getMyGrades(token));
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to load your grades. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  const groups = getCourseGroups(records);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Student workspace</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          My Grades
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Review your assessment scores, maximum marks, and grading weights.
        </p>
      </header>

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground"
        >
          Loading your grades…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-card p-6"
        >
          <p className="font-semibold">We couldn’t load your grades</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void loadGrades()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <ClipboardList className="mx-auto size-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No assessment results yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Grades will appear when assessments have been created for your
            enrolled courses.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const progress = getCourseProgress(group.rows);

            return (
              <article
                key={group.key}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-primary">
                      {group.code} · Section {group.section}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">
                      {group.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.term}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted px-4 py-3 sm:text-right">
                    <p className="text-xs text-muted-foreground">
                      {progress.finalResultAvailable
                        ? 'Weighted result'
                        : 'Weighted points earned so far'}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {progress.weightedPoints.toFixed(2)}%
                    </p>
                    {!progress.finalResultAvailable && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progress.gradedWeight.toFixed(2)}% of assessment weight
                        graded
                      </p>
                    )}
                  </div>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-medium">Assessment</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Score</th>
                        <th className="px-5 py-3 font-medium">Weight</th>
                        <th className="px-5 py-3 font-medium">Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.rows.map((row) => {
                        const contribution =
                          row.score === null
                            ? null
                            : (Number(row.score) / Number(row.maxScore)) *
                              Number(row.weight);

                        return (
                          <tr key={row.assessmentId}>
                            <td className="px-5 py-4 font-medium">
                              {row.assessmentName}
                            </td>
                            <td className="px-5 py-4 capitalize text-muted-foreground">
                              {row.assessmentType}
                            </td>
                            <td className="px-5 py-4 tabular-nums">
                              {formatScore(row.score, row.maxScore)}
                            </td>
                            <td className="px-5 py-4 tabular-nums">
                              {formatWeight(row.weight)}
                            </td>
                            <td className="px-5 py-4 tabular-nums">
                              {contribution === null
                                ? '—'
                                : `${contribution.toFixed(2)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!progress.finalResultAvailable && (
                  <p className="border-t border-border px-5 py-3 text-xs leading-5 text-muted-foreground">
                    This is a partial result. A final weighted result is shown
                    only when all listed assessments are graded and their
                    weights total 100%.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
