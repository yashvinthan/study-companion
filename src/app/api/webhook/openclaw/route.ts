import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mistakeTracker } from '@/lib/engines/Mistake_Tracker';
import { planGenerator } from '@/lib/engines/Plan_Generator';
import { quizEngine } from '@/lib/engines/Quiz_Engine';
import { assertOpenClawWebhookSecret, ConfigError } from '@/lib/config';
import { memoryStore } from '@/lib/memory/MemoryStore';
import { enforceRateLimit } from '@/lib/postgres';
import { safeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';

const webhookSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  user_id: z.string().trim().min(1).max(254),
  channel_id: z.string().trim().max(254).optional(),
  action: z.string().trim().max(120).optional(),
});

function parseCommand(text: string) {
  const normalized = text.trim().toLowerCase();

  if (normalized.startsWith('/quiz')) {
    const rawSubject = text.slice(5).trim();
    const [subject, topic] = rawSubject.split(':').map((value) => value.trim());
    return { type: 'quiz' as const, subject: subject || 'Physics', topic };
  }

  if (normalized.startsWith('/mistakes')) {
    return { type: 'mistakes' as const };
  }

  if (normalized.startsWith('/plan')) {
    const days = Number.parseInt(text.slice(5).trim(), 10);
    return { type: 'plan' as const, days: Number.isFinite(days) ? days : 7 };
  }

  return { type: 'help' as const };
}

function ensureWebhookAuth(request: Request) {
  const secret = assertOpenClawWebhookSecret();
  const authorization = request.headers.get('authorization')?.trim();

  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  return safeEqual(authorization.slice(7), secret);
}

export async function POST(request: Request) {
  try {
    if (!ensureWebhookAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized webhook request.' }, { status: 401 });
    }

    const payload = webhookSchema.parse(await request.json());
    await enforceRateLimit({
      scope: 'openclaw-webhook',
      key: payload.user_id,
      maxAttempts: 20,
      windowMs: 60 * 1000,
    });

    const studentId = payload.user_id;
    const command = parseCommand(payload.text);
    const connection = await memoryStore.getConnectionStatus(studentId);

    if (!connection.ok) {
      return NextResponse.json(
        {
          replies: [{ type: 'text', content: 'Study memory is temporarily unavailable.' }],
        },
        { status: 503 },
      );
    }

    let content = 'Use /quiz, /mistakes, or /plan.';

    if (command.type === 'quiz') {
      const quiz = await quizEngine.generateQuiz(studentId, command.subject, command.topic);
      content = quizEngine.formatQuestion(quiz);
    } else if (command.type === 'mistakes') {
      const result = await mistakeTracker.getWeakAreas(studentId);
      content =
        result.weakAreas.length === 0
          ? result.message
          : result.weakAreas
              .map((area) => `${area.subject}/${area.topic}: ${area.accuracyRate}%`)
              .join('\n');
    } else if (command.type === 'plan') {
      const plan = await planGenerator.generate(studentId, command.days);
      content = planGenerator.formatPlan(plan);
    }

    await memoryStore.retainChatEvent({
      student_id: studentId,
      subject: 'OpenClaw',
      topic: payload.action || command.type,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      role: 'user',
      intent: command.type,
      content: payload.text,
    });

    await memoryStore.retainChatEvent({
      student_id: studentId,
      subject: 'OpenClaw',
      topic: payload.action || command.type,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      role: 'assistant',
      intent: command.type,
      content,
    });

    return NextResponse.json({
      replies: [{ type: 'text', content }],
      meta: {
        channel_id: payload.channel_id || null,
        protocol: 'openclaw-skill-webhook',
      },
    });
  } catch (error) {
    console.error('OpenClaw webhook failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
    }

    if (error instanceof ConfigError) {
      return NextResponse.json({ error: 'Webhook is not available.' }, { status: 503 });
    }

    if (error instanceof Error && error.message === 'Too many requests. Please try again later.') {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    return NextResponse.json(
      {
        error: 'Webhook execution failed.',
      },
      { status: 500 },
    );
  }
}
