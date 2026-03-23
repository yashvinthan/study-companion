import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import AppPageHeader from '@/components/AppPageHeader';
import ToolsWorkspace from '@/components/ToolsWorkspace';

export const metadata = {
  title: 'Study Tools | StudyTether',
  description: 'AI-powered study tools and widgets.',
};

export default async function ToolsPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <>
      <AppPageHeader
        eyebrow="Toolkit"
        title="Study Tools"
        description="Smart generators, timers, and calculators for active revision."
      />
      <div className="space-y-5">
        <ToolsWorkspace />
      </div>
    </>
  );
}
