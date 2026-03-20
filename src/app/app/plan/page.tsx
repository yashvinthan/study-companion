import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import AppPageHeader from '@/components/AppPageHeader';
import StudyPlanView from '@/components/StudyPlanView';
import { getCurrentSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard';

export default async function PlanPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.user.email);

  return (
    <div className="space-y-5">
      <AppPageHeader
        eyebrow="Study Plan"
        title="Review the latest adaptive timeline"
        description="The plan below is generated from actual study sessions, weak areas, and tracked exam dates stored for this student."
        meta={
          <span className="app-chip">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            {data.latestPlan ? `${data.latestPlan.horizonDays}-day plan ready` : 'No plan generated yet'}
          </span>
        }
        actions={
          <Link href="/app/chat" className="app-action-primary">
            Generate in Chat Coach
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      {data.latestPlan?.rationale?.length ? (
        <section className="app-card p-5">
          <p className="app-eyebrow">Rationale</p>
          <div className="mt-4 grid gap-3">
            {data.latestPlan.rationale.map((reason) => (
              <div key={reason} className="app-card-soft p-4 text-sm leading-6 text-[var(--color-muted)]">
                {reason}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <StudyPlanView latestPlan={data.latestPlan} />
    </div>
  );
}
