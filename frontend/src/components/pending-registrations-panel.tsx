import { useEffect, useState } from 'react';
import { Check, LoaderCircle, RefreshCw, UserRoundCheck } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { approveRegistration, getPendingRegistrations } from '@/lib/api';
import type { PendingRegistration } from '@/lib/api';

export function PendingRegistrationsPanel() {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  const displayError = !token
    ? 'Your session is unavailable. Please sign in again.'
    : error;

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    void getPendingRegistrations(token)
      .then((result) => {
        if (cancelled) return;

        setRegistrations(result);
        setError('');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load pending registrations.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshCount]);

  async function handleApprove(registration: PendingRegistration) {
    if (!token || processingId) return;

    setProcessingId(registration.id);
    setError('');
    setNotice('');

    try {
      const result = await approveRegistration(token, registration.id);

      setRegistrations((current) =>
        current.filter((item) => item.id !== registration.id),
      );
      setNotice(result.message);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to approve this registration.',
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserRoundCheck
              size={20}
              className="text-primary"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold tracking-tight">
              Pending registrations
            </h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Review new student applications and activate approved accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsLoading(true);
            setError('');
            setRefreshCount((count) => count + 1);
          }}
          disabled={isLoading || !token}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={isLoading ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {displayError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          {displayError}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-border px-3 py-2 text-sm"
        >
          {notice}
        </p>
      )}

      {isLoading && token ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
          Loading registrations...
        </div>
      ) : registrations.length === 0 && !error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No pending registrations.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {registrations.map((registration) => (
            <article
              key={registration.id}
              className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h3 className="font-medium">
                  {registration.firstName} {registration.lastName}
                </h3>

                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {registration.email}
                </p>

                <p className="mt-2 text-sm">
                  Student number: {registration.number}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {registration.departmentName} · Birth date:{' '}
                  {registration.birth}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted:{' '}
                  {new Date(registration.submittedAt).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleApprove(registration)}
                disabled={processingId !== null}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingId === registration.id ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Check size={16} aria-hidden="true" />
                )}
                Approve account
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
