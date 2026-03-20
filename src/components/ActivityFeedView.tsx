import {
  Activity,
  Bot,
  CalendarClock,
  CheckCircle2,
  KeyRound,
  NotebookPen,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { ActivityFeedItem } from '@/lib/types';
import { formatDateLabel } from '@/lib/utils';

interface ActivityFeedViewProps {
  items: ActivityFeedItem[];
}

const iconByType = {
  quiz_record: CheckCircle2,
  study_session: NotebookPen,
  exam_event: CalendarClock,
  study_plan: Sparkles,
  chat_event: Bot,
  login_success: UserRound,
  logout: UserRound,
  chat_request: Bot,
  plan_generated: Sparkles,
  quiz_generated: CheckCircle2,
  quiz_answered: CheckCircle2,
  study_logged: NotebookPen,
  exam_tracked: CalendarClock,
  signup_success: UserRound,
  profile_updated: UserRound,
  password_updated: KeyRound,
} satisfies Record<ActivityFeedItem['type'], typeof Activity>;

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export default function ActivityFeedView({ items }: ActivityFeedViewProps) {
  return (
    <section className="app-shell-panel p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="app-eyebrow">Activity Feed</p>
          <h2 className="app-title">Every account and study event, in one timeline</h2>
          <p className="app-copy">
            This history combines retained study records with account-level events from PostgreSQL so
            the student can see what changed and when.
          </p>
        </div>
        <span className="app-chip">{items.length} recent updates</span>
      </div>

      <div className="mt-6 space-y-3">
        {items.length === 0 ? (
          <div className="app-card-soft p-5 text-sm leading-6 text-[var(--color-muted)]">
            Activity appears here after the student logs sessions, tracks exams, chats with the
            coach, or updates account settings.
          </div>
        ) : (
          items.map((item) => {
            const Icon = iconByType[item.type];

            return (
              <article key={item.id} className="app-card p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-[var(--color-accent)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-white">{item.title}</p>
                        <p className="mt-2 break-words text-sm leading-6 text-[var(--color-muted)]">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{formatDateLabel(item.timestamp)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                          {timeFormatter.format(new Date(item.timestamp))}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="app-chip">{item.source}</span>
                      <span className="app-chip">{item.type.replaceAll('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
