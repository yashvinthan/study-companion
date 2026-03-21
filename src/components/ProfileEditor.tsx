'use client';

import { ArrowLeft, Loader2, Save, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import type { ProfileSnapshot } from '@/lib/types';

interface ProfileEditorProps {
  profile: ProfileSnapshot;
}

export default function ProfileEditor({ profile }: ProfileEditorProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update the profile.');
      }

      setMessage(payload.message || 'Profile updated.');
      startTransition(() => router.refresh());
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Unable to update the profile.');
    }
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (nextPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          nextPassword,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update the password.');
      }

      setMessage(payload.message || 'Password updated.');
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      startTransition(() => router.refresh());
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Unable to update the password.');
    }
  }

  async function submitDeleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (deleteConfirmText !== 'DELETE') {
      setError('Type DELETE exactly to confirm account deletion.');
      return;
    }

    try {
      const response = await fetch('/api/profile', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmText: deleteConfirmText,
          currentPassword: deletePassword,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to delete account.');
      }

      startTransition(() => {
        router.push('/login');
        router.refresh();
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete account.');
    }
  }

  return (
    <div className="space-y-5">
      <section className="app-shell-panel p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="app-eyebrow">Profile Settings</p>
            <h1 className="app-title">Update the account details your student actually uses</h1>
            <p className="app-copy">
              Name updates save to PostgreSQL immediately. Password changes require the current
              password when one already exists, enforce the production password policy, and revoke
              existing sessions after rotation.
            </p>
          </div>
          <Link href="/app/profile" className="app-action-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Profile
          </Link>
        </div>
      </section>

      <div aria-live="polite" className="space-y-3">
        {message ? (
          <div className="rounded-[1.2rem] border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[1.2rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="app-card p-5">
          <div className="space-y-2">
            <p className="app-eyebrow">Personal Details</p>
            <h2 className="text-xl font-semibold text-white">Identity shown inside the workspace</h2>
          </div>

          <form onSubmit={submitProfile} className="mt-5 space-y-4">
            <Field label="Full name" htmlFor="profile-full-name">
              <input
                id="profile-full-name"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
                className="app-input"
              />
            </Field>

            <Field label="Email address" htmlFor="profile-email">
              <input
                id="profile-email"
                name="email"
                type="email"
                value={profile.email}
                disabled
                readOnly
                autoComplete="email"
                spellCheck={false}
                className="app-input cursor-not-allowed opacity-70"
              />
            </Field>

            <div className="app-card-soft p-4 text-sm leading-6 text-[var(--color-muted)]">
              Email stays read-only because it is used as the current study-memory identifier. This
              avoids breaking the student&apos;s stored Hindsight history.
            </div>

            <button type="submit" disabled={isPending} className="app-action-primary">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Save Profile
            </button>
          </form>
        </section>

        <section className="app-card p-5">
          <div className="space-y-2">
            <p className="app-eyebrow">Security</p>
            <h2 className="text-xl font-semibold text-white">
              {profile.hasPassword ? 'Rotate the password for this account' : 'Add a password sign-in method'}
            </h2>
          </div>

          <form onSubmit={submitPassword} className="mt-5 space-y-4">
            {profile.hasPassword ? (
              <Field label="Current password" htmlFor="profile-current-password">
                <input
                  id="profile-current-password"
                  name="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="app-input"
                />
              </Field>
            ) : (
              <div className="app-card-soft p-4 text-sm leading-6 text-[var(--color-muted)]">
                This account currently uses Google sign-in only. Add a local password if you want
                to keep email-and-password access available as a fallback.
              </div>
            )}

            <Field label="New password" htmlFor="profile-next-password">
              <input
                id="profile-next-password"
                name="nextPassword"
                type="password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="app-input"
              />
            </Field>

            <Field label="Confirm new password" htmlFor="profile-confirm-password">
              <input
                id="profile-confirm-password"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="app-input"
              />
            </Field>

            <div className="app-card-soft flex items-start gap-3 p-4 text-sm leading-6 text-[var(--color-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
              New passwords must be at least 12 characters and include uppercase, lowercase,
              number, and symbol. Existing sessions are removed after the password hash is rotated.
            </div>

            <button type="submit" disabled={isPending} className="app-action-primary">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {profile.hasPassword ? 'Update Password' : 'Add Password'}
            </button>
          </form>
        </section>
      </div>

      <section className="app-card border-red-400/30 bg-red-500/5 p-5">
        <div className="space-y-2">
          <p className="app-eyebrow text-red-200">Danger Zone</p>
          <h2 className="text-xl font-semibold text-white">Delete account permanently</h2>
          <p className="text-sm leading-6 text-red-100/80">
            This permanently removes your account and active sessions. This action cannot be undone.
          </p>
        </div>

        <form onSubmit={submitDeleteAccount} className="mt-5 space-y-4">
          <Field label='Type "DELETE" to confirm' htmlFor="delete-confirm-text">
            <input
              id="delete-confirm-text"
              name="deleteConfirmText"
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              autoComplete="off"
              required
              className="app-input border-red-300/30"
            />
          </Field>

          {profile.hasPassword ? (
            <Field label="Current password" htmlFor="delete-current-password">
              <input
                id="delete-current-password"
                name="deleteCurrentPassword"
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
                required
                className="app-input border-red-300/30"
              />
            </Field>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/30 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Delete Account'}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-2">
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
    </label>
  );
}
