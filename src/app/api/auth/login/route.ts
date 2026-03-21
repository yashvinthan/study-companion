import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import {
  authenticateUser,
  createAuthSession,
  enforceRateLimit,
  getPostgresUserSnapshot,
  lookupUserForLogin,
  recordLiveEvent,
} from '@/lib/postgres';
import { assertTrustedOrigin, getClientIp, getSessionCookieOptions } from '@/lib/security';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);

    const payload = loginSchema.parse(await request.json());
    await enforceRateLimit({
      scope: 'auth-login',
      key: `${getClientIp(request)}:${payload.email.toLowerCase()}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });

    const user = await authenticateUser(payload.email, payload.password);
    if (!user) {
      const lookup = await lookupUserForLogin(payload.email);
      if (!lookup.exists) {
        return NextResponse.json(
          {
            error: 'No account found for this email. Please create a new account.',
            code: 'ACCOUNT_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      if (!lookup.hasPassword) {
        return NextResponse.json(
          {
            error: 'This account uses Google sign-in. Use Google or set a password from your profile.',
            code: 'PASSWORD_NOT_SET',
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 },
      );
    }

    const session = await createAuthSession(user.id);
    const profile = await getPostgresUserSnapshot(user.id);
    await recordLiveEvent('login_success', {
      label: user.email,
      userId: user.id,
      studentId: user.email,
    });

    const response = NextResponse.json({
      success: true,
      user,
      nextPath: profile.onboardingCompleted ? '/app' : '/welcome',
    });

    response.cookies.set(AUTH_COOKIE_NAME, session.token, getSessionCookieOptions(new Date(session.expiresAt)));

    return response;
  } catch (error) {
    console.error('Login route failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Too many requests. Please try again later.') {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (
      error instanceof Error &&
      (error.message === 'Cross-origin requests are not allowed for this endpoint.' ||
        error.message === 'Request origin could not be verified.')
    ) {
      return NextResponse.json({ error: 'Forbidden request origin.' }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'Unable to sign in.',
      },
      { status: 500 },
    );
  }
}
