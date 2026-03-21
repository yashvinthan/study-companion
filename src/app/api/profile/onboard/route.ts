import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth';
import {
  completeUserOnboarding,
  enforceRateLimit,
  recordLiveEvent,
} from '@/lib/postgres';
import { assertTrustedOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

const onboardingSchema = z.object({
  educationLevel: z.enum(['school', 'college', 'professional']),
  studyCountry: z.string().trim().min(2).max(120),
  studyBoard: z.string().trim().min(2).max(160),
  studyGrade: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);

    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    await enforceRateLimit({
      scope: 'profile-onboard',
      key: session.user.id,
      maxAttempts: 20,
      windowMs: 15 * 60 * 1000,
    });

    const payload = onboardingSchema.parse(await request.json());
    const user = await completeUserOnboarding({
      userId: session.user.id,
      studyCountry: payload.studyCountry,
      studyBoard: payload.studyBoard,
      studyGrade: payload.studyGrade,
    });

    await recordLiveEvent('profile_updated', {
      label: `Onboarding completed (${payload.educationLevel})`,
      userId: user.id,
      studentId: user.email,
      educationLevel: payload.educationLevel,
      studyCountry: payload.studyCountry,
      studyBoard: payload.studyBoard,
      studyGrade: payload.studyGrade,
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Onboarding route failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid onboarding details.' }, { status: 400 });
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

    if (
      error instanceof Error &&
      (error.message === 'Study profile fields are required.' ||
        error.message === 'Unable to update onboarding details.')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to complete onboarding.' }, { status: 500 });
  }
}

