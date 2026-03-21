import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/postgres';

function getScopedCookieName(name: string) {
  return process.env.NODE_ENV === 'production' ? `__Host-${name}` : name;
}

export const AUTH_COOKIE_NAME = getScopedCookieName('studytether_session');
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = getScopedCookieName('studytether_google_state');
export const GOOGLE_OAUTH_VERIFIER_COOKIE_NAME = getScopedCookieName('studytether_google_verifier');
export const GOOGLE_OAUTH_NONCE_COOKIE_NAME = getScopedCookieName('studytether_google_nonce');

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return getAuthSession(token);
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  return session;
}
