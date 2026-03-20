import Link from 'next/link';
import { ArrowRight, History } from 'lucide-react';
import ActivityFeedView from '@/components/ActivityFeedView';
import AppPageHeader from '@/components/AppPageHeader';
import { getCurrentSession } from '@/lib/auth';
import { getActivityFeed } from '@/lib/dashboard';

export default async function ActivityPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const items = await getActivityFeed(session.user.email, session.user.id);

  return (
    <div className="space-y-5">
      <AppPageHeader
        eyebrow="Activity"
        title="Track what the account and study system changed over time"
        description="The feed combines retained study actions with PostgreSQL account activity, so the student has a usable audit trail instead of isolated widgets."
        meta={
          <span className="app-chip">
            <History className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            {items.length} recent events
          </span>
        }
        actions={
          <Link href="/app/profile/edit" className="app-action-secondary">
            Edit Profile
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <ActivityFeedView items={items} />
    </div>
  );
}
