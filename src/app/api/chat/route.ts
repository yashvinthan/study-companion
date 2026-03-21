import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth';
import { mistakeTracker } from '@/lib/engines/Mistake_Tracker';
import { planGenerator, PlanGenerationError } from '@/lib/engines/Plan_Generator';
import { quizEngine } from '@/lib/engines/Quiz_Engine';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { assertGroqConfig, ConfigError } from '@/lib/config';
import { getGroqModelName } from '@/lib/llm';
import { memoryStore, MemoryStoreError } from '@/lib/memory/MemoryStore';
import { enforceRateLimit, recordLiveEvent } from '@/lib/postgres';
import { assertTrustedOrigin } from '@/lib/security';
import { searchWeb, type SearchMode, type WebSearchResult } from '@/lib/web-search';

export const dynamic = 'force-dynamic';
const CHAT_STREAM_TIMEOUT_MS = 90_000;
const CHAT_STREAM_TIMEOUT_WITH_ATTACHMENTS_MS = 120_000;
const MAX_ATTACHMENT_TEXT_CHARS = 10_000;
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const attachmentSchema = z.object({
  name: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  kind: z.enum(['text', 'pdf', 'image', 'doc']),
  textContent: z.string().max(200_000).optional(),
  dataUrl: z.string().max(8_000_000).optional(),
});

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(4_000),
  attachments: z.array(attachmentSchema).max(6).optional(),
});

const chatPayloadSchema = z.object({
  messages: z.array(chatMessageSchema).max(20).optional(),
  search_mode: z.enum(['web', 'academic', 'social']).optional(),
  deep_research: z.boolean().optional(),
  llm_model: z.string().min(1).max(120).optional(),
});

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

type ChatAttachment = z.infer<typeof attachmentSchema>;

function textResponse(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function formatWebContext(results: WebSearchResult[]) {
  if (results.length === 0) {
    return '';
  }

  return results
    .map((result, index) => {
      return `[${index + 1}] ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet || 'No snippet available.'}`;
    })
    .join('\n\n');
}

function formatSources(results: WebSearchResult[]) {
  if (results.length === 0) {
    return '';
  }

  return [
    'Sources:',
    ...results.map((result, index) => `${index + 1}. ${result.title} — ${result.url}`),
  ].join('\n');
}

function extractHindsightErrorMessage(error: unknown) {
  if (error instanceof MemoryStoreError) {
    return error.message;
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (error.name === 'MemoryStoreError' || lower.includes('hindsight') || lower.includes('memorystore')) {
      return error.message;
    }
  }

  return null;
}

function resolveRequestedModel(requestedModel: string | undefined) {
  if (!requestedModel) {
    return undefined;
  }

  const allowList = (process.env.CHAT_ALLOWED_MODELS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowList.length === 0) {
    return undefined;
  }

  return allowList.includes(requestedModel) ? requestedModel : undefined;
}

type ProviderErrorLike = {
  statusCode?: unknown;
  responseHeaders?: unknown;
  message?: unknown;
  responseBody?: unknown;
  data?: unknown;
};

function parseRetryAfterSeconds(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.ceil(asNumber);
  }

  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    const seconds = Math.ceil((asDate - Date.now()) / 1000);
    return seconds > 0 ? seconds : undefined;
  }

  return undefined;
}

function getHeaderValue(
  headers: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const value = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  return typeof value === 'string' ? value : undefined;
}

function getProviderRateLimitDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const providerError = error as ProviderErrorLike;
  const statusCode = typeof providerError.statusCode === 'number' ? providerError.statusCode : undefined;
  const message = typeof providerError.message === 'string' ? providerError.message : '';

  const responseHeaders =
    providerError.responseHeaders && typeof providerError.responseHeaders === 'object'
      ? (providerError.responseHeaders as Record<string, unknown>)
      : undefined;

  const retryAfterRaw =
    getHeaderValue(responseHeaders, 'retry-after') ?? getHeaderValue(responseHeaders, 'Retry-After');
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterRaw);
  const remainingTokens = getHeaderValue(responseHeaders, 'x-ratelimit-remaining-tokens');
  const remainingRequests = getHeaderValue(responseHeaders, 'x-ratelimit-remaining-requests');

  const isRateLimit =
    statusCode === 429 ||
    message.toLowerCase().includes('rate limit') ||
    message.includes('429') ||
    message.toLowerCase().includes('too many requests');

  if (!isRateLimit) {
    return null;
  }

  return {
    retryAfterRaw,
    retryAfterSeconds,
    remainingTokens,
    remainingRequests,
  };
}

