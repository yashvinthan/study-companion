import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, GOOGLE_OAUTH_NONCE_COOKIE_NAME, GOOGLE_OAUTH_STATE_COOKIE_NAME, GOOGLE_OAUTH_VERIFIER_COOKIE_NAME } from '@/lib/auth';
import { ConfigError } from '@/lib/config';
import { exchangeGoogleCode } from '@/lib/google-auth';
import { authenticateGoogleUser, createAuthSession, enforceRateLimit, recordLiveEvent } from '@/lib/postgres';
import { getClientIp, getOAuthCookieOptions, getSessionCookieOptions, safeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';

function redirectToLogin(request: Request, errorCode: string) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', errorCode);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const clearExpires = new Date(0);

  try {
    await enforceRateLimit({
      scope: 'auth-google-callback',
      key: getClientIp(request),
      maxAttempts: 30,
      windowMs: 15 * 60 * 1000,
    });

    const url = new URL(request.url);
    const code = url.searchParams.get('code')?.trim();
    const state = url.searchParams.get('state')?.trim();
    const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;
    const codeVerifier = cookieStore.get(GOOGLE_OAUTH_VERIFIER_COOKIE_NAME)?.value;
    const nonce = cookieStore.get(GOOGLE_OAUTH_NONCE_COOKIE_NAME)?.value;

    if (!code || !state || !storedState || !codeVerifier || !nonce) {
      throw new Error('Google OAuth cookies or query params were missing.');
    }

    if (!safeEqual(state, storedState)) {
      throw new Error('Google OAuth state did not match.');
    }

    const googleIdentity = await exchangeGoogleCode({
      code,
      codeVerifier,
      nonce,
    });
    const result = await authenticateGoogleUser(googleIdentity);
    const session = await createAuthSession(result.user.id);

    await recordLiveEvent(result.action === 'signup' ? 'signup_success' : 'login_success', {
      label: result.user.email,
      userId: result.user.id,
      studentId: result.user.email,
      provider: 'google',
      action: result.action,
    });

    const response = NextResponse.redirect(new URL('/app', request.url));
    response.cookies.set(
      AUTH_COOKIE_NAME,
      session.token,
      getSessionCookieOptions(new Date(session.expiresAt)),
    );
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, '', getOAuthCookieOptions(clearExpires));
    response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE_NAME, '', getOAuthCookieOptions(clearExpires));
    response.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE_NAME, '', getOAuthCookieOptions(clearExpires));

    return response;
  } catch (error) {
    console.error('Google OAuth callback failed', error);

    const response = redirectToLogin(
      request,
      error instanceof ConfigError ? 'google_unavailable' : 'google_signin_failed',
    );

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, '', getOAuthCookieOptions(clearExpires));
    response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE_NAME, '', getOAuthCookieOptions(clearExpires));
    response.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE_NAME, '', getOAuthCookieOptions(clearExpires));

    return response;
  }
}
