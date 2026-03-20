import ProfileEditor from '@/components/ProfileEditor';
import { getCurrentSession } from '@/lib/auth';
import { getProfileSnapshot } from '@/lib/dashboard';

export default async function EditProfilePage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const profile = await getProfileSnapshot(session.user.id, session.user.email);

  return <ProfileEditor profile={profile} />;
}
