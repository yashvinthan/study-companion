import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import {
  createAuthSession,
  enforceRateLimit,
  recordLiveEvent,
  registerUser,
} from '@/lib/postgres';
import { assertTrustedOrigin, getClientIp, getSessionCookieOptions } from '@/lib/security';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);

    const payload = registerSchema.parse(await request.json());
    await enforceRateLimit({
      scope: 'auth-register',
      key: `${getClientIp(request)}:${payload.email.toLowerCase()}`,
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
    });

    const user = await registerUser(payload);
    const session = await createAuthSession(user.id);
    await recordLiveEvent('signup_success', {
      label: user.email,
      userId: user.id,
      studentId: user.email,
    });

    const response = NextResponse.json({
      success: true,
      user,
      nextPath: '/welcome',
    });

    response.cookies.set(AUTH_COOKIE_NAME, session.token, getSessionCookieOptions(new Date(session.expiresAt)));

    return response;
  } catch (error) {
    console.error('Register route failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Full name, valid email, and a strong password are required.',
        },
        { status: 400 },
      );
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

    if (error instanceof Error && error.message === 'Unable to create account with the provided details.') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof Error && error.message.includes('Password must be at least 12 characters')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Unable to create account.',
      },
      { status: 500 },
    );
  }
}
