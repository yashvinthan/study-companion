export type MemoryEntryType =
  | 'chat_event'
  | 'quiz_prompt'
  | 'quiz_record'
  | 'mistake_pattern'
  | 'study_session'
  | 'exam_event'
  | 'study_plan';

export type QuestionFormat = 'multiple_choice' | 'true_false' | 'short_answer';

export interface MetadataEnvelope {
  entry_type: MemoryEntryType;
  student_id: string;
  subject: string;
  topic: string;
  timestamp: string;
  session_id: string;
}

export interface QuizQuestion {
  questionId: string;
  subject: string;
  topic: string;
  format: QuestionFormat;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizPromptEntry extends MetadataEnvelope {
  entry_type: 'quiz_prompt';
  question: QuizQuestion;
  requestLabel: string;
}

export interface QuizRecord extends MetadataEnvelope {
  entry_type: 'quiz_record';
  questionId: string;
  format: QuestionFormat;
  questionText: string;
  options: string[];
  studentAnswer: string;
  normalizedStudentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  feedback: string;
}

export interface MistakePattern extends MetadataEnvelope {
  entry_type: 'mistake_pattern';
  accuracyRate: number;
  totalAttempts: number;
  errorCount: number;
  consecutiveCorrect: number;
  commonWrongAnswers: string[];
  weakArea: boolean;
  summary: string;
}

export interface StudySessionRecord extends MetadataEnvelope {
  entry_type: 'study_session';
  date: string;
  startTime: string;
  durationMinutes: number;
  confidenceScore: 1 | 2 | 3 | 4 | 5;
  subjects: string[];
  topics: string[];
}

export interface ExamEvent extends MetadataEnvelope {
  entry_type: 'exam_event';
  examDate: string;
  reminderLeadDays: number[];
  notes: string;
}

export type StudyPlanFocus =
  | 'revision_question'
  | 'practice'
  | 'exam_revision'
  | 'foundation';

export interface StudyPlanItem {
  date: string;
  subject: string;
  topic: string;
  minutes: number;
  focus: StudyPlanFocus;
  reason: string;
}

export interface StudyPlanRecord extends MetadataEnvelope {
  entry_type: 'study_plan';
  horizonDays: number;
  generatedAt: string;
  isGeneric: boolean;
  items: StudyPlanItem[];
  rationale: string[];
}

export interface ChatEvent extends MetadataEnvelope {
  entry_type: 'chat_event';
  role: 'user' | 'assistant';
  intent: string;
  content: string;
}

export type StoredEntry =
  | ChatEvent
  | QuizPromptEntry
  | QuizRecord
  | MistakePattern
  | StudySessionRecord
  | ExamEvent
  | StudyPlanRecord;

export interface WeakArea {
  subject: string;
  topic: string;
  accuracyRate: number;
  totalAttempts: number;
  errorCount: number;
  consecutiveCorrect: number;
  commonWrongAnswers: string[];
  weakArea: boolean;
}

export interface DashboardReminder {
  subject: string;
  examDate: string;
  daysAway: number;
  message: string;
}

export interface DashboardExam extends ExamEvent {
  daysAway: number;
  dueReminderLeadDays: number[];
}

export interface DashboardData {
  connection: {
    ok: boolean;
    message: string;
  };
  weakAreas: WeakArea[];
  recentSessions: StudySessionRecord[];
  upcomingExams: DashboardExam[];
  dueReminders: DashboardReminder[];
  latestPlan: StudyPlanRecord | null;
  summary: {
    quizCount: number;
    studySessions: number;
    examsTracked: number;
    averageDailyMinutes: number;
  };
  studyInsights: string[];
}

export interface MemorySearchResult {
  id: string;
  text: string;
  context: string | null;
  metadata: Record<string, string>;
  tags: string[];
  entry: StoredEntry | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthSession {
  expiresAt: string;
  user: AuthenticatedUser;
}

export interface RecentLiveEvent {
  id: number;
  eventType:
  | 'login_success'
  | 'logout'
  | 'chat_request'
  | 'plan_generated'
  | 'quiz_generated'
  | 'quiz_answered'
  | 'study_logged'
  | 'exam_tracked'
  | 'signup_success'
  | 'profile_updated'
  | 'password_updated';
  label: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ActivityFeedItem {
  id: string;
  source: 'hindsight' | 'postgres';
  type:
  | 'quiz_record'
  | 'study_session'
  | 'exam_event'
  | 'study_plan'
  | 'chat_event'
  | 'login_success'
  | 'logout'
  | 'chat_request'
  | 'plan_generated'
  | 'quiz_generated'
  | 'quiz_answered'
  | 'study_logged'
  | 'exam_tracked'
  | 'signup_success'
  | 'profile_updated'
  | 'password_updated';
  title: string;
  description: string;
  timestamp: string;
}

export interface ProfileSnapshot {
  id: string;
  email: string;
  fullName: string;
  authProvider: 'password' | 'google' | 'password_google';
  hasPassword: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  activeSessionCount: number;
  onboardingCompleted: boolean;
  studyCountry: string | null;
  studyBoard: string | null;
  studyGrade: string | null;
  quizRecordCount: number;
  studySessionCount: number;
  examCount: number;
  weakAreaCount: number;
  subjectsTracked: string[];
  connection: {
    ok: boolean;
    message: string;
  };
}
