import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE_NAME, getCurrentSession } from '@/lib/auth';
import {
  createAuthSession,
  deleteUserAccount,
  enforceRateLimit,
  recordLiveEvent,
  updateUserPassword,
  updateUserProfile,
} from '@/lib/postgres';
import { CorsValidationError, assertTrustedOrigin, getSessionCookieOptions } from '@/lib/security';

export const dynamic = 'force-dynamic';

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().max(1024).optional().default(''),
  nextPassword: z.string().min(12).max(128),
});

const deleteAccountSchema = z.object({
  confirmText: z.literal('DELETE'),
  currentPassword: z.string().max(1024).optional().default(''),
});

export async function PATCH(request: Request) {
  try {
    assertTrustedOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    await enforceRateLimit({
      scope: 'profile-update',
      key: session.user.id,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });

    const payload = (await request.json()) as Record<string, unknown>;

    if (typeof payload.fullName === 'string') {
      const { fullName } = updateProfileSchema.parse(payload);
      const user = await updateUserProfile(session.user.id, { fullName });
      await recordLiveEvent('profile_updated', {
        label: user.fullName,
        userId: user.id,
        studentId: user.email,
      });

      return NextResponse.json({
        success: true,
        message: 'Profile updated.',
        user,
      });
    }

    if (
      typeof payload.currentPassword === 'string' ||
      typeof payload.nextPassword === 'string'
    ) {
      const { currentPassword, nextPassword } = updatePasswordSchema.parse(payload);

      await updateUserPassword({
        userId: session.user.id,
        currentPassword,
        nextPassword,
      });
      await recordLiveEvent('password_updated', {
        label: session.user.email,
        userId: session.user.id,
        studentId: session.user.email,
      });

      const refreshedSession = await createAuthSession(session.user.id);
      const response = NextResponse.json({
        success: true,
        message: 'Password updated. Other active sessions were signed out.',
      });
      response.cookies.set(
        AUTH_COOKIE_NAME,
        refreshedSession.token,
        getSessionCookieOptions(new Date(refreshedSession.expiresAt)),
      );

      return response;
    }

    return NextResponse.json(
      {
        error: 'No profile changes were provided.',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Profile route failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'The submitted profile details are invalid.',
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'Too many requests. Please try again later.') {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (error instanceof CorsValidationError) {
      return NextResponse.json({ error: 'Forbidden request origin.' }, { status: 403 });
    }

    if (
      error instanceof Error &&
      (error.message === 'Current password is incorrect.' ||
        error.message === 'This account does not currently use a password sign-in.' ||
        error.message.includes('Password must be at least 12 characters') ||
        error.message === 'New password must be different from the current password.' ||
        error.message === 'Full name is required.')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Unable to update the profile.',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    await enforceRateLimit({
      scope: 'profile-delete',
      key: session.user.id,
      maxAttempts: 5,
      windowMs: 30 * 60 * 1000,
    });

    const payload = deleteAccountSchema.parse(await request.json());
    const deletedUser = await deleteUserAccount({
      userId: session.user.id,
      currentPassword: payload.currentPassword,
    });

    await recordLiveEvent('profile_updated', {
      label: 'Account deleted',
      userId: deletedUser.id,
      studentId: deletedUser.email,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Your account has been permanently deleted.',
    });
    response.cookies.set(AUTH_COOKIE_NAME, '', getSessionCookieOptions(new Date(0)));
    return response;
  } catch (error) {
    console.error('Profile delete route failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Confirm account deletion by typing DELETE.',
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'Too many requests. Please try again later.') {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (error instanceof CorsValidationError) {
      return NextResponse.json({ error: 'Forbidden request origin.' }, { status: 403 });
    }

    if (
      error instanceof Error &&
      (error.message === 'Current password is required to delete this account.' ||
        error.message === 'Current password is incorrect.' ||
        error.message === 'User profile was not found.')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Unable to delete the account.',
      },
      { status: 500 },
    );
  }
}
