import { streamText } from 'ai';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth';
import { mistakeTracker } from '@/lib/engines/Mistake_Tracker';
import { planGenerator } from '@/lib/engines/Plan_Generator';
import { quizEngine } from '@/lib/engines/Quiz_Engine';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { ConfigError } from '@/lib/config';
import { getGroqModel, getGroqModelName } from '@/lib/llm';
import { memoryStore } from '@/lib/memory/MemoryStore';
import { enforceRateLimit, recordLiveEvent } from '@/lib/postgres';
import { assertTrustedOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(4_000),
});

const chatPayloadSchema = z.object({
  messages: z.array(chatMessageSchema).max(20).optional(),
});

type ChatMessage = z.infer<typeof chatMessageSchema>;

type ParsedIntent =
  | { type: 'quiz'; subject: string; topic?: string }
  | { type: 'answer'; answer: string }
  | { type: 'mistakes' }
  | { type: 'plan'; days: number }
  | {
      type: 'study';
      subject: string;
      topic?: string;
      durationMinutes: number;
      confidenceScore?: 1 | 2 | 3 | 4 | 5;
    }
  | { type: 'exam'; subject: string; examDate: string; topic?: string; reminderLeadDays?: number[] }
  | { type: 'help' }
  | { type: 'chat' };

