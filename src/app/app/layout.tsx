import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import StudyCompanionShell from '@/components/StudyCompanionShell';
import { getCurrentSession } from '@/lib/auth';

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <StudyCompanionShell
      studentId={session.user.email}
      viewerName={session.user.fullName}
      showLogout
    >
      {children}
    </StudyCompanionShell>
  );
}
