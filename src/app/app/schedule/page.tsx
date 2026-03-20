import ScheduleWorkspace from '@/components/ScheduleWorkspace';
import { getCurrentSession } from '@/lib/auth';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { memoryStore } from '@/lib/memory/MemoryStore';

export default async function SchedulePage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const studentId = session.user.email;
  let connection = await memoryStore.getConnectionStatus(studentId);
  let recentSessions = [] as Awaited<ReturnType<typeof scheduleManager.listStudySessions>>;
  let upcomingExams = [] as Awaited<ReturnType<typeof scheduleManager.getDashboardExams>>;
  let dueReminders = [] as Awaited<ReturnType<typeof scheduleManager.getDueReminders>>;
  let averageDailyMinutesBySubject = new Map<string, number>();

  if (connection.ok) {
    try {
      [recentSessions, upcomingExams, dueReminders, averageDailyMinutesBySubject] =
        await Promise.all([
          scheduleManager.listStudySessions(studentId),
          scheduleManager.getDashboardExams(studentId),
          scheduleManager.getDueReminders(studentId),
          scheduleManager.getAverageDailyMinutesBySubject(studentId),
        ]);
    } catch (error) {
      connection = {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Study history could not be loaded from Hindsight.',
      };
    }
  }

  const averageDailyMinutes =
    averageDailyMinutesBySubject.size === 0
      ? 0
      : Math.round(
          Array.from(averageDailyMinutesBySubject.values()).reduce((sum, value) => sum + value, 0) /
            averageDailyMinutesBySubject.size,
        );

  return (
    <ScheduleWorkspace
      connectionOk={connection.ok}
      connectionMessage={connection.message}
      averageDailyMinutes={averageDailyMinutes}
      recentSessions={recentSessions.slice(0, 8)}
      upcomingExams={upcomingExams}
      dueReminders={dueReminders}
    />
  );
}
