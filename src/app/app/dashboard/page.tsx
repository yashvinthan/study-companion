import Link from 'next/link';
import { ArrowRight, Radar } from 'lucide-react';
import AppPageHeader from '@/components/AppPageHeader';
import Dashboard from '@/components/Dashboard';
import { getCurrentSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard';

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.user.email);

  return (
    <div className="space-y-5">
      <AppPageHeader
        eyebrow="Dashboard"
        title="See what needs attention before the next study block"
        description="Weak areas, upcoming exams, reminders, and recent study patterns are assembled from the signed-in student’s real records."
        meta={
          <>
            <span className="app-chip">
              <Radar className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
              {data.summary.quizCount} quiz records
            </span>
            <span className="app-chip">{data.summary.examsTracked} upcoming exams</span>
          </>
        }
        actions={
          <Link href="/app/schedule" className="app-action-primary">
            Log New Study Data
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <Dashboard data={data} loading={false} error="" />
    </div>
  );
}
