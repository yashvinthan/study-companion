import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { deleteAuthSession, getAuthSession, recordLiveEvent } from '@/lib/postgres';
import { CorsValidationError, assertTrustedOrigin, getSessionCookieOptions } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleLogout(request);
}

export async function POST(request: Request) {
  return handleLogout(request);
}

async function handleLogout(request: Request) {
  try {
    if (request.method !== 'GET') {
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

    const requestUrl = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (host) {
      requestUrl.host = host;
    }
    requestUrl.pathname = '/login';
    requestUrl.search = '';

    const response = NextResponse.redirect(requestUrl);
    response.cookies.set(AUTH_COOKIE_NAME, '', getSessionCookieOptions(new Date(0)));

    return response;
  } catch (error) {
    console.error('Logout route failed', error);

    if (error instanceof CorsValidationError) {
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
