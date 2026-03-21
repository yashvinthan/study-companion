import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StudyTetherShell from '@/components/StudyTetherShell';
import { getCurrentSession } from '@/lib/auth';
import { getPostgresUserSnapshot } from '@/lib/postgres';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  const profile = await getPostgresUserSnapshot(session.user.id);
  if (!profile.onboardingCompleted) {
    redirect('/welcome');
  }

  return (
    <StudyTetherShell
      studentId={session.user.email}
      viewerName={session.user.fullName}
      showLogout
    >
      {children}
    </StudyTetherShell>
  );
}
