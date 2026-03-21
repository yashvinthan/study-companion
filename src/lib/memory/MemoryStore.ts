import { cache } from 'react';
import { HindsightClient } from '@vectorize-io/hindsight-client';
import { createHindsightTools } from '@vectorize-io/hindsight-ai-sdk';
import { assertMemoryConfig } from '@/lib/config';
import type {
  ChatEvent,
  MemoryEntryType,
  MemorySearchResult,
  MetadataEnvelope,
  StoredEntry,
} from '@/lib/types';
import { slugify } from '@/lib/utils';

type RawMemoryUnit = {
  id?: string;
  text?: string;
  content?: string;
  context?: string | null;
  metadata?: Record<string, string> | null;
  tags?: string[] | null;
  document_id?: string | null;
};

export class MemoryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryStoreError';
  }
}

const HINDSIGHT_REQUEST_TIMEOUT_MS =
  Number.parseInt(process.env.HINDSIGHT_REQUEST_TIMEOUT_MS ?? '30000', 10) || 30_000;
const HINDSIGHT_RETAIN_ASYNC = process.env.HINDSIGHT_RETAIN_ASYNC !== 'false';
const HINDSIGHT_RETAIN_ATTEMPTS = Number.parseInt(process.env.HINDSIGHT_RETAIN_ATTEMPTS ?? '3', 10) || 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 300,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await delay(baseDelayMs * 2 ** attempt);
      }
    }
  }

  throw lastError;
}

