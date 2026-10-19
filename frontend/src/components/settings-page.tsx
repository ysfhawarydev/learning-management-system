import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  LoaderCircle,
  Monitor,
  Moon,
  Pencil,
  Save,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import {
  ApiError,
  getMyStudentProfile,
  updateMyStudentProfile,
  type Student,
} from '@/lib/api';

const themeOptions: {
  value: 'system' | 'light' | 'dark';
  label: string;
  description: string;
  icon: typeof Monitor;
}[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Automatically match your device appearance.',
    icon: Monitor,
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Use a bright appearance throughout the application.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Use a darker appearance throughout the application.',
    icon: Moon,
  },
];

const inputClassName =
  'mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60';

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Validates a calendar date in YYYY-MM-DD format without
 * parsing it through JavaScript Date or relying on time zones.
 */
function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

function formatBirthDate(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const dateValue = value.slice(0, 10);

  if (!isValidDateOnly(dateValue)) {
    return value;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
}

export function SettingsPage() {
  const { user, token } = useAuth();
  const { mode, setMode } = useTheme();

  const isStudent =
    user?.roles?.includes('student') && !user.roles.includes('admin');

  const [profile, setProfile] = useState<Student | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');

  useEffect(() => {
    if (!token || !isStudent) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setError('');

      try {
        const result = await getMyStudentProfile(token!);

        if (!cancelled) {
          setProfile(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            `Unable to load your student profile. ${getErrorMessage(loadError)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token, isStudent]);

  function startEditing() {
    if (!profile) {
      return;
    }

    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPhone(profile.phone ?? '');
    setBirth(profile.birth?.slice(0, 10) ?? '');
    setError('');
    setSuccess('');
    setEditing(true);
  }

  function cancelEditing() {
    if (saving) {
      return;
    }

    setFirstName(profile?.firstName ?? '');
    setLastName(profile?.lastName ?? '');
    setPhone(profile?.phone ?? '');
    setBirth(profile?.birth?.slice(0, 10) ?? '');
    setError('');
    setEditing(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !profile) {
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setError('First name and last name are required.');
      return;
    }

    if (trimmedFirstName.length > 100 || trimmedLastName.length > 100) {
      setError('Names must be no longer than 100 characters.');
      return;
    }

    if (trimmedPhone.length > 50) {
      setError('Phone number must be no longer than 50 characters.');
      return;
    }

    // Birth date is optional. Validate it only when provided.
    if (birth && !isValidDateOnly(birth)) {
      setError('Please provide a valid birth date.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updatedProfile = await updateMyStudentProfile(token, {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone || null,
        ...(birth ? { birth } : {}),
      });

      setProfile(updatedProfile);
      setFirstName(updatedProfile.firstName);
      setLastName(updatedProfile.lastName);
      setPhone(updatedProfile.phone ?? '');
      setBirth(updatedProfile.birth?.slice(0, 10) ?? '');
      setEditing(false);
      setSuccess('Your profile has been updated successfully.');
    } catch (saveError) {
      setError(`Unable to save your changes. ${getErrorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your account information and application appearance.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-5" aria-hidden="true" />
            </div>

            <div>
              <h2 className="font-semibold">Account information</h2>
              <p className="text-sm text-muted-foreground">
                View your account details and manage your profile.
              </p>
            </div>
          </div>

          {isStudent && profile && !editing && (
            <button
              type="button"
              className={secondaryButton}
              onClick={startEditing}
              disabled={loadingProfile || saving}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit profile
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {success}
          </div>
        )}

        <dl className="mt-6 divide-y divide-border">
          <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-sm text-muted-foreground">Email address</dt>
            <dd className="break-all text-sm font-medium">
              {user?.email ?? 'Not available'}
            </dd>
          </div>

          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-sm text-muted-foreground">Roles</dt>
            <dd className="flex flex-wrap gap-2">
              {user?.roles?.length ? (
                user.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  No roles available
                </span>
              )}
            </dd>
          </div>
        </dl>

        {isStudent && (
          <div className="mt-4 border-t border-border pt-6">
            <div className="mb-5">
              <h3 className="font-medium">Student profile</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Update your personal details. Your email, student number,
                department, and academic status are managed separately.
              </p>
            </div>

            {loadingProfile && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                Loading your profile…
              </div>
            )}

            {!loadingProfile && !profile && (
              <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Your student profile is not available. If your student account
                was just created, ask an administrator to finish setting up your
                profile.
              </p>
            )}

            {!loadingProfile && profile && !editing && (
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">First name</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {profile.firstName}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">Last name</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {profile.lastName}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">
                    Phone number
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {profile.phone || 'Not provided'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">Birth date</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatBirthDate(profile.birth)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">
                    Student number
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{profile.number}</dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">Department</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {profile.departmentName}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">
                    Academic status
                  </dt>
                  <dd className="mt-1 text-sm font-medium capitalize">
                    {profile.status.replaceAll('_', ' ')}
                  </dd>
                </div>
              </dl>
            )}

            {!loadingProfile && profile && editing && (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-first-name"
                      className="text-sm font-medium"
                    >
                      First name
                    </label>
                    <input
                      id="profile-first-name"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      maxLength={100}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      disabled={saving}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-last-name"
                      className="text-sm font-medium"
                    >
                      Last name
                    </label>
                    <input
                      id="profile-last-name"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      maxLength={100}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      disabled={saving}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-phone"
                      className="text-sm font-medium"
                    >
                      Phone number
                    </label>
                    <input
                      id="profile-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={50}
                      placeholder="Add a phone number"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      disabled={saving}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-birth"
                      className="text-sm font-medium"
                    >
                      Birth date
                    </label>
                    <input
                      id="profile-birth"
                      name="birth"
                      type="date"
                      value={birth}
                      onChange={(event) => setBirth(event.target.value)}
                      disabled={saving}
                      className={inputClassName}
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={primaryButton}
                    disabled={saving}
                  >
                    {saving ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    {saving ? 'Saving changes…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how Student Management System looks on this device.
          </p>
        </div>

        <fieldset className="mt-5 space-y-3">
          <legend className="sr-only">Application theme</legend>

          {themeOptions.map(({ value, label, description, icon: Icon }) => {
            const selected = mode === value;

            return (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={selected}
                  onChange={() => setMode(value)}
                  className="size-4 accent-primary"
                />

                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {description}
                  </span>
                </div>

                {selected && (
                  <span className="text-xs font-medium text-primary">
                    Selected
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
      </section>
    </div>
  );
}
