import { mistakeTracker } from '@/lib/engines/Mistake_Tracker';
import { scheduleManager } from '@/lib/engines/Schedule_Manager';
import { memoryStore } from '@/lib/memory/MemoryStore';
import { saveLatestStudyPlan } from '@/lib/postgres';
import type { QuizRecord, StudyPlanItem, StudyPlanRecord, WeakArea } from '@/lib/types';
import { clamp, daysUntil, toIsoDate } from '@/lib/utils';

export class PlanGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanGenerationError';
  }
}

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
    const [quizRecords, examEvents, averageDailyMinutesBySubject] = await Promise.all([
      memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record').catch((error) => {
        console.warn('Plan generation: unable to load quiz records, using empty history.', error);
        return [] as QuizRecord[];
      }),
      scheduleManager.listUpcomingExams(studentId).catch((error) => {
        console.warn('Plan generation: unable to load upcoming exams, continuing without exam context.', error);
        return [];
      }),
      scheduleManager.getAverageDailyMinutesBySubject(studentId).catch((error) => {
        console.warn(
          'Plan generation: unable to load average daily minutes by subject, using default caps.',
          error,
        );
        return new Map<string, number>();
      }),
    ]);

    let weakAreas: WeakArea[] = [];
    if (quizRecords.length > 0) {
      try {
        weakAreas = (await mistakeTracker.computePatterns(studentId, quizRecords)).filter(
          (pattern) => pattern.weakArea,
        );
      } catch (error) {
        console.warn('Plan generation: unable to compute weak areas, continuing with available context.', error);
      }
    }

    const knownTopicsBySubject = new Map<string, string>();
    for (const exam of examEvents) {
      if (!knownTopicsBySubject.has(exam.subject) && exam.topic?.trim()) {
        knownTopicsBySubject.set(exam.subject, exam.topic);
      }
    }
    for (const weakArea of weakAreas) {
      if (!knownTopicsBySubject.has(weakArea.subject) && weakArea.topic.trim()) {
        knownTopicsBySubject.set(weakArea.subject, weakArea.topic);
      }
    }
    for (const quizRecord of quizRecords) {
      if (!knownTopicsBySubject.has(quizRecord.subject) && quizRecord.topic.trim()) {
        knownTopicsBySubject.set(quizRecord.subject, quizRecord.topic);
      }
    }

    const knownSubjects = new Set<string>([
      ...examEvents.map((exam) => exam.subject),
      ...weakAreas.map((area) => area.subject),
      ...quizRecords.map((record) => record.subject),
      ...Array.from(averageDailyMinutesBySubject.keys()),
    ]);

    if (knownSubjects.size === 0) {
      throw new PlanGenerationError(
        'Cannot generate a production plan yet because no real study subject data exists. Log at least one study session, add one exam, or complete one quiz first.',
      );
    }

    const onboardingTracks = Array.from(knownSubjects).map((subject) => ({
      subject,
      topic: knownTopicsBySubject.get(subject) ?? subject,
    }));

    let plan;
    if (quizRecords.length < 3) {
      plan = this.buildGenericPlan(studentId, safeHorizonDays, onboardingTracks);
    } else {
      plan = await this.buildAdaptivePlan(
        studentId,
        safeHorizonDays,
        weakAreas,
        examEvents,
        averageDailyMinutesBySubject,
      );
    }

    try {
      await saveLatestStudyPlan(studentId, plan);
    } catch (error) {
      console.warn('Plan generation: failed to save latest plan in PostgreSQL fallback.', error);
    }

    try {
      await memoryStore.retainEntry(plan);
    } catch (error) {
      console.warn('Plan generation: plan retain failed; returning generated plan without memory persistence.', error);
    }

    return plan;
  }

  private buildGenericPlan(
    studentId: string,
    horizonDays: number,
    onboardingTracks: Array<{ subject: string; topic: string }>,
  ) {
    const baseDate = new Date();
    const items: StudyPlanItem[] = [];
    const rationale = [
      'Fewer than three quiz records are available, so the plan stays in onboarding mode.',
      'Only tracked user subjects are scheduled; no synthetic subjects are introduced.',
    ];

    for (let dayIndex = 0; dayIndex < horizonDays; dayIndex += 1) {
      const track = onboardingTracks[dayIndex % onboardingTracks.length];
      const date = iso(addDays(baseDate, dayIndex));
      items.push(
        createPlanItem(
          date,
          track.subject,
          track.topic,
          45,
          'foundation',
          'Build baseline recall in a tracked subject before full personalization kicks in.',
        ),
      );
    }

    return this.wrapPlan(studentId, horizonDays, true, items, rationale);
  }

  private async buildAdaptivePlan(
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

    try {
      const insight = await memoryStore.reflect(
        studentId,
        `Analyze the student's study history, recent weaknesses, and upcoming exams over the next ${horizonDays} days. What actionable advice or strategic focus should they have? Keep the response under 2 sentences.`
      );
      if (insight?.text) {
        rationale.push(`Hindsight AI Insight: ${insight.text}`);
      }
    } catch (e) {
      console.error('Failed to reflect on student study profile:', e);
    }

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
