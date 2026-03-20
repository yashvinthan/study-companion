import { NextResponse } from 'next/server';
import {
  GOOGLE_OAUTH_NONCE_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_VERIFIER_COOKIE_NAME,
} from '@/lib/auth';
import { ConfigError } from '@/lib/config';
import { createGoogleAuthorizationRequest } from '@/lib/google-auth';
import { enforceRateLimit } from '@/lib/postgres';
import { getClientIp, getOAuthCookieOptions } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      scope: 'auth-google-start',
      key: getClientIp(request),
      maxAttempts: 20,
      windowMs: 15 * 60 * 1000,
    });

    const oauthRequest = createGoogleAuthorizationRequest();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    const response = NextResponse.redirect(oauthRequest.authorizationUrl);

    response.cookies.set(
      GOOGLE_OAUTH_STATE_COOKIE_NAME,
      oauthRequest.state,
      getOAuthCookieOptions(expires),
    );
    response.cookies.set(
      GOOGLE_OAUTH_VERIFIER_COOKIE_NAME,
      oauthRequest.codeVerifier,
      getOAuthCookieOptions(expires),
    );
    response.cookies.set(
      GOOGLE_OAUTH_NONCE_COOKIE_NAME,
      oauthRequest.nonce,
      getOAuthCookieOptions(expires),
    );

    return response;
  } catch (error) {
    console.error('Google OAuth start failed', error);

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'error',
      error instanceof ConfigError ? 'google_unavailable' : 'google_start_failed',
    );

    return NextResponse.redirect(loginUrl);
  }
}
