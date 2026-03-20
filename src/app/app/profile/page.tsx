import ProfileOverview from '@/components/ProfileOverview';
import { getCurrentSession } from '@/lib/auth';
import { getProfileSnapshot } from '@/lib/dashboard';

export default async function ProfilePage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const profile = await getProfileSnapshot(session.user.id, session.user.email);

  return <ProfileOverview profile={profile} />;
}
