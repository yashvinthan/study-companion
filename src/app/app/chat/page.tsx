import Link from 'next/link';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import AppPageHeader from '@/components/AppPageHeader';
import ChatWorkspace from '@/components/ChatWorkspace';
import { getCurrentSession } from '@/lib/auth';

export default async function ChatPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-5">
      <AppPageHeader
        eyebrow="Chat Coach"
        title="Talk to StudyTether with memory-aware context"
        description="Use natural questions and quick actions for quizzes, plans, weak-area review, and revision help. The rest of the workspace refreshes after each completed exchange."
        meta={
          <span className="app-chip">
            <MessageSquareText className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            Real student context
          </span>
        }
        actions={
          <Link href="/app/activity" className="app-action-secondary">
            View Activity Feed
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <ChatWorkspace studentId={session.user.email} />
    </div>
  );
}
