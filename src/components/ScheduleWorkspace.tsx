'use client';

import { Loader2, Plus, TimerReset } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import type { DashboardExam, DashboardReminder, StudySessionRecord } from '@/lib/types';
import { formatDateLabel } from '@/lib/utils';

interface ScheduleWorkspaceProps {
  connectionOk: boolean;
  connectionMessage: string;
  averageDailyMinutes: number;
  recentSessions: StudySessionRecord[];
  upcomingExams: DashboardExam[];
  dueReminders: DashboardReminder[];
}

type FeedbackState = {
  study: string;
  exam: string;
  error: string;
};

const initialFeedback: FeedbackState = {
  study: '',
  exam: '',
  error: '',
};

export default function ScheduleWorkspace({
  connectionOk,
  connectionMessage,
  averageDailyMinutes,
  recentSessions,
  upcomingExams,
  dueReminders,
}: ScheduleWorkspaceProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(initialFeedback);
  const [isPending, startTransition] = useTransition();

  async function submitStudySession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setFeedback(initialFeedback);

    try {
      const response = await fetch('/api/schedule/study', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: formData.get('subject'),
          topic: formData.get('topic'),
          durationMinutes: Number(formData.get('durationMinutes')),
          confidenceScore: Number(formData.get('confidenceScore')),
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to log the study session.');
      }

      setFeedback({
        study: payload.message || 'Study session logged.',
        exam: '',
        error: '',
      });
      form.reset();
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        study: '',
        exam: '',
        error: error instanceof Error ? error.message : 'Unable to log the study session.',
      });
    }
  }

  async function submitExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setFeedback(initialFeedback);

    const reminderLeadDays = String(formData.get('reminderLeadDays') || '')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value));

    try {
      const response = await fetch('/api/schedule/exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: formData.get('subject'),
          topic: formData.get('topic'),
          examDate: formData.get('examDate'),
          notes: formData.get('notes'),
          reminderLeadDays,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save the exam.');
      }

      setFeedback({
        study: '',
        exam: payload.message || 'Exam tracked.',
        error: '',
      });
      form.reset();
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        study: '',
        exam: '',
        error: error instanceof Error ? error.message : 'Unable to track the exam.',
      });
    }
  }

  return (
    <div className="space-y-5">
      <section className="app-shell-panel p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="app-eyebrow">Schedule Workspace</p>
            <h2 className="app-title">Add study sessions and exam deadlines without using chat commands</h2>
            <p className="app-copy">
              These forms write directly to the student&apos;s real study memory and refresh the rest of
              the app when they succeed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="app-chip">{averageDailyMinutes} avg daily minutes</span>
            <span className="app-chip">{connectionMessage}</span>
          </div>
        </div>
      </section>

      {!connectionOk ? (
        <section className="app-card p-5">
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            Hindsight must be configured before sessions and exam tracking can be saved. The form
            controls below are disabled until that connection is available.
          </p>
        </section>
      ) : null}

      <div aria-live="polite" className="space-y-3">
        {feedback.error ? (
          <div className="rounded-[1.2rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {feedback.error}
          </div>
        ) : null}
        {feedback.study ? (
          <div className="rounded-[1.2rem] border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {feedback.study}
          </div>
        ) : null}
        {feedback.exam ? (
          <div className="rounded-[1.2rem] border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {feedback.exam}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-eyebrow">Log Study Session</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Capture what was just studied</h3>
            </div>
            <TimerReset className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
          </div>

          <form onSubmit={submitStudySession} className="mt-5 space-y-4">
            <Field label="Subject" htmlFor="study-subject">
              <input
                id="study-subject"
                name="subject"
                required
                autoComplete="off"
                placeholder="Physics…"
                className="app-input"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <Field label="Topic" htmlFor="study-topic">
              <input
                id="study-topic"
                name="topic"
                autoComplete="off"
                placeholder="Kinematics…"
                className="app-input"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration (minutes)" htmlFor="study-duration">
                <input
                  id="study-duration"
                  name="durationMinutes"
                  type="number"
                  min={5}
                  step={5}
                  required
                  inputMode="numeric"
                  className="app-input"
                  disabled={!connectionOk || isPending}
                />
              </Field>

              <Field label="Confidence" htmlFor="study-confidence">
                <select
                  id="study-confidence"
                  name="confidenceScore"
                  defaultValue="3"
                  className="app-select"
                  disabled={!connectionOk || isPending}
                >
                  <option value="1">1 - Very low</option>
                  <option value="2">2 - Low</option>
                  <option value="3">3 - Moderate</option>
                  <option value="4">4 - Good</option>
                  <option value="5">5 - Strong</option>
                </select>
              </Field>
            </div>

            <button type="submit" disabled={!connectionOk || isPending} className="app-action-primary">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Save Study Session
            </button>
          </form>
        </section>

        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-eyebrow">Track Exam</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Add the next milestone and reminders</h3>
            </div>
            <Plus className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
          </div>

          <form onSubmit={submitExam} className="mt-5 space-y-4">
            <Field label="Subject" htmlFor="exam-subject">
              <input
                id="exam-subject"
                name="subject"
                required
                autoComplete="off"
                placeholder="Mathematics…"
                className="app-input"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <Field label="Topic" htmlFor="exam-topic">
              <input
                id="exam-topic"
                name="topic"
                autoComplete="off"
                placeholder="Calculus revision…"
                className="app-input"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <Field label="Exam date" htmlFor="exam-date">
              <input
                id="exam-date"
                name="examDate"
                type="date"
                required
                className="app-input"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <Field label="Reminder lead days" htmlFor="exam-reminders">
              <input
                id="exam-reminders"
                name="reminderLeadDays"
                autoComplete="off"
                defaultValue="7,3,1"
                placeholder="7,3,1…"
                className="app-input"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <Field label="Notes" htmlFor="exam-notes">
              <textarea
                id="exam-notes"
                name="notes"
                autoComplete="off"
                placeholder="Any topics or constraints to remember…"
                className="app-textarea"
                disabled={!connectionOk || isPending}
              />
            </Field>

            <button type="submit" disabled={!connectionOk || isPending} className="app-action-primary">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Save Exam
            </button>
          </form>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-eyebrow">Upcoming Exams</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Tracked deadlines and reminder windows</h3>
            </div>
            <span className="app-chip">{upcomingExams.length} upcoming</span>
          </div>

          <div className="mt-5 space-y-3">
            {upcomingExams.length === 0 ? (
              <EmptyState text="No exams have been saved yet. Add the next exam from the form above." />
            ) : (
              upcomingExams.map((exam) => (
                <article key={`${exam.subject}-${exam.examDate}`} className="app-card-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-white">
                        {exam.subject} / {exam.topic}
                      </p>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{formatDateLabel(exam.examDate)}</p>
                      {exam.notes ? (
                        <p className="mt-2 break-words text-sm leading-6 text-[var(--color-muted)]">
                          {exam.notes}
                        </p>
                      ) : null}
                    </div>
                    <span className="app-chip">
                      {exam.daysAway === 0 ? 'Today' : `${exam.daysAway} days`}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>

          {dueReminders.length > 0 ? (
            <div className="mt-5 space-y-3">
              <p className="app-eyebrow">Due Reminders</p>
              {dueReminders.map((reminder) => (
                <div key={`${reminder.subject}-${reminder.examDate}`} className="app-card-soft p-4 text-sm text-[var(--color-muted)]">
                  <p className="font-medium text-white">{reminder.subject}</p>
                  <p className="mt-2">{reminder.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="app-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-eyebrow">Recent Sessions</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Latest logged study blocks</h3>
            </div>
            <span className="app-chip">{recentSessions.length} total</span>
          </div>

          <div className="mt-5 space-y-3">
            {recentSessions.length === 0 ? (
              <EmptyState text="No study sessions have been logged yet. Save the first one from the form above." />
            ) : (
              recentSessions.map((session) => (
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
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                        confidence {session.confidenceScore}/5
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card-soft p-4 text-sm leading-6 text-[var(--color-muted)]">{text}</div>
  );
}