function textResponse(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function helpText() {
  return [
    'AI Study Companion actions:',
    '',
    '- /quiz <subject>[:topic] to generate a fresh question.',
    '- /answer <your answer> to evaluate the active quiz.',
    '- /mistakes to show current weak areas.',
    '- /study <subject>|<topic>|<minutes>|<confidence 1-5> to log a session.',
    '- /exam <subject>|<YYYY-MM-DD>|<topic optional>|<lead days comma list optional> to track an exam.',
    '- /plan <days> to generate a study plan (1-90 days).',
    '',
    `Current model: ${getGroqModelName()}.`,
  ].join('\n');
}

function parseIntent(rawContent: string): ParsedIntent {
  const content = rawContent.trim();
  const lower = content.toLowerCase();

  if (!content) {
    return { type: 'help' };
  }

  if (lower === '/help' || lower === 'help') {
    return { type: 'help' };
  }

  if (lower.startsWith('/quiz')) {
    const payload = content.slice(5).trim();
    const [subjectPart, topicPart] = payload.split(':').map((part) => part?.trim()).filter(Boolean);
    return {
      type: 'quiz',
      subject: subjectPart || 'Physics',
      topic: topicPart,
    };
  }

  if (lower.startsWith('/answer')) {
    return {
      type: 'answer',
      answer: content.slice(7).trim(),
    };
  }

  if (lower.startsWith('/mistakes')) {
    return { type: 'mistakes' };
  }

  if (lower.startsWith('/plan') || lower.includes('study plan')) {
    const days = Number.parseInt(content.replace('/plan', '').trim(), 10);
    return {
      type: 'plan',
      days: Number.isFinite(days) ? days : 7,
    };
  }

  if (lower.startsWith('/study')) {
    const [, payload = ''] = content.split('/study');
    const [subject, topic, minutes, confidence] = payload.split('|').map((part) => part.trim());
    return {
      type: 'study',
      subject: subject || 'General Revision',
      topic: topic || subject || 'General Revision',
      durationMinutes: Number.parseInt(minutes || '45', 10),
      confidenceScore: (Number.parseInt(confidence || '3', 10) as 1 | 2 | 3 | 4 | 5) || 3,
    };
  }

  if (lower.startsWith('/exam')) {
    const [, payload = ''] = content.split('/exam');
    const [subject, examDate, topic, reminderLeadDays] = payload.split('|').map((part) => part.trim());
    return {
      type: 'exam',
      subject: subject || 'General',
      examDate: examDate || new Date().toISOString().slice(0, 10),
      topic: topic || subject || 'General',
      reminderLeadDays: reminderLeadDays
        ? reminderLeadDays
            .split(',')
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((value) => Number.isFinite(value))
        : undefined,
    };
  }

  return { type: 'chat' };
}

function formatWeakAreas(result: Awaited<ReturnType<typeof mistakeTracker.getWeakAreas>>) {
  if (result.weakAreas.length === 0) {
    return result.message || 'No weak areas are currently flagged.';
  }

  return [
    'Current weak areas:',
    '',
    ...result.weakAreas.map((area) => {
      return `- ${area.subject} / ${area.topic}: ${area.accuracyRate}% accuracy, ${area.errorCount} errors, ${area.consecutiveCorrect} recent correct in a row`;
    }),
  ].join('\n');
}

function formatQuizResult(
  outcome: Awaited<ReturnType<typeof quizEngine.evaluateLatestAnswer>>,
  weakArea: Awaited<ReturnType<typeof mistakeTracker.updateFromQuizRecord>>,
) {
  const { prompt, record } = outcome;
  const lines = [
    record.isCorrect ? 'Correct.' : 'Incorrect.',
    `Question: ${prompt.question.prompt}`,
    `Your answer: ${record.studentAnswer}`,
    `Correct answer: ${record.correctAnswer}`,
    '',
    record.feedback,
  ];

  if (weakArea?.weakArea) {
    lines.push(
      '',
      `${weakArea.subject} / ${weakArea.topic} is still below the 60% threshold at ${weakArea.accuracyRate}% accuracy.`,
    );
  } else if (weakArea) {
    lines.push(
      '',
      `${weakArea.subject} / ${weakArea.topic} is now above the weak-area threshold with ${weakArea.accuracyRate}% accuracy.`,
    );
  }

  return lines.join('\n');
}

function recentConversation(messages: ChatMessage[]) {
  return messages
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n');
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);

    const authSession = await getCurrentSession();
    if (!authSession) {
      return textResponse('You must be signed in to use the study coach.', 401);
    }

    await enforceRateLimit({
      scope: 'chat',
      key: authSession.user.id,
      maxAttempts: 40,
      windowMs: 5 * 60 * 1000,
    });

    const payload = chatPayloadSchema.parse(await request.json());
    const studentId = authSession.user.email;
    const messages = payload.messages ?? [];
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage?.content) {
      return textResponse('Send a message to begin.', 400);
    }

    const connection = await memoryStore.getConnectionStatus(studentId);
    if (!connection.ok) {
      return textResponse('Study memory is temporarily unavailable.', 503);
    }

    const parsedIntent = parseIntent(lastMessage.content);
    await recordLiveEvent('chat_request', {
      label: parsedIntent.type,
      userId: authSession.user.id,
      studentId,
    });
    await memoryStore.retainChatEvent({
      student_id: studentId,
      subject: 'Chat',
      topic: parsedIntent.type,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      role: 'user',
      intent: parsedIntent.type,
      content: lastMessage.content,
    });

    if (parsedIntent.type === 'help') {
      const message = helpText();
      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: 'Chat',
        topic: 'help',
        timestamp: new Date().toISOString(),
        session_id: crypto.randomUUID(),
        role: 'assistant',
        intent: 'help',
        content: message,
      });
      return textResponse(message);
    }

    if (parsedIntent.type === 'quiz') {
      const quiz = await quizEngine.generateQuiz(studentId, parsedIntent.subject, parsedIntent.topic);
      const message = quizEngine.formatQuestion(quiz);
      await recordLiveEvent('quiz_generated', {
        label: `${quiz.subject} / ${quiz.topic}`,
        userId: authSession.user.id,
        studentId,
      });

      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: quiz.subject,
        topic: quiz.topic,
        timestamp: new Date().toISOString(),
        session_id: quiz.session_id,
        role: 'assistant',
        intent: 'quiz',
        content: message,
      });

      return textResponse(message);
    }

    if (parsedIntent.type === 'answer') {
      if (!parsedIntent.answer) {
        return textResponse('Use /answer <your answer>.', 400);
      }

      const outcome = await quizEngine.evaluateLatestAnswer(studentId, parsedIntent.answer);
      const weakArea = await mistakeTracker.updateFromQuizRecord(outcome.record);
      const message = formatQuizResult(outcome, weakArea);
      await recordLiveEvent('quiz_answered', {
        label: `${outcome.record.subject} / ${outcome.record.topic}`,
        userId: authSession.user.id,
        studentId,
      });

      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: outcome.record.subject,
        topic: outcome.record.topic,
        timestamp: new Date().toISOString(),
        session_id: outcome.record.session_id,
        role: 'assistant',
        intent: 'answer',
        content: message,
      });

      return textResponse(message);
    }

    if (parsedIntent.type === 'mistakes') {
      const result = await mistakeTracker.getWeakAreas(studentId);
      const message = formatWeakAreas(result);

      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: 'Performance',
        topic: 'weak-areas',
        timestamp: new Date().toISOString(),
        session_id: crypto.randomUUID(),
        role: 'assistant',
        intent: 'mistakes',
        content: message,
      });

      return textResponse(message);
    }

    if (parsedIntent.type === 'study') {
      const studySession = await scheduleManager.logStudySession({
        studentId,
        subject: parsedIntent.subject,
        topic: parsedIntent.topic,
        durationMinutes: parsedIntent.durationMinutes,
        confidenceScore: parsedIntent.confidenceScore,
      });

      const message = `Logged ${studySession.durationMinutes} minutes for ${studySession.subject} / ${studySession.topic} with confidence ${studySession.confidenceScore}/5.`;
      await recordLiveEvent('study_logged', {
        label: `${studySession.subject} / ${studySession.topic}`,
        userId: authSession.user.id,
        studentId,
      });

      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: studySession.subject,
        topic: studySession.topic,
        timestamp: new Date().toISOString(),
        session_id: studySession.session_id,
        role: 'assistant',
        intent: 'study',
        content: message,
      });

      return textResponse(message);
    }

    if (parsedIntent.type === 'exam') {
      const exam = await scheduleManager.addExamEvent({
        studentId,
        subject: parsedIntent.subject,
        topic: parsedIntent.topic,
        examDate: parsedIntent.examDate,
        reminderLeadDays: parsedIntent.reminderLeadDays,
      });

      const message = `Tracked ${exam.subject} on ${exam.examDate}. Reminder lead days: ${exam.reminderLeadDays.join(', ')}.`;
      await recordLiveEvent('exam_tracked', {
        label: `${exam.subject} / ${exam.topic}`,
        userId: authSession.user.id,
        studentId,
      });

      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: exam.subject,
        topic: exam.topic,
        timestamp: new Date().toISOString(),
        session_id: exam.session_id,
        role: 'assistant',
        intent: 'exam',
        content: message,
      });

      return textResponse(message);
    }

    if (parsedIntent.type === 'plan') {
      const plan = await planGenerator.generate(studentId, parsedIntent.days);
      const message = planGenerator.formatPlan(plan);
      await recordLiveEvent('plan_generated', {
        label: `${plan.horizonDays}-day plan`,
        userId: authSession.user.id,
        studentId,
      });

      await memoryStore.retainChatEvent({
        student_id: studentId,
        subject: 'Planning',
        topic: `${plan.horizonDays}-day plan`,
        timestamp: new Date().toISOString(),
        session_id: plan.session_id,
        role: 'assistant',
        intent: 'plan',
        content: message,
      });

      return textResponse(message);
    }

    const recalledMemories = await memoryStore.recall(studentId, lastMessage.content, { limit: 5 });
    const weakAreaResult = await mistakeTracker.getWeakAreas(studentId);
    const exams = await scheduleManager.listUpcomingExams(studentId);

    const systemPrompt = [
      'You are AI Study Companion, a rigorous but supportive revision coach.',
      'Use the student history as source of truth.',
      `Current weak areas: ${
        weakAreaResult.weakAreas.length > 0
          ? weakAreaResult.weakAreas
              .slice(0, 4)
              .map((area) => `${area.subject}/${area.topic} (${area.accuracyRate}%)`)
              .join(', ')
          : 'none yet'
      }.`,
      `Upcoming exams: ${
        exams.length > 0
          ? exams
              .slice(0, 4)
              .map((exam) => `${exam.subject} on ${exam.examDate}`)
              .join(', ')
          : 'none tracked'
      }.`,
      'Give direct study guidance based on the retrieved memory and current question.',
      `Retrieved memory:\n${memoryStore.formatRecallContext(recalledMemories)}`,
    ].join('\n\n');

    const result = await streamText({
      model: getGroqModel(),
      system: systemPrompt,
      prompt: [
        'Respond to the latest student message in context.',
        '',
        recentConversation(messages),
      ].join('\n'),
      onFinish: async ({ text }) => {
        await memoryStore.retainChatEvent({
          student_id: studentId,
          subject: 'Chat',
          topic: 'general',
          timestamp: new Date().toISOString(),
          session_id: crypto.randomUUID(),
          role: 'assistant',
          intent: 'chat',
          content: text,
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat route failed', error);

    if (error instanceof z.ZodError) {
      return textResponse('Invalid chat payload.', 400);
    }

    if (error instanceof Error && error.message === 'Too many requests. Please try again later.') {
      return textResponse(error.message, 429);
    }

    if (
      error instanceof Error &&
      (error.message === 'Cross-origin requests are not allowed for this endpoint.' ||
        error.message === 'Request origin could not be verified.')
    ) {
      return textResponse('Forbidden request origin.', 403);
    }

    if (error instanceof ConfigError) {
      return textResponse('The study coach is temporarily unavailable.', 503);
    }

    return textResponse('The study companion could not process the request.', 500);
  }
}
