import { memoryStore } from '@/lib/memory/MemoryStore';
import type { MistakePattern, QuizRecord, WeakArea } from '@/lib/types';
import { normalizeAnswer } from '@/lib/utils';

const WEAK_AREA_THRESHOLD = 60;

function countConsecutiveCorrect(records: QuizRecord[]) {
  let streak = 0;

  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (!records[index].isCorrect) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function buildWrongAnswerSummary(records: QuizRecord[]) {
  const counts = new Map<string, number>();

  for (const record of records) {
    if (record.isCorrect) {
      continue;
    }

    const normalized = normalizeAnswer(record.normalizedStudentAnswer || record.studentAnswer);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([answer]) => answer);
}

export class MistakeTracker {
  async getQuizRecords(studentId: string) {
    const records = await memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record');

    return records.toSorted((left, right) => {
      return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    });
  }

  async getWeakAreas(studentId: string) {
    const records = await this.getQuizRecords(studentId);

    if (records.length === 0) {
      return {
        weakAreas: [] as WeakArea[],
        message: 'No quiz history yet. Take a quiz to unlock weak-area tracking.',
      };
    }

    const patterns = await this.computePatterns(studentId, records);
    return {
      weakAreas: patterns.filter((pattern) => pattern.weakArea),
      message: '',
    };
  }

  async computePatterns(studentId: string, quizRecords?: QuizRecord[]) {
    const records = quizRecords ?? (await this.getQuizRecords(studentId));
    const grouped = new Map<string, QuizRecord[]>();

    for (const record of records) {
      const key = `${record.subject}::${record.topic}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(record);
      grouped.set(key, bucket);
    }

    const snapshots = await memoryStore
      .listEntries<MistakePattern>(studentId, 'mistake_pattern')
      .catch((error) => {
        console.warn('Mistake pattern snapshots unavailable; continuing without historical snapshots.', error);
        return [] as MistakePattern[];
      });
    const latestSnapshots = new Map<string, MistakePattern>();

    for (const snapshot of snapshots) {
      const key = `${snapshot.subject}::${snapshot.topic}`;
      if (!latestSnapshots.has(key)) {
        latestSnapshots.set(key, snapshot);
      }
    }

    const patterns: WeakArea[] = [];

    for (const [key, entries] of grouped.entries()) {
      const [subject, topic] = key.split('::');
      const totalAttempts = entries.length;
      const errorCount = entries.filter((entry) => !entry.isCorrect).length;
      const accuracyRate = Math.round(((totalAttempts - errorCount) / totalAttempts) * 100);
      const consecutiveCorrect = countConsecutiveCorrect(entries);
      const previousSnapshot = latestSnapshots.get(key);

      const weakArea =
        accuracyRate < WEAK_AREA_THRESHOLD ||
        Boolean(previousSnapshot?.weakArea && consecutiveCorrect < 5);

      patterns.push({
        subject,
        topic,
        accuracyRate,
        totalAttempts,
        errorCount,
        consecutiveCorrect,
        weakArea,
        commonWrongAnswers: buildWrongAnswerSummary(entries),
      });
    }

    return patterns.toSorted((left, right) => {
      if (right.errorCount !== left.errorCount) {
        return right.errorCount - left.errorCount;
      }

      return left.accuracyRate - right.accuracyRate;
    });
  }

  async updateFromQuizRecord(record: QuizRecord) {
    const allRecords = await this.getQuizRecords(record.student_id);
    const patterns = await this.computePatterns(record.student_id, allRecords);
    const currentPattern = patterns.find(
      (pattern) => pattern.subject === record.subject && pattern.topic === record.topic,
    );

    if (!currentPattern) {
      return null;
    }

    const latestSnapshots = await memoryStore
      .listEntries<MistakePattern>(record.student_id, 'mistake_pattern')
      .catch((error) => {
        console.warn('Could not load latest mistake snapshots; continuing with current pattern only.', error);
        return [] as MistakePattern[];
      });
    const latestSnapshot = latestSnapshots.find(
      (snapshot) => snapshot.subject === record.subject && snapshot.topic === record.topic,
    );

    const classificationChanged = latestSnapshot?.weakArea !== currentPattern.weakArea;
    const reachedDeclassificationGate =
      latestSnapshot?.weakArea && !currentPattern.weakArea && currentPattern.consecutiveCorrect >= 5;
    const shouldPersist =
      !record.isCorrect ||
      classificationChanged ||
      reachedDeclassificationGate ||
      currentPattern.errorCount % 5 === 0;

    if (!shouldPersist) {
      return currentPattern;
    }

    const snapshot: MistakePattern = {
      entry_type: 'mistake_pattern',
      student_id: record.student_id,
      subject: currentPattern.subject,
      topic: currentPattern.topic,
      timestamp: new Date().toISOString(),
      session_id: record.session_id,
      accuracyRate: currentPattern.accuracyRate,
      totalAttempts: currentPattern.totalAttempts,
      errorCount: currentPattern.errorCount,
      consecutiveCorrect: currentPattern.consecutiveCorrect,
      commonWrongAnswers: currentPattern.commonWrongAnswers,
      weakArea: currentPattern.weakArea,
      summary: currentPattern.weakArea
        ? `${currentPattern.subject}/${currentPattern.topic} remains weak at ${currentPattern.accuracyRate}% accuracy.`
        : `${currentPattern.subject}/${currentPattern.topic} has recovered to ${currentPattern.accuracyRate}% accuracy.`,
    };

    await memoryStore.retainEntry(snapshot);
    return currentPattern;
  }
}

export const mistakeTracker = new MistakeTracker();