function isJsonValidationFailure(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const providerError = error as ProviderErrorLike;
  const statusCode = typeof providerError.statusCode === 'number' ? providerError.statusCode : undefined;
  const message = typeof providerError.message === 'string' ? providerError.message : '';
  const responseBody =
    typeof providerError.responseBody === 'string'
      ? providerError.responseBody
      : JSON.stringify(providerError.responseBody ?? '');
  const dataString = JSON.stringify(providerError.data ?? '');

  return (
    statusCode === 400 &&
    (message.toLowerCase().includes('validate json') ||
      responseBody.includes('json_validate_failed') ||
      dataString.includes('json_validate_failed'))
  );
}

type LlmChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

class ProviderHttpError extends Error {
  statusCode: number;
  provider: 'groq' | 'openai' | 'gemini';
  responseBody: string;
  responseHeaders: Record<string, string>;

  constructor({
    provider,
    statusCode,
    message,
    responseBody,
    responseHeaders,
  }: {
    provider: 'groq' | 'openai' | 'gemini';
    statusCode: number;
    message: string;
    responseBody: string;
    responseHeaders: Record<string, string>;
  }) {
    super(message);
    this.name = 'ProviderHttpError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.responseHeaders = responseHeaders;
  }
}

function isRateLimitStatus(statusCode: number) {
  return statusCode === 429;
}

function toHeaderRecord(headers: Headers) {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function formatMessagesForGemini(systemPrompt: string, messages: LlmChatMessage[]) {
  const joinedConversation = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');

  return `${systemPrompt}\n\nConversation:\n${joinedConversation}\n\nRespond as the assistant.`;
}

async function generateGroqChatCompletion({
  systemPrompt,
  messages,
  maxCompletionTokens,
  timeoutMs,
  model,
}: {
  systemPrompt: string;
  messages: LlmChatMessage[];
  maxCompletionTokens: number;
  timeoutMs: number;
  model?: string;
}) {
  const config = assertGroqConfig();
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || config.groqModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_completion_tokens: maxCompletionTokens,
      temperature: 0.7,
      service_tier: 'on_demand',
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ProviderHttpError({
      provider: 'groq',
      statusCode: response.status,
      message: `Groq chat.completions failed (${response.status})`,
      responseBody: errorBody,
      responseHeaders: toHeaderRecord(response.headers),
    });
  }

  const body = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return body.choices?.[0]?.message?.content?.trim() ?? '';
}

async function generateOpenAIChatCompletion({
  systemPrompt,
  messages,
  maxCompletionTokens,
  timeoutMs,
}: {
  systemPrompt: string;
  messages: LlmChatMessage[];
  maxCompletionTokens: number;
  timeoutMs: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  if (!apiKey) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_completion_tokens: maxCompletionTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ProviderHttpError({
      provider: 'openai',
      statusCode: response.status,
      message: `OpenAI chat.completions failed (${response.status})`,
      responseBody: errorBody,
      responseHeaders: toHeaderRecord(response.headers),
    });
  }

  const body = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  return body.choices?.[0]?.message?.content?.trim() ?? '';
}

async function generateGeminiCompletion({
  systemPrompt,
  messages,
  timeoutMs,
}: {
  systemPrompt: string;
  messages: LlmChatMessage[];
  timeoutMs: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-pro';
  if (!apiKey) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = formatMessagesForGemini(systemPrompt, messages);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new ProviderHttpError({
      provider: 'gemini',
      statusCode: response.status,
      message: `Gemini generateContent failed (${response.status})`,
      responseBody: errorBody,
      responseHeaders: toHeaderRecord(response.headers),
    });
  }

  const body = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n');
  return text?.trim() ?? '';
}

