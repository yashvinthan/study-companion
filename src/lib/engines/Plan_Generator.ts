import { mistakeTracker } from '@/lib/engines/Mistake_Tracker';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { memoryStore } from '@/lib/memory/MemoryStore';
import type { QuizRecord, StudyPlanItem, StudyPlanRecord, WeakArea } from '@/lib/types';
import { clamp, daysUntil, toIsoDate } from '@/lib/utils';

function addDays(date: Date, offset: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function iso(date: Date) {
  return toIsoDate(date);
}

function createPlanItem(
  date: string,
  subject: string,
  topic: string,
  minutes: number,
  focus: StudyPlanItem['focus'],
  reason: string,
): StudyPlanItem {
  return {
    date,
    subject,
    topic,
    minutes,
    focus,
    reason,
  };
}

export class PlanGenerator {
  async generate(studentId: string, horizonDays: number) {
    const safeHorizonDays = clamp(Math.round(horizonDays), 1, 90);
    const quizRecords = await memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record');
    const weakAreaResult = await mistakeTracker.getWeakAreas(studentId);
    const weakAreas = weakAreaResult.weakAreas;
    const examEvents = await scheduleManager.listUpcomingExams(studentId);
    const averageDailyMinutesBySubject =
      await scheduleManager.getAverageDailyMinutesBySubject(studentId);

    const plan =
      quizRecords.length < 3
        ? this.buildGenericPlan(studentId, safeHorizonDays, examEvents.map((exam) => exam.subject))
        : this.buildAdaptivePlan(
            studentId,
            safeHorizonDays,
            weakAreas,
            examEvents,
            averageDailyMinutesBySubject,
          );

    await memoryStore.retainEntry(plan);
    return plan;
  }

  private buildGenericPlan(studentId: string, horizonDays: number, examSubjects: string[]) {
    const baseDate = new Date();
    const fallbackSubjects = examSubjects.length ? examSubjects : ['Mathematics', 'Physics', 'Biology'];
    const items: StudyPlanItem[] = [];
    const rationale = [
      'Fewer than three quiz records are available, so the plan is in onboarding mode.',
      'Sessions stay moderate while the app learns the student cadence.',
    ];

    for (let dayIndex = 0; dayIndex < horizonDays; dayIndex += 1) {
      const subject = fallbackSubjects[dayIndex % fallbackSubjects.length];
      const date = iso(addDays(baseDate, dayIndex));
      items.push(
        createPlanItem(
          date,
          subject,
          'Foundations',
          45,
          'foundation',
          'Build baseline recall before personalization kicks in.',
        ),
      );
    }

    return this.wrapPlan(studentId, horizonDays, true, items, rationale);
  }

  private buildAdaptivePlan(
    studentId: string,
    horizonDays: number,
    weakAreas: WeakArea[],
    exams: Awaited<ReturnType<typeof scheduleManager.listUpcomingExams>>,
    averageDailyMinutesBySubject: Map<string, number>,
  ) {
    const baseDate = new Date();
    const items: StudyPlanItem[] = [];
    const rationale: string[] = [];
    const allocatedMinutes = new Map<string, number>();
    const weakAreasByWeek = new Map<string, boolean>();

    const prioritySubjects = new Map<
      string,
      {
        topic: string;
        weight: number;
        cap: number;
      }
    >();

    for (const weakArea of weakAreas) {
      const cap = Math.max(30, Math.round((averageDailyMinutesBySubject.get(weakArea.subject) ?? 45) * 1.5));
      const weight = 101 - weakArea.accuracyRate + weakArea.errorCount * 5;

      prioritySubjects.set(weakArea.subject, {
        topic: weakArea.topic,
        weight,
        cap,
      });
    }

    for (const exam of exams) {
      if (!prioritySubjects.has(exam.subject)) {
        const cap = Math.max(30, Math.round((averageDailyMinutesBySubject.get(exam.subject) ?? 45) * 1.5));
        prioritySubjects.set(exam.subject, {
          topic: exam.topic,
          weight: 80,
          cap,
        });
      }
    }

    if (prioritySubjects.size === 0) {
      prioritySubjects.set('General Revision', {
        topic: 'Core topics',
        weight: 60,
        cap: 45,
      });
    }

    for (let dayIndex = 0; dayIndex < horizonDays; dayIndex += 1) {
      const currentDate = addDays(baseDate, dayIndex);
      const date = iso(currentDate);
      const weekKey = `${currentDate.getFullYear()}-${Math.floor(dayIndex / 7)}`;

      for (const weakArea of weakAreas) {
        const revisionKey = `${weekKey}:${weakArea.subject}:${weakArea.topic}`;
        if (weakAreasByWeek.has(revisionKey)) {
          continue;
        }

        const currentMinutes = allocatedMinutes.get(`${date}:${weakArea.subject}`) ?? 0;
        const cap = Math.max(30, Math.round((averageDailyMinutesBySubject.get(weakArea.subject) ?? 45) * 1.5));
        const plannedMinutes = Math.min(30, Math.max(20, cap - currentMinutes));

        if (plannedMinutes <= 0) {
          continue;
        }

        items.push(
          createPlanItem(
            date,
            weakArea.subject,
            weakArea.topic,
            plannedMinutes,
            'revision_question',
            'Weekly revision block to directly attack a weak area.',
          ),
        );
        allocatedMinutes.set(`${date}:${weakArea.subject}`, currentMinutes + plannedMinutes);
        weakAreasByWeek.set(revisionKey, true);
      }

      const examCandidates = exams.filter((exam) => {
        const daysAway = daysUntil(exam.examDate, currentDate);
        return daysAway >= 0 && daysAway <= 3;
      });

      for (const exam of examCandidates) {
        const key = `${date}:${exam.subject}`;
        const currentMinutes = allocatedMinutes.get(key) ?? 0;
        const cap = Math.max(30, Math.round((averageDailyMinutesBySubject.get(exam.subject) ?? 45) * 1.5));
        const plannedMinutes = Math.min(35, Math.max(20, cap - currentMinutes));

        if (plannedMinutes <= 0) {
          continue;
        }

        items.push(
          createPlanItem(
            date,
            exam.subject,
            exam.topic,
            plannedMinutes,
            'exam_revision',
            'Exam is within three days, so the session shifts to high-yield revision.',
          ),
        );
        allocatedMinutes.set(key, currentMinutes + plannedMinutes);
      }

      const rankedSubjects = Array.from(prioritySubjects.entries()).toSorted(
        (left, right) => right[1].weight - left[1].weight,
      );

      const focusSubject = rankedSubjects[dayIndex % rankedSubjects.length];
      const [subject, detail] = focusSubject;
      const key = `${date}:${subject}`;
      const currentMinutes = allocatedMinutes.get(key) ?? 0;
      const plannedMinutes = Math.min(45, Math.max(20, detail.cap - currentMinutes));

      if (plannedMinutes > 0) {
        items.push(
          createPlanItem(
            date,
            subject,
            detail.topic,
            plannedMinutes,
            'practice',
            'Primary practice session allocated by weak-area weight and recent study limits.',
          ),
        );
        allocatedMinutes.set(key, currentMinutes + plannedMinutes);
      }
    }

    if (weakAreas.length > 0) {
      rationale.push('Lower-accuracy subjects receive more minutes through inverse-accuracy weighting.');
    }

    if (exams.length > 0) {
      rationale.push('Exam subjects are automatically scheduled inside the final three-day revision window.');
    }

    rationale.push('Daily minutes for each subject are capped at 150% of the recent average study duration.');

    return this.wrapPlan(studentId, horizonDays, false, items, rationale);
  }

  private wrapPlan(
    studentId: string,
    horizonDays: number,
    isGeneric: boolean,
    items: StudyPlanItem[],
    rationale: string[],
  ): StudyPlanRecord {
    return {
      entry_type: 'study_plan',
      student_id: studentId,
      subject: 'Study Plan',
      topic: `${horizonDays}-day horizon`,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      horizonDays,
      generatedAt: new Date().toISOString(),
      isGeneric,
      items: items.toSorted((left, right) => {
        return new Date(left.date).getTime() - new Date(right.date).getTime();
      }),
      rationale,
    };
  }

  formatPlan(plan: StudyPlanRecord) {
    const lines = [
      `${plan.isGeneric ? 'Onboarding' : 'Adaptive'} study plan for ${plan.horizonDays} day${plan.horizonDays === 1 ? '' : 's'}:`,
      '',
      ...plan.items.map((item) => {
        return `- ${item.date}: ${item.subject} / ${item.topic} for ${item.minutes} min (${item.focus.replaceAll('_', ' ')})`;
      }),
    ];

    if (plan.rationale.length > 0) {
      lines.push('', 'Why this plan:', ...plan.rationale.map((reason) => `- ${reason}`));
    }

    return lines.join('\n');
  }
}

export const planGenerator = new PlanGenerator();
