import type { ComponentType } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  NotebookPen,
  Radar,
} from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { formatDateLabel } from '@/lib/utils';

interface DashboardProps {
  data: DashboardData | null;
  loading: boolean;
  error: string;
}

export default function Dashboard({ data, loading, error }: DashboardProps) {
  if (loading) {
    return (
      <section className="app-shell-panel flex min-h-[34rem] items-center justify-center p-6">
        <div className="app-chip">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" aria-hidden="true" />
          Loading dashboard…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="app-shell-panel flex min-h-[34rem] items-center justify-center p-6">
        <div className="max-w-lg space-y-3 text-center">
          <p className="text-xl font-semibold text-white">Dashboard unavailable</p>
          <p className="app-copy">{error || 'The dashboard could not be loaded.'}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="app-shell-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="app-eyebrow">Overview</p>
            <div className="flex flex-wrap gap-2">
              <span className="app-chip">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                {data.connection.message}
              </span>
              <span className="app-chip">
                {data.weakAreas.length} weak area{data.weakAreas.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
            <StatCard label="Quiz Records" value={String(data.summary.quizCount)} icon={Radar} />
            <StatCard label="Study Sessions" value={String(data.summary.studySessions)} icon={NotebookPen} />
            <StatCard label="Exams Tracked" value={String(data.summary.examsTracked)} icon={CalendarClock} />
            <StatCard label="Avg Daily Mins" value={String(data.summary.averageDailyMinutes)} icon={Clock3} />
          </div>
        </div>
      </section>

      {data.dueReminders.length > 0 ? (
        <section className="app-card p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-100">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-base font-medium text-white">Upcoming Reminder Window</p>
                <p className="app-copy">These exam reminders are due based on the lead days you saved.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.dueReminders.map((reminder) => (
                  <article key={`${reminder.subject}-${reminder.examDate}`} className="app-card-soft p-4">
                    <p className="text-sm font-medium text-white">{reminder.subject}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{reminder.message}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                      {formatDateLabel(reminder.examDate)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-eyebrow">Weak Areas</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Topics that need more repetitions</h2>
            </div>
            <span className="app-chip">{data.weakAreas.length} flagged</span>
          </div>
          <div className="mt-5 space-y-3">
            {data.weakAreas.length === 0 ? (
              <EmptyState text="No weak areas are currently below threshold. Correct quiz answers will keep this clean." />
            ) : (
              data.weakAreas.map((area) => (
                <article key={`${area.subject}-${area.topic}`} className="app-card-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-white">
                        {area.subject} / {area.topic}
                      </p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">
                        {area.errorCount} errors, {area.totalAttempts} attempts, {area.consecutiveCorrect} recent correct answers.
                      </p>
                    </div>
                    <div className="rounded-full border border-rose-300/20 bg-rose-500/12 px-3 py-1 text-sm font-medium text-rose-100">
                      {area.accuracyRate}%
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="app-card p-5">
          <div>
            <p className="app-eyebrow">Upcoming Exams</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Deadlines that shape the next study block</h2>
          </div>
          <div className="mt-5 space-y-3">
            {data.upcomingExams.length === 0 ? (
              <EmptyState text="No exams are tracked yet. Add your next exam from the Schedule page." />
            ) : (
              data.upcomingExams.map((exam) => (
                <article key={`${exam.subject}-${exam.examDate}`} className="app-card-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-white">
                        {exam.subject} / {exam.topic}
                      </p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{formatDateLabel(exam.examDate)}</p>
                    </div>
                    <span className="app-chip">
                      {exam.daysAway === 0 ? 'Today' : `${exam.daysAway} days`}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="app-card p-5">
          <div>
            <p className="app-eyebrow">Recent Sessions</p>
            <h2 className="mt-2 text-xl font-semibold text-white">What you studied most recently</h2>
          </div>
          <div className="mt-5 space-y-3">
            {data.recentSessions.length === 0 ? (
              <EmptyState text="No study sessions have been logged yet. Use the Schedule page to start tracking them." />
            ) : (
              data.recentSessions.map((session) => (
                <article key={session.session_id} className="app-card-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-white">
                        {session.subject} / {session.topic}
                      </p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">
                        {formatDateLabel(session.date)} at {session.startTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{session.durationMinutes} min</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                        confidence {session.confidenceScore}/5
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="app-card p-5">
          <div>
            <p className="app-eyebrow">Latest Plan</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Current study allocation snapshot</h2>
          </div>
          <div className="mt-5 space-y-3">
            {!data.latestPlan ? (
              <EmptyState text="No study plan has been generated yet. Open Chat Coach or the Study Plan page to create one." />
            ) : (
              data.latestPlan.items.slice(0, 6).map((item) => (
                <article key={`${item.date}-${item.subject}-${item.focus}`} className="app-card-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-white">
                        {item.subject} / {item.topic}
                      </p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{item.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{item.minutes} min</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                        {formatDateLabel(item.date)}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <article className="app-stat-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</p>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
          <Icon className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card-soft p-4 text-sm leading-6 text-[var(--color-muted)]">{text}</div>
  );
}
