import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { deleteAuthSession, getAuthSession, recordLiveEvent } from '@/lib/postgres';
import { assertTrustedOrigin, ERROR_CORS_NOT_ALLOWED, ERROR_ORIGIN_UNVERIFIED, getSessionCookieOptions } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleLogout(request, 'GET');
}

export async function POST(request: Request) {
  return handleLogout(request, 'POST');
}

async function handleLogout(request: Request, method: 'GET' | 'POST') {
  try {
    if (method !== 'GET') {
      assertTrustedOrigin(request);
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const token = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
      ?.split('=')
      .slice(1)
      .join('=');

    const session = await getAuthSession(token);
    await deleteAuthSession(token);

    if (session) {
      await recordLiveEvent('logout', {
        label: session.user.email,
        userId: session.user.id,
        studentId: session.user.email,
      });
    }

    const response =
      method === 'GET'
        ? NextResponse.redirect(new URL('/login', request.url))
        : NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', getSessionCookieOptions(new Date(0)));

    return response;
  } catch (error) {
    console.error('Logout route failed', error);

    if (
      error instanceof Error &&
      (error.message === ERROR_CORS_NOT_ALLOWED || error.message === ERROR_ORIGIN_UNVERIFIED)
    ) {
      return NextResponse.json({ error: 'Forbidden request origin.' }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'Unable to sign out.',
      },
      { status: 500 },
    );
  }
}
