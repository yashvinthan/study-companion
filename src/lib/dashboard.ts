import { mistakeTracker } from '@/lib/engines/Mistake_Tracker';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { memoryStore } from '@/lib/memory/MemoryStore';
import { getLatestStudyPlan, getPostgresUserSnapshot, listRecentLiveEvents } from '@/lib/postgres';
import type {
  ActivityFeedItem,
  ChatEvent,
  DashboardData,
  ExamEvent,
  ProfileSnapshot,
  QuizRecord,
  StudyPlanRecord,
  StudySessionRecord,
} from '@/lib/types';

export async function getDashboardData(studentId: string): Promise<DashboardData> {
  const connection = await memoryStore.getConnectionStatus(studentId);
  const memoryAvailable = connection.ok;

  const [
    weakAreaResult,
    recentSessions,
    upcomingExams,
    dueReminders,
    latestPlanFromMemory,
    latestPlanFromPg,
    quizRecords,
  ] = await Promise.all([
    memoryAvailable
      ? mistakeTracker.getWeakAreas(studentId)
      : Promise.resolve({ weakAreas: [], message: 'Memory is temporarily unavailable.' }),
    memoryAvailable ? scheduleManager.listStudySessions(studentId) : Promise.resolve([]),
    memoryAvailable ? scheduleManager.getDashboardExams(studentId) : Promise.resolve([]),
    memoryAvailable ? scheduleManager.getDueReminders(studentId) : Promise.resolve([]),
    memoryAvailable
      ? memoryStore.getLatestEntry<StudyPlanRecord>(studentId, 'study_plan')
      : Promise.resolve(null),
    getLatestStudyPlan(studentId).catch(() => null),
    memoryAvailable ? memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record') : Promise.resolve([]),
  ]);

  const averageDailyMinutesBySubject = memoryAvailable
    ? await scheduleManager.getAverageDailyMinutesBySubject(studentId, recentSessions)
    : new Map<string, number>();
  const averageDailyMinutes =
    averageDailyMinutesBySubject.size === 0
      ? 0
      : Math.round(
          Array.from(averageDailyMinutesBySubject.values()).reduce((sum, value) => sum + value, 0) /
            averageDailyMinutesBySubject.size,
        );

  return {
    connection,
    weakAreas: weakAreaResult.weakAreas,
    recentSessions: recentSessions.slice(0, 8),
    upcomingExams,
    dueReminders,
    latestPlan: latestPlanFromMemory ?? latestPlanFromPg,
    summary: {
      quizCount: quizRecords.length,
      studySessions: recentSessions.length,
      examsTracked: upcomingExams.length,
      averageDailyMinutes,
    },
  };
}

function mapHindsightActivity(
  entry: QuizRecord | StudySessionRecord | ExamEvent | StudyPlanRecord | ChatEvent,
): ActivityFeedItem {
  switch (entry.entry_type) {
    case 'quiz_record':
      return {
        id: `${entry.entry_type}-${entry.session_id}-${entry.timestamp}`,
        source: 'hindsight',
        type: entry.entry_type,
        title: `${entry.subject} quiz ${entry.isCorrect ? 'answered correctly' : 'missed'}`,
        description: entry.questionText,
        timestamp: entry.timestamp,
      };
    case 'study_session':
      return {
        id: `${entry.entry_type}-${entry.session_id}-${entry.timestamp}`,
        source: 'hindsight',
        type: entry.entry_type,
        title: `${entry.subject} study session logged`,
        description: `${entry.durationMinutes} minutes with confidence ${entry.confidenceScore}/5`,
        timestamp: entry.timestamp,
      };
    case 'exam_event':
      return {
        id: `${entry.entry_type}-${entry.session_id}-${entry.timestamp}`,
        source: 'hindsight',
        type: entry.entry_type,
        title: `${entry.subject} exam tracked`,
        description: `Exam date ${entry.examDate}`,
        timestamp: entry.timestamp,
      };
    case 'study_plan':
      return {
        id: `${entry.entry_type}-${entry.session_id}-${entry.timestamp}`,
        source: 'hindsight',
        type: entry.entry_type,
        title: `${entry.horizonDays}-day plan generated`,
        description: `${entry.items.length} scheduled blocks`,
        timestamp: entry.timestamp,
      };
    case 'chat_event':
      return {
        id: `${entry.entry_type}-${entry.session_id}-${entry.timestamp}`,
        source: 'hindsight',
        type: entry.entry_type,
        title: `${entry.role === 'assistant' ? 'Assistant' : 'Student'} ${entry.intent}`,
        description: entry.content.slice(0, 140),
        timestamp: entry.timestamp,
      };
  }
}

