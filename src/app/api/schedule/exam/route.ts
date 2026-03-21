import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { MemoryStoreError } from '@/lib/memory/MemoryStore';
import { enforceRateLimit, recordLiveEvent } from '@/lib/postgres';
import { assertTrustedOrigin, ERROR_CORS_NOT_ALLOWED, ERROR_ORIGIN_UNVERIFIED } from '@/lib/security';

export const dynamic = 'force-dynamic';

const examSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(120).optional(),
  examDate: z.string().trim().date(),
  notes: z.string().trim().max(2000).optional(),
  reminderLeadDays: z.array(z.number().int().min(0).max(365)).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    await enforceRateLimit({
      scope: 'exam-track',
      key: session.user.id,
      maxAttempts: 20,
      windowMs: 5 * 60 * 1000,
    });

    const payload = examSchema.parse(await request.json());
    const exam = await scheduleManager.addExamEvent({
      studentId: session.user.email,
      subject: payload.subject,
      topic: payload.topic,
      examDate: payload.examDate,
      notes: payload.notes,
      reminderLeadDays: payload.reminderLeadDays,
    });

    await recordLiveEvent('exam_tracked', {
      label: `${exam.subject} / ${exam.topic}`,
      userId: session.user.id,
      studentId: session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Tracked ${exam.subject} for ${exam.examDate}.`,
      exam,
    });
  } catch (error) {
    console.error('Exam route failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Provide a valid subject, exam date, and optional reminder settings.',
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'Too many requests. Please try again later.') {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (
      error instanceof Error &&
      (error.message === ERROR_CORS_NOT_ALLOWED || error.message === ERROR_ORIGIN_UNVERIFIED)
    ) {
      return NextResponse.json({ error: 'Forbidden request origin.' }, { status: 403 });
    }

    if (error instanceof MemoryStoreError) {
      return NextResponse.json(
        {
          error: `Hindsight memory is currently unavailable. ${error.message}`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: 'Unable to track the exam.',
      },
      { status: 500 },
    );
  }
}