function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs = HINDSIGHT_REQUEST_TIMEOUT_MS) {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new MemoryStoreError(`${label} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);
}

function buildSummary(entry: StoredEntry) {
  switch (entry.entry_type) {
    case 'chat_event':
      return `${entry.role.toUpperCase()} ${entry.intent}: ${entry.content}`;
    case 'quiz_prompt':
      return `Quiz prompt for ${entry.subject}/${entry.topic}: ${entry.question.prompt}`;
    case 'quiz_record':
      return [
        `Quiz result for ${entry.subject}/${entry.topic}.`,
        `Question: ${entry.questionText}`,
        `Student answer: ${entry.studentAnswer}`,
        `Correct answer: ${entry.correctAnswer}`,
        `Result: ${entry.isCorrect ? 'correct' : 'incorrect'}.`,
        `Feedback: ${entry.feedback}`,
      ].join(' ');
    case 'mistake_pattern':
      return [
        `Mistake pattern for ${entry.subject}/${entry.topic}.`,
        `Accuracy ${entry.accuracyRate} percent across ${entry.totalAttempts} attempts.`,
        `${entry.errorCount} errors.`,
        entry.weakArea ? 'Currently classified as a weak area.' : 'No longer classified as a weak area.',
        `Common wrong answers: ${entry.commonWrongAnswers.join(', ') || 'none'}.`,
      ].join(' ');
    case 'study_session':
      return [
        `Study session logged on ${entry.date}.`,
        `Subjects: ${entry.subjects.join(', ')}.`,
        `Topics: ${entry.topics.join(', ')}.`,
        `Duration ${entry.durationMinutes} minutes.`,
        `Confidence ${entry.confidenceScore}/5.`,
      ].join(' ');
    case 'exam_event':
      return [
        `Exam scheduled for ${entry.subject} on ${entry.examDate}.`,
        `Reminder lead days: ${entry.reminderLeadDays.join(', ')}.`,
        entry.notes || 'No additional exam notes.',
      ].join(' ');
    case 'study_plan':
      return [
        `Study plan generated for ${entry.horizonDays} days.`,
        entry.isGeneric ? 'This is an onboarding plan.' : 'This plan is personalized.',
        `Focus areas: ${entry.items
          .slice(0, 6)
          .map((item) => `${item.subject}/${item.topic}`)
          .join(', ')}.`,
      ].join(' ');
    default:
      return JSON.stringify(entry);
  }
}

function buildTags(envelope: MetadataEnvelope, extraTags: string[] = []) {
  const tags = [
    `entry:${envelope.entry_type}`,
    `student:${slugify(envelope.student_id)}`,
    `subject:${slugify(envelope.subject || 'general')}`,
    `topic:${slugify(envelope.topic || 'general')}`,
    `session:${slugify(envelope.session_id)}`,
    ...extraTags,
  ];

  return [...new Set(tags.filter(Boolean))];
}

function buildMetadata(envelope: MetadataEnvelope) {
  return {
    entry_type: envelope.entry_type,
    student_id: envelope.student_id,
    subject: envelope.subject,
    topic: envelope.topic,
    timestamp: envelope.timestamp,
    session_id: envelope.session_id,
  };
}

function parseStoredEntry({
  context,
  metadata,
}: {
  context?: string | null;
  metadata?: Record<string, string> | null;
}) {
  const payloadBuffer = metadata?.payload || context;
  if (!payloadBuffer) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadBuffer) as StoredEntry;

    if (!parsed || typeof parsed !== 'object' || !metadata?.entry_type) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function sortEntries<T extends StoredEntry>(entries: T[]) {
  return entries.toSorted((left, right) => {
    return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
  });
}

export class MemoryStore {
  private client: HindsightClient | null = null;
  private readonly ensuredBanks = new Map<string, Promise<void>>();

  private getClient() {
    if (!this.client) {
      const config = assertMemoryConfig();
      this.client = new HindsightClient({
        apiKey: config.hindsightApiKey,
        baseUrl: config.hindsightBaseUrl,
      });
    }

    return this.client;
  }

  getTools(studentId: string) {
    return createHindsightTools({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: this.getClient() as any,
      bankId: this.getBankId(studentId),
    });
  }

  private getBankId(studentId: string) {
    const config = assertMemoryConfig();
    return `${config.hindsightBankPrefix}-${slugify(studentId) || 'student'}`;
  }

  async ensureReady(studentId: string) {
    const bankId = this.getBankId(studentId);
    const existing = this.ensuredBanks.get(bankId);

    if (existing) {
      return existing;
    }

    const pending = withTimeout(
      this.getClient().createBank(bankId, {
        name: `StudyTether - ${studentId}`,
        reflectMission:
          'Remember the student study journey accurately. Use retained quiz, mistake, schedule, and plan memories as the source of truth.',
        retainMission:
          'Capture structured student study history faithfully. Preserve subjects, topics, quiz accuracy, study habits, and exam deadlines.',
      }),
      'Hindsight bank initialization',
    )
      .then(() => undefined)
      .catch((error: unknown) => {
        this.ensuredBanks.delete(bankId);
        throw new MemoryStoreError(
          `Unable to connect to Hindsight memory bank for ${studentId}: ${String(error)}`,
        );
      });

    this.ensuredBanks.set(bankId, pending);
    return pending;
  }

  async getConnectionStatus(studentId: string) {
    try {
      await withRetries(() => this.ensureReady(studentId), 3, 400);
      return {
        ok: true,
        message: 'Connected to Hindsight persistent memory.',
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Hindsight connection failed. Check HINDSIGHT_BASE_URL and HINDSIGHT_API_KEY.',
      };
    }
  }

  async retainEntry(entry: StoredEntry, extraTags: string[] = []) {
    await withRetries(() => this.ensureReady(entry.student_id), 3, 400);

    const bankId = this.getBankId(entry.student_id);
    const content = JSON.stringify(entry);
    const context = buildSummary(entry);
    const metadata = { ...buildMetadata(entry), payload: JSON.stringify(entry) };
    const tags = buildTags(entry, extraTags);
    const client = this.getClient();

    let lastError: unknown;

    for (let attempt = 0; attempt < HINDSIGHT_RETAIN_ATTEMPTS; attempt += 1) {
      try {
        await withTimeout(
          client.retain(bankId, content, {
            context,
            metadata,
            tags,
            timestamp: entry.timestamp,
            documentId: `${entry.entry_type}-${entry.session_id}-${entry.timestamp}`,
            // Retain can run in background to avoid blocking app responses on extraction latency.
            async: HINDSIGHT_RETAIN_ASYNC,
          }),
          'Hindsight retain',
        );
        return;
      } catch (error) {
        lastError = error;
        if (attempt < HINDSIGHT_RETAIN_ATTEMPTS - 1) {
          await delay(300 * 2 ** attempt);
        }
      }
    }

    throw new MemoryStoreError(
      `Failed to retain ${entry.entry_type} after retries: ${String(lastError)}`,
    );
  }

  async retainChatEvent(entry: Omit<ChatEvent, 'entry_type'>) {
    return this.retainEntry({
      ...entry,
      entry_type: 'chat_event',
    });
  }

  async recall(
    studentId: string,
    query: string,
    options?: {
      limit?: number;
      tags?: string[];
    },
  ): Promise<MemorySearchResult[]> {
    await withRetries(() => this.ensureReady(studentId), 3, 400);

    const response = await withTimeout(
      this.getClient().recall(this.getBankId(studentId), query, {
        budget: 'mid',
        tags: options?.tags,
        tagsMatch: 'all_strict',
        queryTimestamp: new Date().toISOString(),
      }),
      'Hindsight recall',
    );

    return response.results.slice(0, options?.limit ?? 6).map((result) => {
      const entry = parseStoredEntry(result);

      return {
        id: result.id,
        text: result.text,
        context: result.context ?? null,
        metadata: result.metadata ?? {},
        tags: result.tags ?? [],
        entry,
      };
    });
  }

  async reflect(studentId: string, query: string, context?: string) {
    await withRetries(() => this.ensureReady(studentId), 3, 400);
    return withTimeout(
      this.getClient().reflect(this.getBankId(studentId), query, {
        context,
        budget: 'mid',
      }),
      'Hindsight reflect',
    );
  }

  listEntries = cache(
    async <T extends StoredEntry = StoredEntry>(
      studentId: string,
      entryType?: MemoryEntryType,
    ): Promise<T[]> => {
      await withRetries(() => this.ensureReady(studentId), 3, 400);

      const bankId = this.getBankId(studentId);
      const client = this.getClient();
      const items: RawMemoryUnit[] = [];
      let offset = 0;
      let total = 0;

      do {
        const response = await withTimeout(
          client.listMemories(bankId, {
            limit: 100,
            offset,
          }),
          'Hindsight listMemories',
        );

        const pageItems = (response.items ?? []) as RawMemoryUnit[];
        items.push(...pageItems);
        total = response.total;
        offset += pageItems.length;
      } while (offset < total);

      const parsedEntries = items
        .map((item) => {
          const entry = parseStoredEntry({
            context: item.context,
            metadata: item.metadata,
          });

          if (!entry) {
            return null;
          }

          if (entry.student_id !== studentId) {
            return null;
          }

          if (entryType && entry.entry_type !== entryType) {
            return null;
          }

          return entry;
        })
        .filter((entry): entry is T => entry !== null);

      return sortEntries(parsedEntries);
    },
  );

  async getLatestEntry<T extends StoredEntry = StoredEntry>(
    studentId: string,
    entryType: MemoryEntryType,
  ) {
    const entries = await this.listEntries<T>(studentId, entryType);
    return entries[0] ?? null;
  }

  formatRecallContext(results: MemorySearchResult[]) {
    if (results.length === 0) {
      return 'No relevant historical memory was found.';
    }

    return results
      .map((result, index) => {
        const subject = result.metadata.subject || 'general';
        const topic = result.metadata.topic || 'general';
        return `${index + 1}. [${subject}/${topic}] ${result.text}`;
      })
      .join('\n');
  }
}

export const memoryStore = new MemoryStore();