function mapPostgresActivity(event: Awaited<ReturnType<typeof listRecentLiveEvents>>[number]): ActivityFeedItem {
  switch (event.eventType) {
    case 'login_success':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Signed in successfully',
        description: 'A new account session was created.',
        timestamp: event.createdAt,
      };
    case 'logout':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Signed out',
        description: 'The current session was closed.',
        timestamp: event.createdAt,
      };
    case 'signup_success':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Account created',
        description: 'A new student account was registered.',
        timestamp: event.createdAt,
      };
    case 'profile_updated':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Profile updated',
        description: 'Personal account details were updated.',
        timestamp: event.createdAt,
      };
    case 'password_updated':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Password changed',
        description: 'Account security settings were updated.',
        timestamp: event.createdAt,
      };
    case 'study_logged':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Study session saved',
        description: event.label,
        timestamp: event.createdAt,
      };
    case 'exam_tracked':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: 'Exam tracked',
        description: event.label,
        timestamp: event.createdAt,
      };
    case 'quiz_generated':
    case 'quiz_answered':
    case 'plan_generated':
    case 'chat_request':
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: event.eventType,
        title: event.eventType.replaceAll('_', ' '),
        description: event.label,
        timestamp: event.createdAt,
      };
    default:
      return {
        id: `postgres-${event.id}`,
        source: 'postgres',
        type: 'chat_request',
        title: 'System event',
        description: event.label,
        timestamp: event.createdAt,
      };
  }
}

export async function getActivityFeed(studentId: string, userId?: string) {
  const connection = await memoryStore.getConnectionStatus(studentId);
  const [history, liveEvents] = await Promise.all([
    connection.ok
      ? Promise.all([
          memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record'),
          memoryStore.listEntries<StudySessionRecord>(studentId, 'study_session'),
          memoryStore.listEntries<ExamEvent>(studentId, 'exam_event'),
          memoryStore.listEntries<StudyPlanRecord>(studentId, 'study_plan'),
          memoryStore.listEntries<ChatEvent>(studentId, 'chat_event'),
        ])
      : Promise.resolve([[], [], [], [], []] as const),
    listRecentLiveEvents({
      userId,
      studentId,
      limit: 10,
    }).catch(() => []),
  ]);

  const [quizRecords, studySessions, exams, plans, chatEvents] = history;

  const hindsightEvents = [
    ...quizRecords.slice(0, 8),
    ...studySessions.slice(0, 8),
    ...exams.slice(0, 8),
    ...plans.slice(0, 4),
    ...chatEvents.slice(0, 8),
  ].map(mapHindsightActivity);

  const postgresEvents = liveEvents.map(mapPostgresActivity);

  return [...hindsightEvents, ...postgresEvents]
    .toSorted((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 18);
}

export async function getProfileSnapshot(userId: string, studentId: string): Promise<ProfileSnapshot> {
  const [connection, dbUser, dashboardData, quizRecords, studySessions, exams] = await Promise.all([
    memoryStore.getConnectionStatus(studentId),
    getPostgresUserSnapshot(userId),
    getDashboardData(studentId),
    memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record').catch(() => []),
    memoryStore.listEntries<StudySessionRecord>(studentId, 'study_session').catch(() => []),
    memoryStore.listEntries<ExamEvent>(studentId, 'exam_event').catch(() => []),
  ]);

  const subjectsTracked = new Set<string>();
  for (const record of quizRecords) {
    subjectsTracked.add(record.subject);
  }
  for (const session of studySessions) {
    subjectsTracked.add(session.subject);
  }
  for (const exam of exams) {
    subjectsTracked.add(exam.subject);
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    authProvider: dbUser.authProvider,
    hasPassword: dbUser.hasPassword,
    createdAt: dbUser.createdAt,
    lastLoginAt: dbUser.lastLoginAt,
    onboardingCompleted: dbUser.onboardingCompleted,
    studyCountry: dbUser.studyCountry,
    studyBoard: dbUser.studyBoard,
    studyGrade: dbUser.studyGrade,
    activeSessionCount: dbUser.activeSessionCount,
    quizRecordCount: dashboardData.summary.quizCount,
    studySessionCount: dashboardData.summary.studySessions,
    examCount: dashboardData.summary.examsTracked,
    weakAreaCount: dashboardData.weakAreas.length,
    subjectsTracked: Array.from(subjectsTracked).toSorted(),
    connection,
  };
}
