import { memoryStore } from '@/lib/memory/MemoryStore';
import type { DashboardExam, DashboardReminder, ExamEvent, StudySessionRecord } from '@/lib/types';
import { daysUntil, toClockTime, toIsoDate } from '@/lib/utils';

interface LogStudySessionInput {
  studentId: string;
  subject: string;
  topic?: string;
  durationMinutes: number;
  confidenceScore?: 1 | 2 | 3 | 4 | 5;
  date?: string;
  startTime?: string;
}

interface AddExamInput {
  studentId: string;
  subject: string;
  topic?: string;
  examDate: string;
  reminderLeadDays?: number[];
  notes?: string;
}

export class ScheduleManager {
  async logStudySession(input: LogStudySessionInput) {
    if (input.durationMinutes <= 0) {
      throw new Error('Study session duration must be greater than 0 minutes.');
    }

    const now = new Date();
    const session: StudySessionRecord = {
      entry_type: 'study_session',
      student_id: input.studentId,
      subject: input.subject,
      topic: input.topic || input.subject,
      timestamp: now.toISOString(),
      session_id: crypto.randomUUID(),
      date: input.date || toIsoDate(now),
      startTime: input.startTime || toClockTime(now),
      durationMinutes: input.durationMinutes,
      confidenceScore: input.confidenceScore ?? 3,
      subjects: [input.subject],
      topics: [input.topic || input.subject],
    };

    await memoryStore.retainEntry(session);
    return session;
  }

  async addExamEvent(input: AddExamInput) {
    const exam: ExamEvent = {
      entry_type: 'exam_event',
      student_id: input.studentId,
      subject: input.subject,
      topic: input.topic || input.subject,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      examDate: input.examDate,
      reminderLeadDays: input.reminderLeadDays?.length ? input.reminderLeadDays : [7, 3, 1],
      notes: input.notes || '',
    };

    await memoryStore.retainEntry(exam);
    return exam;
  }

  async listStudySessions(studentId: string) {
    return memoryStore.listEntries<StudySessionRecord>(studentId, 'study_session');
  }

  async listUpcomingExams(studentId: string) {
    const exams = await memoryStore.listEntries<ExamEvent>(studentId, 'exam_event');

    return exams
      .filter((exam) => daysUntil(exam.examDate) >= 0)
      .toSorted((left, right) => {
        return new Date(left.examDate).getTime() - new Date(right.examDate).getTime();
      });
  }

  async getAverageDailyMinutesBySubject(studentId: string, preFetchedSessions?: StudySessionRecord[]) {
    const sessions = preFetchedSessions ?? (await this.listStudySessions(studentId));
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const aggregates = new Map<
      string,
      {
        totalMinutes: number;
        days: Set<string>;
      }
    >();

    for (const session of sessions) {
      const sessionTime = new Date(session.timestamp).getTime();
      if (sessionTime < thirtyDaysAgo) {
        continue;
      }

      const current = aggregates.get(session.subject) ?? {
        totalMinutes: 0,
        days: new Set<string>(),
      };

      current.totalMinutes += session.durationMinutes;
      current.days.add(session.date);
      aggregates.set(session.subject, current);
    }

    return new Map(
      Array.from(aggregates.entries()).map(([subject, data]) => {
        const dayCount = Math.max(1, data.days.size);
        return [subject, Math.round(data.totalMinutes / dayCount)];
      }),
    );
  }

  async getDueReminders(studentId: string): Promise<DashboardReminder[]> {
    const exams = await this.listUpcomingExams(studentId);

    return exams
      .flatMap((exam) => {
        const daysAway = daysUntil(exam.examDate);
        const shouldNotify = exam.reminderLeadDays.includes(daysAway);

        if (!shouldNotify) {
          return [];
        }

        return [
          {
            subject: exam.subject,
            examDate: exam.examDate,
            daysAway,
            message:
              daysAway === 0
                ? `${exam.subject} is today. Keep the session light and focus on recall.`
                : `${exam.subject} exam is in ${daysAway} day${daysAway === 1 ? '' : 's'}.`,
          },
        ];
      })
      .toSorted((left, right) => left.daysAway - right.daysAway);
  }

  async getDashboardExams(studentId: string): Promise<DashboardExam[]> {
    const exams = await this.listUpcomingExams(studentId);

    return exams.map((exam) => {
      const daysAway = daysUntil(exam.examDate);
      return {
        ...exam,
        daysAway,
        dueReminderLeadDays: exam.reminderLeadDays.filter((leadDay) => leadDay === daysAway),
      };
    });
  }
}

export const scheduleManager = new ScheduleManager();
