import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import WelcomeWizard from '@/app/welcome/WelcomeWizard';
import { getCurrentSession } from '@/lib/auth';
import { getPostgresUserSnapshot } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Welcome',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WelcomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  const profile = await getPostgresUserSnapshot(session.user.id);
  if (profile.onboardingCompleted) {
    redirect('/app');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1117] p-6 text-[#e2e8f0]">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0d1117_90%)]" />
      </div>
      <WelcomeWizard userName={session.user.fullName} />
    </main>
  );
}
