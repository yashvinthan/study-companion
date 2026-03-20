import { CalendarRange, Clock3, Tag } from 'lucide-react';
import type { StudyPlanRecord } from '@/lib/types';
import { formatDateLabel } from '@/lib/utils';

interface StudyPlanViewProps {
  latestPlan: StudyPlanRecord | null;
}

export default function StudyPlanView({ latestPlan }: StudyPlanViewProps) {
  if (!latestPlan || latestPlan.items.length === 0) {
    return (
      <section className="app-shell-panel flex min-h-[30rem] items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05] text-[var(--color-accent)]">
            <CalendarRange className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-semibold text-white">No Study Plan Yet</h2>
          <p className="app-copy">
            Generate a plan from Chat Coach or after logging a few study sessions and exams. The
            system uses those real records to shape the next timeline.
          </p>
        </div>
      </section>
    );
  }

  const groupedItems = new Map<string, typeof latestPlan.items>();
  for (const item of latestPlan.items) {
    const group = groupedItems.get(item.date) ?? [];
    group.push(item);
    groupedItems.set(item.date, group);
  }

  const sortedDates = Array.from(groupedItems.keys()).toSorted(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );

  return (
    <section className="app-shell-panel p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="app-eyebrow">Plan Timeline</p>
          <h2 className="app-title">The latest adaptive plan, broken into daily blocks</h2>
          <p className="app-copy">
            Each block reflects the actual weak areas, exam deadlines, and study cadence stored for
            this student.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="app-chip">
            <CalendarRange className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            {latestPlan.horizonDays} days
          </span>
          <span className="app-chip">
            <Clock3 className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            {latestPlan.items.length} blocks
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {sortedDates.map((date) => (
          <section key={date} className="app-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-eyebrow">Day</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{formatDateLabel(date)}</h3>
              </div>
              <span className="app-chip">{groupedItems.get(date)?.length ?? 0} tasks</span>
            </div>

            <div className="mt-5 space-y-3">
              {groupedItems.get(date)?.map((item, index) => (
                <article
                  key={`${date}-${item.subject}-${item.focus}-${index}`}
                  className="app-card-soft p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="app-chip">
                          <Tag className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                          {item.focus.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-medium text-white">
                        {item.subject} / {item.topic}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-white">{item.minutes}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                        minutes
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
