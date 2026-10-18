import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-react';

import {
  ApiError,
  getRegistrationDepartments,
  registerRequest,
} from '@/lib/api';
import type { Department } from '@/lib/api';

interface RegisterPageProps {
  onBackToLogin: () => void;
}

export function RegisterPage({ onBackToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [number, setNumber] = useState('');
  const [birth, setBirth] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      try {
        const result = await getRegistrationDepartments();

        if (!cancelled) {
          setDepartments(result);
          setDepartmentId(result[0]?.id ?? '');
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load departments. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDepartments(false);
        }
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !number.trim() ||
      !email.trim()
    ) {
      setError('Please complete all required fields.');
      return;
    }
    setError('');

    if (password.length < 8 || password.length > 128) {
      setError('Password must be between 8 and 128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!departmentId) {
      setError('Please select a department.');
      return;
    }

    setIsSubmitting(true);

    try {
      await registerRequest({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        departmentId,
        number: number.trim(),
        birth,
      });

      setSuccess(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'Unable to submit your registration. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <section className="relative w-full max-w-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap size={29} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Student Management
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit your student registration for approval.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail size={23} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold">Registration submitted</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Your student profile has been submitted successfully. You cannot
                sign in until an administrator approves your account.
              </p>
              <button
                type="button"
                onClick={onBackToLogin}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                <ArrowLeft size={17} aria-hidden="true" />
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold">
                  Create a student account
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your details exactly as they appear in your student
                  records.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="register-first-name"
                      className="text-sm font-medium"
                    >
                      First name
                    </label>
                    <input
                      id="register-first-name"
                      name="firstName"
                      autoComplete="given-name"
                      required
                      maxLength={100}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="register-last-name"
                      className="text-sm font-medium"
                    >
                      Last name
                    </label>
                    <input
                      id="register-last-name"
                      name="lastName"
                      autoComplete="family-name"
                      required
                      maxLength={100}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="register-email"
                    className="text-sm font-medium"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={255}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="register-number"
                      className="text-sm font-medium"
                    >
                      Student number
                    </label>
                    <input
                      id="register-number"
                      name="number"
                      required
                      maxLength={30}
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="register-birth"
                      className="text-sm font-medium"
                    >
                      Date of birth
                    </label>
                    <input
                      id="register-birth"
                      name="birth"
                      type="date"
                      required
                      value={birth}
                      onChange={(event) => setBirth(event.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="register-department"
                    className="text-sm font-medium"
                  >
                    Department
                  </label>
                  <select
                    id="register-department"
                    name="departmentId"
                    required
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    disabled={isLoadingDepartments || departments.length === 0}
                    className={inputClass}
                  >
                    <option value="">
                      {isLoadingDepartments
                        ? 'Loading departments...'
                        : departments.length === 0
                          ? 'No departments available'
                          : 'Select your department'}
                    </option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="register-password"
                    className="text-sm font-medium"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className={`${inputClass} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff size={18} aria-hidden="true" />
                      ) : (
                        <Eye size={18} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-medium"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      id="confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Enter your password again"
                      className={`${inputClass} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirmation password'
                          : 'Show confirmation password'
                      }
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} aria-hidden="true" />
                      ) : (
                        <Eye size={18} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isLoadingDepartments ||
                    departments.length === 0
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {isSubmitting
                    ? 'Submitting registration...'
                    : 'Submit registration'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