async function generateChatCompletionWithFallback({
  systemPrompt,
  messages,
  maxCompletionTokens,
  timeoutMs,
  model,
}: {
  systemPrompt: string;
  messages: LlmChatMessage[];
  maxCompletionTokens: number;
  timeoutMs: number;
  model?: string;
}) {
  let groqRateLimitError: ProviderHttpError | null = null;

  try {
    return await generateGroqChatCompletion({
      systemPrompt,
      messages,
      maxCompletionTokens,
      timeoutMs,
      model,
    });
  } catch (error) {
    const shouldFallback =
      error instanceof ProviderHttpError && isRateLimitStatus(error.statusCode) && error.provider === 'groq';
    if (!shouldFallback) {
      throw error;
    }
    groqRateLimitError = error;

    console.warn('Groq rate limit reached. Falling back to OpenAI/Gemini.', {
      statusCode: error.statusCode,
    });
  }

  try {
    const openaiResult = await generateOpenAIChatCompletion({
      systemPrompt,
      messages,
      maxCompletionTokens,
      timeoutMs,
    });
    if (openaiResult) {
      return openaiResult;
    }
  } catch (error) {
    console.warn('OpenAI fallback failed; trying Gemini.', error);
  }

  const geminiResult = await generateGeminiCompletion({
    systemPrompt,
    messages,
    timeoutMs,
  });
  if (geminiResult) {
    return geminiResult;
  }

  if (groqRateLimitError) {
    throw groqRateLimitError;
  }

  throw new Error('All provider fallbacks failed.');
}

