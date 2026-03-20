import Link from 'next/link';
import { ArrowRight, Clock3, DatabaseZap, ShieldCheck, UserRound } from 'lucide-react';
import type { ProfileSnapshot } from '@/lib/types';
import { formatDateLabel } from '@/lib/utils';

interface ProfileOverviewProps {
  profile: ProfileSnapshot;
}

export default function ProfileOverview({ profile }: ProfileOverviewProps) {
  const accessLabel =
    profile.authProvider === 'password_google'
      ? 'Google + password'
      : profile.authProvider === 'google'
        ? 'Google only'
        : 'Password';

  return (
    <div className="space-y-5">
      <section className="app-shell-panel p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="app-eyebrow">Profile</p>
            <h2 className="app-title">Identity, access, and study footprint</h2>
            <p className="app-copy">
              This page combines PostgreSQL account details with Hindsight study data for the signed-in
              student.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="app-chip">
                <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                {profile.activeSessionCount} active session{profile.activeSessionCount === 1 ? '' : 's'}
              </span>
              <span className="app-chip">
                <DatabaseZap className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                {profile.connection.message}
              </span>
            </div>
          </div>
          <Link href="/app/profile/edit" className="app-action-primary">
            Edit Profile
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-card p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="app-eyebrow">Account</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{profile.fullName}</h3>
              <p className="mt-2 break-all text-sm text-[var(--color-muted)]">{profile.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard
              label="Account Created"
              value={profile.createdAt ? formatDateLabel(profile.createdAt) : 'Not available'}
            />
            <InfoCard
              label="Last Login"
              value={profile.lastLoginAt ? formatDateLabel(profile.lastLoginAt) : 'Not available'}
            />
            <InfoCard label="Active Sessions" value={String(profile.activeSessionCount)} />
            <InfoCard label="Access Method" value={accessLabel} />
            <InfoCard
              label="Memory Status"
              value={profile.connection.ok ? 'Connected' : 'Action needed'}
            />
          </div>
        </section>

        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-eyebrow">Study Stats</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Current totals</h3>
            </div>
            <Clock3 className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatCard label="Quiz Records" value={profile.quizRecordCount} />
            <StatCard label="Study Sessions" value={profile.studySessionCount} />
            <StatCard label="Upcoming Exams" value={profile.examCount} />
            <StatCard label="Weak Areas" value={profile.weakAreaCount} />
          </div>
        </section>
      </div>

      <section className="app-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-eyebrow">Subjects</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Tracked across sessions, quizzes, and exams</h3>
          </div>
          <span className="app-chip">{profile.subjectsTracked.length} tracked</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {profile.subjectsTracked.length === 0 ? (
            <div className="app-card-soft w-full p-4 text-sm leading-6 text-[var(--color-muted)]">
              No subjects are tracked yet. Use the Schedule page or Chat Coach to start building study history.
            </div>
          ) : (
            profile.subjectsTracked.map((subject) => (
              <span
                key={subject}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
              >
                {subject}
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card-soft p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-3 text-base font-medium text-white">{value}</p>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="app-stat-card">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</p>
    </article>
  );
}