function helpText() {
  return [
    'StudyTether actions:',
    '',
    '- Ask for a quiz: "Quiz me on Physics:Kinematics".',
    '- Answer naturally: "A", "True", or "My answer is ...".',
    '- Ask for weak areas: "Show my mistakes".',
    '- Log study: "I studied Physics kinematics for 45 minutes confidence 3".',
    '- Track exam: "Track exam Physics on 2026-05-20".',
    '- Generate plan: "Make a 7-day study plan".',
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

  if (lower === '/help') {
    return { type: 'help' };
  }

  if (
    content.startsWith('/quiz') ||
    /^quiz\b/i.test(content) ||
    /\bquiz me\b/i.test(content) ||
    /\bgive me (a )?quiz\b/i.test(content)
  ) {
    const payload = content.startsWith('/quiz')
      ? content.slice(5).trim()
      : content.replace(/^quiz(\s+me)?/i, '').replace(/^give me (a )?quiz/i, '').trim();
    const [subjectPart, topicPart] = payload.split(':').map((part) => part?.trim()).filter(Boolean);
    return {
      type: 'quiz',
      subject: subjectPart || 'Physics',
      topic: topicPart,
    };
  }

  if (content.startsWith('/answer')) {
    return {
      type: 'answer',
      answer: content.slice(7).trim(),
    };
  }

  if (
    content.startsWith('/mistakes') ||
    /\b(mistakes|weak areas?|weakness(es)?|where am i weak)\b/i.test(content)
  ) {
    return { type: 'mistakes' };
  }

  if (
    content.startsWith('/plan') ||
    /\b(study plan|plan)\b/i.test(content)
  ) {
    const daysMatch = content.match(/\b(\d{1,2})\s*[- ]?\s*day\b/i);
    const days = daysMatch ? Number.parseInt(daysMatch[1], 10) : Number.parseInt(content.replace('/plan', '').trim(), 10);
    return {
      type: 'plan',
      days: Number.isFinite(days) ? days : 7,
    };
  }

  if (
    content.startsWith('/study') ||
    /\b(i studied|study session|log study|studied)\b/i.test(content)
  ) {
    const [, payload = ''] = content.split('/study');
    const [subject, topic, minutes, confidence] = payload
      ? payload.split('|').map((part) => part.trim())
      : [undefined, undefined, undefined, undefined];
    const minutesMatch = content.match(/\b(\d{1,3})\s*(minutes?|mins?)\b/i);
    const confidenceMatch = content.match(/\bconfidence\s*[:=]?\s*([1-5])\b/i);
    return {
      type: 'study',
      subject: subject || 'General Revision',
      topic: topic || subject || 'General Revision',
      durationMinutes: Number.parseInt(minutes || minutesMatch?.[1] || '45', 10),
      confidenceScore:
        (Number.parseInt(confidence || confidenceMatch?.[1] || '3', 10) as 1 | 2 | 3 | 4 | 5) || 3,
    };
  }

  if (
    content.startsWith('/exam') ||
    /\b(exam|test)\b/i.test(content) && /\b(track|add|schedule|on)\b/i.test(content)
  ) {
    const [, payload = ''] = content.split('/exam');
    const [subject, examDate, topic, reminderLeadDays] = payload.split('|').map((part) => part.trim());
    const naturalDateMatch = content.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return {
      type: 'exam',
      subject: subject || 'General',
      examDate: examDate || naturalDateMatch?.[1] || new Date().toISOString().slice(0, 10),
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

function isLikelyQuizAnswer(content: string) {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/^[abcd]$/.test(normalized) || /^(true|false)$/.test(normalized)) {
    return true;
  }

  return /^my answer( is)?\b/.test(normalized) || /^answer( is)?\b/.test(normalized);
}

function truncateForContext(text: string, maxChars = MAX_ATTACHMENT_TEXT_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars)}\n...[truncated]`;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Payload] = match;
  try {
    return {
      mimeType,
      buffer: Buffer.from(base64Payload, 'base64'),
    };
  } catch {
    return null;
  }
}

async function extractPdfText(attachment: ChatAttachment) {
  if (!attachment.dataUrl) {
    return null;
  }

  const parsed = parseDataUrl(attachment.dataUrl);
  if (!parsed) {
    return null;
  }

  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: parsed.buffer });
    try {
      const result = await parser.getText();
      if (!result.text?.trim()) {
        return null;
      }

      return truncateForContext(result.text);
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    console.warn('PDF extraction unavailable in current runtime.', error);
    return null;
  }
}

async function extractDocText(attachment: ChatAttachment) {
  if (!attachment.dataUrl) {
    return null;
  }

  const parsed = parseDataUrl(attachment.dataUrl);
  if (!parsed) {
    return null;
  }

  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: parsed.buffer });
    const cleaned = result.value?.trim();
    if (!cleaned) {
      return null;
    }
    return truncateForContext(cleaned);
  } catch (error) {
    console.warn('DOC/DOCX extraction unavailable in current runtime.', error);
    return null;
  }
}

async function describeImageWithGroq(attachment: ChatAttachment) {
  if (!attachment.dataUrl) {
    return null;
  }

  const config = assertGroqConfig();
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Read this study image and extract the useful academic content. Return clean notes.',
            },
            {
              type: 'image_url',
              image_url: { url: attachment.dataUrl },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 700,
      service_tier: 'on_demand',
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Vision extract failed with ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  return content ? truncateForContext(content) : null;
}

async function buildAttachmentContext(attachments: ChatAttachment[]) {
  if (attachments.length === 0) {
    return '';
  }

  const sections: string[] = [];

  for (const attachment of attachments) {
    try {
      if (attachment.kind === 'text' && attachment.textContent) {
        sections.push(
          `Attachment (${attachment.name}, notes)\n${truncateForContext(attachment.textContent)}`,
        );
        continue;
      }

      if (attachment.kind === 'pdf') {
        const extracted = await extractPdfText(attachment);
        if (extracted) {
          sections.push(`Attachment (${attachment.name}, pdf)\n${extracted}`);
        } else {
          sections.push(`Attachment (${attachment.name}, pdf)\nNo readable PDF text was extracted.`);
        }
        continue;
      }

      if (attachment.kind === 'doc') {
        const extracted = await extractDocText(attachment);
        if (extracted) {
          sections.push(`Attachment (${attachment.name}, document)\n${extracted}`);
        } else {
          sections.push(
            `Attachment (${attachment.name}, document)\nNo readable document text was extracted. For best results, upload .docx or plain text.`,
          );
        }
        continue;
      }

      if (attachment.kind === 'image') {
        const description = await describeImageWithGroq(attachment);
        if (description) {
          sections.push(`Attachment (${attachment.name}, image)\n${description}`);
        } else {
          sections.push(`Attachment (${attachment.name}, image)\nImage was uploaded but no text was extracted.`);
        }
      }
    } catch {
      sections.push(`Attachment (${attachment.name})\nCould not process this attachment.`);
    }
  }

  return sections.join('\n\n');
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

function retainChatEventSafe(entry: Parameters<typeof memoryStore.retainChatEvent>[0]) {
  void memoryStore.retainChatEvent(entry).catch((error) => {
    console.warn('Chat event retain failed; continuing without persistent memory.', error);
  });
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

    const rawPayload = (await request.json()) as unknown;
    const normalizedPayload =
      rawPayload && typeof rawPayload === 'object'
        ? {
            ...rawPayload,
            messages: Array.isArray((rawPayload as { messages?: unknown }).messages)
              ? (rawPayload as { messages: unknown[] }).messages.filter((message) => {
                  if (!message || typeof message !== 'object') {
                    return false;
                  }

                  const content = (message as { content?: unknown }).content;
                  const attachments = (message as { attachments?: unknown }).attachments;
                  const hasText = typeof content === 'string' && content.trim().length > 0;
                  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
                  return hasText || hasAttachments;
                })
              : (rawPayload as { messages?: unknown }).messages,
          }
        : rawPayload;
    const payload = chatPayloadSchema.parse(normalizedPayload);
    const studentId = authSession.user.email;
    const messages = payload.messages ?? [];
    const searchMode = (payload.search_mode ?? 'web') as SearchMode;
    const deepResearch = payload.deep_research ?? false;
    const selectedModel = resolveRequestedModel(payload.llm_model);
    const lastMessage = messages[messages.length - 1];

    if (
      !lastMessage ||
      (!lastMessage.content?.trim() && (!lastMessage.attachments || lastMessage.attachments.length === 0))
    ) {
      return textResponse('Send a message to begin.', 400);
    }

    const attachmentCount = lastMessage.attachments?.length ?? 0;
    const parsedIntent = parseIntent(
      lastMessage.content || (attachmentCount > 0 ? 'analyze attached study material' : ''),
    );
    await recordLiveEvent('chat_request', {
      label: parsedIntent.type,
      userId: authSession.user.id,
      studentId,
    });
    await retainChatEventSafe({
      student_id: studentId,
      subject: 'Chat',
      topic: parsedIntent.type,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      role: 'user',
      intent: parsedIntent.type,
      content:
        lastMessage.content ||
        `Uploaded ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'} for analysis.`,
    });

    if (parsedIntent.type === 'help') {
      const message = helpText();
      await retainChatEventSafe({
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

      await retainChatEventSafe({
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
        return textResponse('Please provide your answer.', 400);
      }

      const outcome = await quizEngine.evaluateLatestAnswer(studentId, parsedIntent.answer);
      const weakArea = await mistakeTracker.updateFromQuizRecord(outcome.record);
      const message = formatQuizResult(outcome, weakArea);
      await recordLiveEvent('quiz_answered', {
        label: `${outcome.record.subject} / ${outcome.record.topic}`,
        userId: authSession.user.id,
        studentId,
      });

      await retainChatEventSafe({
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

    if (parsedIntent.type === 'chat' && isLikelyQuizAnswer(lastMessage.content || '')) {
      const pendingPrompt = await quizEngine.getPendingPrompt(studentId);
      if (pendingPrompt) {
        const outcome = await quizEngine.evaluateLatestAnswer(studentId, lastMessage.content || '');
        const weakArea = await mistakeTracker.updateFromQuizRecord(outcome.record);
        const message = formatQuizResult(outcome, weakArea);
        await recordLiveEvent('quiz_answered', {
          label: `${outcome.record.subject} / ${outcome.record.topic}`,
          userId: authSession.user.id,
          studentId,
        });

        await retainChatEventSafe({
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
    }

    if (
      parsedIntent.type === 'chat' &&
      /\b(what(?:['’]s| is)?\s*my\s+name|who\s+am\s+i|my\s+name\??|what\s+my\s+name)\b/i.test(
        lastMessage.content || '',
      )
    ) {
      const knownName = authSession.user.fullName?.trim();
      const message = knownName
        ? `Your name is ${knownName}.`
        : `You're signed in as ${authSession.user.email}.`;

      await retainChatEventSafe({
        student_id: studentId,
        subject: 'Profile',
        topic: 'identity',
        timestamp: new Date().toISOString(),
        session_id: crypto.randomUUID(),
        role: 'assistant',
        intent: 'chat',
        content: message,
      });

      return textResponse(message);
    }

    if (parsedIntent.type === 'mistakes') {
      const result = await mistakeTracker.getWeakAreas(studentId);
      const message = formatWeakAreas(result);

      await retainChatEventSafe({
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

      await retainChatEventSafe({
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

      await retainChatEventSafe({
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

      await retainChatEventSafe({
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

    const weakAreaResult = await mistakeTracker.getWeakAreas(studentId);
    const exams = await scheduleManager.listUpcomingExams(studentId);
    let recalledMemories: Awaited<ReturnType<typeof memoryStore.recall>> = [];
    if (parsedIntent.type === 'chat') {
      try {
        recalledMemories = await memoryStore.recall(studentId, lastMessage.content ?? '', {
          limit: deepResearch ? 10 : 5,
        });
      } catch (error) {
        console.warn('Chat memory recall failed; continuing without recall context.', error);
        recalledMemories = [];
      }
    }
    const memoryContext =
      recalledMemories.length > 0
        ? memoryStore.formatRecallContext(recalledMemories)
        : '';
    const attachmentContext = await buildAttachmentContext(lastMessage.attachments ?? []);
    const webResults =
      parsedIntent.type === 'chat'
        ? await searchWeb(lastMessage.content ?? '', deepResearch ? 12 : 6, searchMode)
        : [];
    const webContext = formatWebContext(webResults);
    const lastMessageIndex = messages.length - 1;

    const llmMessages = messages.map((message, index) => {
      if (index !== lastMessageIndex || message.role !== 'user' || !attachmentContext) {
        return {
          role: message.role,
          content: message.content,
        };
      }

      const promptText = message.content.trim() || 'Analyze the attached study material.';
      return {
        role: message.role,
        content: [
          promptText,
          '',
          'Attached study material:',
          attachmentContext,
          '',
          'Use this material directly in your answer.',
        ].join('\n'),
      };
    });

    const systemPrompt = [
      'You are StudyTether, a rigorous but supportive revision coach with long-term memory.',
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
      'Hindsight memory is available and required. Use recalled memory context as the primary source for personalized answers.',
      memoryContext
        ? `Relevant Hindsight memory context:\n${memoryContext}`
        : 'No directly relevant memory snippets were recalled for this message.',
      webContext
        ? 'When web search context is provided, use it to answer accurately. Cite claims inline like [1], [2], and avoid fabricating sources.'
        : 'If no web context is provided, answer from your own knowledge and the visible conversation.',
      `Selected source mode: ${searchMode}.`,
      deepResearch
        ? 'Deep research mode is ON. Return a structured, thorough analysis and highlight any uncertainty.'
        : 'Deep research mode is OFF. Keep answers concise by default.',
      'Do not mention hidden tools, internal APIs, or implementation details in your response.',
    ].join('\n\n');

    const completionText = await generateChatCompletionWithFallback({
      systemPrompt,
      messages: webContext
        ? [
            ...llmMessages,
            {
              role: 'system',
              content: `Web search results:\n\n${webContext}\n\nUse only these source IDs for citations.`,
            },
          ]
        : llmMessages,
      maxCompletionTokens: 900,
      model: selectedModel,
      timeoutMs: attachmentContext
        ? CHAT_STREAM_TIMEOUT_WITH_ATTACHMENTS_MS
        : CHAT_STREAM_TIMEOUT_MS,
    });

    const finalText =
      completionText || 'I could not generate a response this time. Please retry in a few seconds.';
    const withSources =
      webResults.length > 0 && !/Sources:/i.test(finalText)
        ? `${finalText}\n\n${formatSources(webResults)}`
        : finalText;

    await retainChatEventSafe({
      student_id: studentId,
      subject: 'Chat',
      topic: parsedIntent.type,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      role: 'assistant',
      intent: parsedIntent.type,
      content: withSources,
    });

    return textResponse(withSources);
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

    if (error instanceof PlanGenerationError) {
      return textResponse(error.message, 422);
    }

    const hindsightMessage = extractHindsightErrorMessage(error);
    if (hindsightMessage) {
      return textResponse(`Hindsight memory is currently unavailable. ${hindsightMessage}`, 503);
    }

    const providerRateLimit = getProviderRateLimitDetails(error);
    if (providerRateLimit) {
      const retryLabel = providerRateLimit.retryAfterSeconds
        ? `${providerRateLimit.retryAfterSeconds}s`
        : providerRateLimit.retryAfterRaw || 'a short interval';
      const message = `Groq rate limit reached. Retry in ${retryLabel}.`;
      const headers: HeadersInit = {
        'Content-Type': 'text/plain; charset=utf-8',
      };

      if (providerRateLimit.retryAfterRaw) {
        headers['Retry-After'] = providerRateLimit.retryAfterRaw;
      }
      if (providerRateLimit.remainingTokens) {
        headers['X-RateLimit-Remaining-Tokens'] = providerRateLimit.remainingTokens;
      }
      if (providerRateLimit.remainingRequests) {
        headers['X-RateLimit-Remaining-Requests'] = providerRateLimit.remainingRequests;
      }

      return new Response(message, { status: 429, headers });
    }

    if (isJsonValidationFailure(error)) {
      return textResponse(
        'The model could not format a structured response this time. Please retry with a shorter or clearer request.',
        502,
      );
    }

    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.message.toLowerCase().includes('aborted') ||
        error.message.toLowerCase().includes('timed out') ||
        error.message.toLowerCase().includes('timeout'))
    ) {
      return textResponse(
        'This response took too long. Please retry in a few seconds.',
        504,
      );
    }

    return textResponse('StudyTether could not process the request.', 500);
  }
}
