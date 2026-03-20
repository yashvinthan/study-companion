# Design Document: AI Study Companion

## Overview

The AI Study Companion is a standalone Next.js 14 (App Router) web application that uses
Hindsight as its persistent vector memory backend. Students interact via a chat interface and
dashboard to take quizzes, track mistakes, log study sessions, manage exam events, and receive
personalized study plans — all grounded in their actual history stored in Hindsight.

The application is organized into four core sub-components (Quiz_Engine, Mistake_Tracker,
Schedule_Manager, Plan_Generator) that share a single Hindsight Memory_Store. An optional
OpenClaw webhook adapter allows the same logic to be reached from messaging apps.

**Key technology choices:**
- Next.js 14 App Router with TypeScript and Tailwind CSS
- Hindsight (vectorize-io/hindsight) for persistent vector memory
- Groq (primary) or OpenAI for LLM inference
- Zustand for client-side session state
- Zod for runtime schema validation
- OpenClaw skill webhook (optional, feature-flagged via env var)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        study-companion/                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Web_UI (Next.js)                      │   │
│  │  ┌─────────────────┐   ┌──────────────────────────────┐  │   │
│  │  │  Chat_Interface  │   │         Dashboard             │  │   │
│  │  │  (chat page)     │   │  (weak areas, sessions,       │  │   │
│  │  │                  │   │   exam events)                │  │   │
│  │  └────────┬─────────┘   └──────────────┬───────────────┘  │   │
│  │           │  Zustand session store      │                  │   │
│  └───────────┼─────────────────────────────┼──────────────────┘   │
│              │ fetch /api/*                │ fetch /api/*         │
│  ┌───────────▼─────────────────────────────▼──────────────────┐   │
│  │                    API Routes (/api/*)                      │   │
│  │  /chat  /quiz  /mistakes  /schedule  /plan  /subjects       │   │
│  │  /onboarding  /webhook (optional OpenClaw)                  │   │
│  └──────┬──────────┬──────────────┬──────────────┬────────────┘   │
│         │          │              │              │                 │
│  ┌──────▼──┐ ┌─────▼──────┐ ┌────▼──────┐ ┌────▼──────────┐     │
│  │  Quiz   │ │  Mistake   │ │ Schedule  │ │    Plan       │     │
│  │ Engine  │ │  Tracker   │ │  Manager  │ │  Generator    │     │
│  └──────┬──┘ └─────┬──────┘ └────┬──────┘ └────┬──────────┘     │
│         └──────────┴──────────────┴──────────────┘               │
│                              │                                    │
│  ┌───────────────────────────▼────────────────────────────────┐   │
│  │              Hindsight Integration Layer                    │   │
│  │         (lib/hindsight.ts — retain / recall / update)       │   │
│  └───────────────────────────┬────────────────────────────────┘   │
│                              │ HTTPS                              │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Hindsight Cloud /   │
                    │  Self-hosted instance│
                    │  (Memory_Store)      │
                    └─────────────────────┘

Optional path:
  OpenClaw Gateway ──► POST /api/webhook ──► Intent Router ──► sub-components
```

### Request Flow (Chat Message)

```
Browser → POST /api/chat
  → parse intent (LLM)
  → route to sub-component
  → sub-component calls Hindsight (recall/retain)
  → sub-component calls LLM (Groq/OpenAI)
  → return structured response
  → Zustand store update
  → UI re-render
```

---

## Project Structure

```
study-companion/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (providers, fonts)
│   ├── page.tsx                  # Landing / redirect to /chat
│   ├── chat/
│   │   └── page.tsx              # Chat_Interface page
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard page
│   ├── onboarding/
│   │   └── page.tsx              # Onboarding flow page
│   └── api/
│       ├── chat/route.ts         # POST — main chat handler
│       ├── quiz/
│       │   ├── generate/route.ts # POST — generate quiz questions
│       │   ├── evaluate/route.ts # POST — evaluate a student answer
│       │   └── history/route.ts  # GET  — quiz history by subject
│       ├── mistakes/
│       │   ├── route.ts          # GET  — weak areas list
│       │   └── patterns/route.ts # GET  — mistake patterns by subject
│       ├── schedule/
│       │   ├── sessions/route.ts # GET/POST — study sessions
│       │   └── exams/route.ts    # GET/POST/PATCH — exam events
│       ├── plan/route.ts         # POST — generate study plan
│       ├── subjects/route.ts     # GET  — list all subjects/topics
│       ├── onboarding/route.ts   # POST — persist onboarding data
│       └── webhook/route.ts      # POST — OpenClaw skill endpoint (optional)
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx     # Main chat container
│   │   ├── MessageBubble.tsx     # Individual message rendering
│   │   ├── MessageInput.tsx      # Input bar with send button
│   │   └── QuizCard.tsx          # Inline quiz question component
│   ├── dashboard/
│   │   ├── WeakAreasList.tsx     # Ranked weak areas display
│   │   ├── StudySessionsLog.tsx  # Recent sessions grouped by subject
│   │   ├── ExamEventsList.tsx    # Upcoming exams sorted by date
│   │   └── ExamReminderBanner.tsx# Proactive reminder notification
│   ├── onboarding/
│   │   └── OnboardingWizard.tsx  # Multi-step onboarding form
│   └── ui/
│       ├── ErrorMessage.tsx      # Inline error display
│       └── LoadingSpinner.tsx    # Loading state indicator
├── lib/
│   ├── hindsight.ts              # Hindsight integration layer
│   ├── llm.ts                    # LLM client (Groq/OpenAI abstraction)
│   ├── quiz-engine.ts            # Quiz_Engine logic
│   ├── mistake-tracker.ts        # Mistake_Tracker logic
│   ├── schedule-manager.ts       # Schedule_Manager logic
│   ├── plan-generator.ts         # Plan_Generator logic
│   ├── intent-router.ts          # Chat intent parsing and routing
│   ├── write-ahead-buffer.ts     # Local WAL for interrupted sessions
│   └── config.ts                 # Env var validation and defaults
├── store/
│   └── session.ts                # Zustand session store
├── types/
│   └── index.ts                  # All shared TypeScript types
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Template for required env vars
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Components and Interfaces

### Sub-Component Interfaces

Each sub-component is a pure TypeScript module in `lib/` that accepts typed inputs and returns
typed outputs. They do not import from each other directly — they communicate through the API
route handlers which orchestrate calls.

```typescript
// lib/quiz-engine.ts
interface QuizEngineInput {
  studentId: string;
  subject: string;
  topic?: string;
  format?: QuestionFormat;   // 'mcq' | 'true_false' | 'short_answer'
  count?: number;            // 3–20, default 5
  weakAreasOnly?: boolean;
}

interface QuizEngineOutput {
  questions: QuizQuestion[];
  sessionId: string;
}

interface EvaluateInput {
  studentId: string;
  question: QuizQuestion;
  studentAnswer: string;
  sessionId: string;
}

interface EvaluateOutput {
  correct: boolean;
  explanation: string;
  record: QuizRecord;        // ready to persist
}
```

```typescript
// lib/mistake-tracker.ts
interface MistakeTrackerInput {
  studentId: string;
  subject?: string;
}

interface WeakAreasOutput {
  weakAreas: WeakArea[];     // sorted by error_count desc
  message?: string;          // set when no history exists
}
```

```typescript
// lib/schedule-manager.ts
interface LogSessionInput {
  studentId: string;
  date: string;              // ISO 8601
  startTime: string;         // HH:MM
  durationMinutes: number;   // must be > 0
  subjects: string[];
  topics: string[];
  confidenceScore: 1 | 2 | 3 | 4 | 5;
}

interface AddExamInput {
  studentId: string;
  subject: string;
  examDate: string;          // ISO 8601
  reminderLeadDays?: number[]; // default [7, 3, 1]
}

interface DueRemindersOutput {
  reminders: ExamReminder[];
}
```

```typescript
// lib/plan-generator.ts
interface PlanGeneratorInput {
  studentId: string;
  horizonDays: number;       // 1–90
}

interface PlanGeneratorOutput {
  plan: StudyPlan;
  isGeneric: boolean;        // true when < 3 Quiz_Records
}
```

### Component Hierarchy (Web_UI)

```
app/layout.tsx
  └── SessionProvider (Zustand)
      ├── app/chat/page.tsx
      │   └── ChatInterface
      │       ├── MessageBubble (×N)
      │       ├── QuizCard (inline, when quiz active)
      │       ├── MessageInput
      │       └── ErrorMessage (conditional)
      ├── app/dashboard/page.tsx
      │   ├── ExamReminderBanner (conditional)
      │   ├── WeakAreasList
      │   ├── StudySessionsLog
      │   └── ExamEventsList
      └── app/onboarding/page.tsx
          └── OnboardingWizard
              ├── Step 1: Name input
              ├── Step 2: Subjects selection
              └── Step 3: First Exam_Event
```

### State Management (Zustand)

```typescript
// store/session.ts
interface SessionState {
  studentId: string | null;
  studentName: string | null;
  currentSubject: string | null;
  currentTopic: string | null;
  activeQuiz: ActiveQuiz | null;   // current quiz state
  messages: ChatMessage[];
  pendingRecords: PendingRecord[]; // write-ahead buffer
  isOnboarded: boolean;

  // actions
  setStudent: (id: string, name: string) => void;
  setContext: (subject: string, topic?: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setActiveQuiz: (quiz: ActiveQuiz | null) => void;
  addPendingRecord: (record: PendingRecord) => void;
  clearPendingRecords: () => void;
}
```

Session state is persisted to `localStorage` via Zustand's `persist` middleware to support
the write-ahead buffer (Requirement 10.4).

---

## Data Models

All Hindsight memory entries share a common metadata envelope and a text content field used for
semantic search. The `content` field is a human-readable summary that Hindsight indexes for
vector search.

### Common Metadata Envelope

```typescript
interface MemoryMetadata {
  entry_type: 'quiz_record' | 'mistake_pattern' | 'study_session' | 'exam_event' | 'onboarding';
  student_id: string;
  subject: string;
  topic: string;
  timestamp: string;         // ISO 8601
  session_id: string;
}
```

### Quiz_Record

Persisted after every quiz question evaluation.

```typescript
interface QuizRecord {
  // Hindsight content (indexed for semantic search)
  content: string; // e.g. "Quiz: [question text] | Answer: [student answer] | Correct: [correct answer]"

  // Metadata envelope
  metadata: MemoryMetadata & {
    entry_type: 'quiz_record';
    question_text: string;
    student_answer: string;
    correct_answer: string;
    question_format: 'mcq' | 'true_false' | 'short_answer';
    is_correct: boolean;
  };
}
```

### Mistake_Pattern

Persisted/updated after every 5 incorrect answers for a subject/topic pair.

```typescript
interface MistakePattern {
  content: string; // e.g. "Mistake pattern for [subject]/[topic]: [total_errors] errors, common wrong answers: ..."

  metadata: MemoryMetadata & {
    entry_type: 'mistake_pattern';
    total_errors: number;
    common_wrong_answers: string[];  // top 5 most frequent
    is_weak_area: boolean;
    last_error_timestamp: string;
    consecutive_correct: number;     // for Weak_Area removal (req 4.4)
  };
}
```

### Study_Session_Record

Persisted when a student logs a study session.

```typescript
interface StudySessionRecord {
  content: string; // e.g. "Study session on [date]: [subjects] for [duration] minutes, confidence [score]/5"

  metadata: MemoryMetadata & {
    entry_type: 'study_session';
    date: string;              // ISO 8601 date
    start_time: string;        // HH:MM
    duration_minutes: number;  // > 0
    subjects: string[];
    topics: string[];
    confidence_score: 1 | 2 | 3 | 4 | 5;
  };
}
```

### Exam_Event

Persisted when a student adds an upcoming exam.

```typescript
interface ExamEvent {
  content: string; // e.g. "Exam: [subject] on [exam_date], reminders at [lead_days] days before"

  metadata: MemoryMetadata & {
    entry_type: 'exam_event';
    exam_date: string;           // ISO 8601 date
    reminder_lead_days: number[]; // e.g. [7, 3, 1]
    is_completed: boolean;
    custom_reminders: boolean;
  };
}
```

### TypeScript Union Type

```typescript
type MemoryEntry = QuizRecord | MistakePattern | StudySessionRecord | ExamEvent;

type QuestionFormat = 'mcq' | 'true_false' | 'short_answer';

interface QuizQuestion {
  id: string;
  format: QuestionFormat;
  text: string;
  options?: string[];          // MCQ only
  correctAnswer: string;
  subject: string;
  topic: string;
}

interface WeakArea {
  subject: string;
  topic: string;
  accuracyRate: number;        // 0.0–1.0
  errorCount: number;
}

interface StudyPlan {
  horizonDays: number;
  startDate: string;
  days: StudyPlanDay[];
}

interface StudyPlanDay {
  date: string;
  sessions: PlannedSession[];
}

interface PlannedSession {
  subject: string;
  topic: string;
  durationMinutes: number;
  type: 'revision' | 'new_material' | 'exam_prep';
}

interface ExamReminder {
  examEvent: ExamEvent;
  daysRemaining: number;
  accuracyRate: number;
  topWeakAreas: WeakArea[];
}
```

---

## Hindsight Integration Layer

All Hindsight calls are centralized in `lib/hindsight.ts`. No sub-component calls Hindsight
directly — they call typed wrapper functions that handle serialization, retry logic, and error
propagation.

### Core Wrapper Functions

```typescript
// lib/hindsight.ts

import { HindsightClient } from '@vectorize-io/hindsight';

const client = new HindsightClient({
  endpoint: process.env.HINDSIGHT_ENDPOINT!,
  apiKey: process.env.HINDSIGHT_API_KEY!,
});

// Persist any memory entry with retry (req 1.5)
export async function retainMemory(entry: MemoryEntry): Promise<void> {
  await withRetry(() => client.retain({
    content: entry.content,
    metadata: entry.metadata,
  }), { maxAttempts: 3, baseDelayMs: 500 });
}

// Semantic search with student_id scoping (req 9.2)
export async function recallMemory(params: {
  query: string;
  studentId: string;
  entryType?: MemoryMetadata['entry_type'];
  subject?: string;
  limit?: number;
}): Promise<MemoryEntry[]> {
  const filter: Record<string, string> = { student_id: params.studentId };
  if (params.entryType) filter.entry_type = params.entryType;
  if (params.subject) filter.subject = params.subject;

  const results = await client.recall({
    query: params.query,
    filter,
    limit: params.limit ?? 20,
  });
  return results.map(deserializeMemoryEntry);
}

// Update an existing memory entry by ID
export async function updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<void> {
  await withRetry(() => client.update(id, updates), { maxAttempts: 3, baseDelayMs: 500 });
}

// Exponential backoff retry helper
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; baseDelayMs: number }
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < opts.maxAttempts - 1) {
        await sleep(opts.baseDelayMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastError!;
}
```

### Startup Health Check

```typescript
// lib/hindsight.ts
export async function checkHindsightConnection(): Promise<void> {
  // Called in app startup / middleware
  // Throws HindsightConnectionError if unreachable (req 1.4)
  await client.ping();
}
```

This is called from a Next.js middleware or the root layout server component. If it throws,
the error is caught and rendered as a full-page error state in the Web_UI.

---

## API Route Design

All routes return `{ data, error }` shaped JSON. Error responses include a `code` and `message`.

### POST /api/chat

Main conversational endpoint. Parses intent and delegates to sub-components.

**Request:**
```json
{ "studentId": "string", "message": "string", "sessionId": "string" }
```

**Response:**
```json
{ "data": { "reply": "string", "action": "quiz|plan|mistakes|schedule|general", "payload": {} } }
```

Intent parsing uses a lightweight LLM call with a system prompt that classifies the message
into one of the action types and extracts entities (subject, topic, count, date).

### POST /api/quiz/generate

**Request:**
```json
{ "studentId": "string", "subject": "string", "topic": "string", "format": "mcq|true_false|short_answer", "count": 5, "weakAreasOnly": false }
```

**Response:**
```json
{ "data": { "questions": [QuizQuestion], "sessionId": "string" } }
```

### POST /api/quiz/evaluate

**Request:**
```json
{ "studentId": "string", "question": QuizQuestion, "studentAnswer": "string", "sessionId": "string" }
```

**Response:**
```json
{ "data": { "correct": true, "explanation": "string", "record": QuizRecord } }
```

### GET /api/quiz/history?studentId=&subject=

**Response:**
```json
{ "data": { "records": [QuizRecord], "accuracyRate": 0.75 } }
```

### GET /api/mistakes?studentId=&subject=

**Response:**
```json
{ "data": { "weakAreas": [WeakArea], "patterns": [MistakePattern], "message": "string|null" } }
```

### GET /api/schedule/sessions?studentId=&subject=

**Response:**
```json
{ "data": { "sessions": { "[subject]": [StudySessionRecord] } } }
```

### POST /api/schedule/sessions

**Request:**
```json
{ "studentId": "string", "date": "string", "startTime": "string", "durationMinutes": 60, "subjects": [], "topics": [], "confidenceScore": 4 }
```

### GET /api/schedule/exams?studentId=

**Response:**
```json
{ "data": { "exams": [ExamEvent], "dueReminders": [ExamReminder] } }
```

### POST /api/schedule/exams

**Request:**
```json
{ "studentId": "string", "subject": "string", "examDate": "string", "reminderLeadDays": [7, 3, 1] }
```

### POST /api/plan

**Request:**
```json
{ "studentId": "string", "horizonDays": 14 }
```

**Response:**
```json
{ "data": { "plan": StudyPlan, "isGeneric": false } }
```

### GET /api/subjects?studentId=

**Response:**
```json
{ "data": { "subjects": [{ "subject": "string", "topics": ["string"] }] } }
```

### POST /api/onboarding

**Request:**
```json
{ "name": "string", "subjects": ["string"], "firstExam": { "subject": "string", "examDate": "string" } }
```

**Response:**
```json
{ "data": { "studentId": "string" } }
```

### POST /api/webhook (Optional OpenClaw)

Enabled only when `OPENCLAW_ENABLED=true`. Conforms to OpenClaw skill protocol.

**Request (OpenClaw format):**
```json
{ "channel": "telegram", "userId": "string", "message": "string", "command": "/quiz" }
```

**Response:**
```json
{ "messages": ["string"] }
```

Responses longer than 4000 characters are split into multiple array elements.

---

## LLM Prompt Design Patterns

All LLM calls go through `lib/llm.ts` which abstracts Groq and OpenAI behind a common
`chat()` function. The active provider is selected by the `LLM_PROVIDER` env var.

### LLM Client Abstraction

```typescript
// lib/llm.ts
export async function chat(params: {
  systemPrompt: string;
  userMessage: string;
  responseFormat?: 'json' | 'text';
  temperature?: number;
}): Promise<string> { ... }
```

### Quiz Generation Prompt

```
System:
You are a quiz generator for a student study assistant.
Generate {count} quiz questions about "{subject}" / "{topic}".
Format: {format} (mcq | true_false | short_answer).
The student has previously answered these questions incorrectly: {recentMistakes}.
Do NOT repeat these questions: {recentQuestions}.
Return a JSON array of QuizQuestion objects with fields:
  id, format, text, options (MCQ only), correctAnswer, subject, topic.

User:
Generate {count} {format} questions about {subject} - {topic}.
```

**Design rationale:** Injecting `recentMistakes` into the prompt allows the LLM to construct
plausible distractors from actual wrong answers (Requirement 7.3). Injecting `recentQuestions`
prevents repetition (Requirement 3.7). Temperature is set to 0.7 for variety.

### Answer Evaluation Prompt

```
System:
You are a quiz evaluator. Given a question and a student's answer, determine if the answer
is correct. For short-answer questions, accept semantically equivalent answers.
Return JSON: { "correct": boolean, "explanation": "string" }

User:
Question: {question_text}
Correct answer: {correct_answer}
Student answer: {student_answer}
```

Temperature is set to 0.1 for deterministic evaluation.

### Study Plan Generation Prompt

```
System:
You are a personalized study planner. Generate a {horizonDays}-day study plan.
Student data:
- Weak areas (sorted by error count): {weakAreas}
- Average daily study duration per subject: {avgDurations}
- Upcoming exams: {examEvents}
- Accuracy rates per subject: {accuracyRates}

Rules:
1. Allocate more time to subjects with lower accuracy rates (proportional to 1/accuracy).
2. Never schedule more than 150% of the historical average per subject per day.
3. Include a dedicated revision session within 3 days before each exam.
4. Include at least one revision session per weak area per week.
5. Return a JSON StudyPlan object.

User:
Generate a {horizonDays}-day study plan starting {startDate}.
```

### Intent Classification Prompt

```
System:
Classify the student's message into one of these intents:
quiz, revision, mistakes, plan, log_session, add_exam, reminders, summary, general.
Extract entities: subject, topic, count, date, duration, confidence.
Return JSON: { "intent": string, "entities": {} }

User:
{studentMessage}
```

Temperature is set to 0.0 for deterministic routing.

---

## Environment Variable Schema

Defined in `.env.local` (gitignored). `.env.example` ships with the repo.

```bash
# Required — Hindsight
HINDSIGHT_ENDPOINT=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_hindsight_api_key

# Required — LLM
LLM_PROVIDER=groq                    # 'groq' | 'openai'
LLM_MODEL=llama3-8b-8192             # Groq model or OpenAI model name
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=                      # Required only if LLM_PROVIDER=openai

# Optional — Thresholds
WEAK_AREA_THRESHOLD=0.6              # Default: 0.6 (60%)

# Optional — OpenClaw
OPENCLAW_ENABLED=false               # 'true' to enable webhook
OPENCLAW_GATEWAY_URL=                # Required if OPENCLAW_ENABLED=true
OPENCLAW_SKILL_TOKEN=                # Required if OPENCLAW_ENABLED=true
```

Validation is performed at startup in `lib/config.ts` using Zod:

```typescript
// lib/config.ts
import { z } from 'zod';

const configSchema = z.object({
  HINDSIGHT_ENDPOINT: z.string().url(),
  HINDSIGHT_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.enum(['groq', 'openai']),
  LLM_MODEL: z.string().min(1),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  WEAK_AREA_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  OPENCLAW_ENABLED: z.coerce.boolean().default(false),
  OPENCLAW_GATEWAY_URL: z.string().url().optional(),
  OPENCLAW_SKILL_TOKEN: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.LLM_PROVIDER === 'groq' && !data.GROQ_API_KEY) {
    ctx.addIssue({ code: 'custom', message: 'GROQ_API_KEY is required when LLM_PROVIDER=groq' });
  }
  if (data.LLM_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
    ctx.addIssue({ code: 'custom', message: 'OPENAI_API_KEY is required when LLM_PROVIDER=openai' });
  }
  if (data.OPENCLAW_ENABLED && !data.OPENCLAW_GATEWAY_URL) {
    ctx.addIssue({ code: 'custom', message: 'OPENCLAW_GATEWAY_URL is required when OPENCLAW_ENABLED=true' });
  }
});

export const config = configSchema.parse(process.env);
```

If `configSchema.parse` throws, the error message names every missing variable (Requirement 11.2).

---

## Optional OpenClaw Webhook Design

When `OPENCLAW_ENABLED=true`, the `/api/webhook` route is activated and the application
registers itself with the OpenClaw Gateway on startup.

### Registration Flow

```typescript
// Called once at server startup (in Next.js instrumentation.ts)
async function registerOpenClawSkill() {
  if (!config.OPENCLAW_ENABLED) return;
  await fetch(`${config.OPENCLAW_GATEWAY_URL}/skills/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.OPENCLAW_SKILL_TOKEN}` },
    body: JSON.stringify({
      name: 'ai-study-companion',
      webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
      commands: ['/quiz', '/mistakes', '/plan', '/log-session', '/add-exam', '/reminders', '/summary'],
    }),
  });
}
```

### Webhook Handler

```typescript
// app/api/webhook/route.ts
export async function POST(req: Request) {
  if (!config.OPENCLAW_ENABLED) return new Response('Not Found', { status: 404 });

  const body = await req.json(); // { channel, userId, message, command }
  const studentId = deriveStudentId(body.userId, body.channel);

  // Route to sub-component via intent router (same as /api/chat)
  const result = await routeIntent({ studentId, message: body.message, command: body.command });

  // Split long responses (req 12.5)
  const messages = splitResponse(result.reply, 4000);
  return Response.json({ messages });
}

function splitResponse(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}
```

The `studentId` for OpenClaw users is derived as `openclaw:{channel}:{userId}` to namespace
them within the same Memory_Store while keeping history unified (Requirement 12.7). If a
student uses both the Web_UI and an OpenClaw channel with the same account, they can link
their IDs via the onboarding flow.

---

## Error Handling

### Error Taxonomy

| Error Class | Cause | Handling |
|---|---|---|
| `HindsightConnectionError` | Hindsight unreachable at startup | Full-page error in Web_UI, halt operations |
| `HindsightWriteError` | Write fails after 3 retries | Surface inline error in Chat_Interface |
| `LLMError` | LLM API call fails | Return fallback message, log error |
| `ValidationError` | Invalid input (e.g. duration=0) | Return 400 with descriptive message |
| `ConfigError` | Missing env var at startup | Log and refuse to start |
| `NotFoundError` | No records for subject/student | Return empty result with message |

### API Error Response Shape

```typescript
interface ApiError {
  error: {
    code: 'HINDSIGHT_CONNECTION' | 'HINDSIGHT_WRITE' | 'LLM_ERROR' | 'VALIDATION' | 'NOT_FOUND' | 'INTERNAL';
    message: string;
    details?: unknown;
  };
}
```

### Retry Strategy

Hindsight write retries use exponential backoff:
- Attempt 1: immediate
- Attempt 2: 500ms delay
- Attempt 3: 1000ms delay
- After 3 failures: throw `HindsightWriteError`

### Write-Ahead Buffer (Session Recovery)

Pending records are stored in Zustand's persisted store (localStorage). On session start,
`lib/write-ahead-buffer.ts` checks for pending records and flushes them to Hindsight before
priming the session context (Requirement 10.4).

```typescript
// lib/write-ahead-buffer.ts
export async function flushPendingRecords(pendingRecords: PendingRecord[]): Promise<void> {
  for (const record of pendingRecords) {
    await retainMemory(record.entry);
  }
}
```

### Web_UI Error Display

All API calls from the client use a `useFetch` hook that catches errors and sets an `error`
state. The `ErrorMessage` component renders inline in the Chat_Interface without unmounting
the page (Requirement 2.7).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The following properties are derived from the acceptance criteria. Each is universally quantified
and intended to be implemented as a property-based test.

**Property Reflection notes:**
- 1.3 (semantic retrieval) is subsumed by 1.7 (round-trip) — covered by Property 1.
- 8.2 and 5.5 (reminder filtering) are consolidated into Property 10.
- 3.1, 5.1, 1.6 (structural completeness for different entry types) are consolidated into Property 2.

---

### Property 1: Memory Round-Trip Preserves Key Fields

*For any* valid memory entry (Quiz_Record, Mistake_Pattern, Study_Session_Record, or Exam_Event)
written to Memory_Store, retrieving it via semantic search should return an entry whose
`subject`, `topic`, and `entry_type` fields are identical to those written.

**Validates: Requirements 1.7, 1.3**

---

### Property 2: Memory Entry Structural Completeness

*For any* memory entry written to Memory_Store, the persisted metadata envelope must contain
all six required fields: `entry_type`, `student_id`, `subject`, `topic`, `timestamp`, and
`session_id`, with non-empty values.

**Validates: Requirements 1.6, 3.1, 5.1**

---

### Property 3: Write Retry Exhaustion

*For any* Hindsight write operation that fails on every attempt, the retry wrapper should
invoke the underlying write function exactly 3 times before propagating the error.

**Validates: Requirements 1.5**

---

### Property 4: Exam Events Sorted Ascending

*For any* set of Exam_Events retrieved from Memory_Store, the returned list should be ordered
by `exam_date` ascending (earliest exam first).

**Validates: Requirements 2.2, 8.4**

---

### Property 5: Quiz History Sorted Reverse Chronologically

*For any* set of Quiz_Records for a given subject, the returned list should be ordered by
`timestamp` descending (most recent first).

**Validates: Requirements 3.2**

---

### Property 6: Accuracy Rate Computation

*For any* set of Quiz_Records for a subject/topic pair, the computed `Accuracy_Rate` should
equal `correct_count / total_count`, where `correct_count` is the number of records with
`is_correct = true`.

**Validates: Requirements 3.3, 3.4**

---

### Property 7: All Question Formats Are Supported

*For any* question format in `['mcq', 'true_false', 'short_answer']`, the Quiz_Engine should
be able to generate at least one valid question of that format and evaluate a student answer
against it.

**Validates: Requirements 3.6**

---

### Property 8: No Question Repetition Within Last 10

*For any* quiz generation request for a subject where the student has at least 10 prior
Quiz_Records, none of the generated question texts should appear in the student's last 10
Quiz_Records for that subject.

**Validates: Requirements 3.7**

---

### Property 9: Incorrect Answer Increments Error Count

*For any* incorrect quiz answer submitted for a subject/topic, the Mistake_Pattern entry for
that pair should have its `total_errors` incremented by 1 and the `student_answer` appended
to `common_wrong_answers`.

**Validates: Requirements 4.1**

---

### Property 10: Weak Area Classification and Removal

*For any* subject/topic pair, it should be classified as a Weak_Area if and only if its
`Accuracy_Rate` is strictly below `WEAK_AREA_THRESHOLD`. Furthermore, a previously classified
Weak_Area should have its classification removed after 5 consecutive correct Quiz_Records
raise the Accuracy_Rate above the threshold.

**Validates: Requirements 4.2, 4.4**

---

### Property 11: Weak Areas Ranked by Error Count

*For any* set of Mistake_Pattern entries, the list returned by `getWeakAreas` should be
sorted by `total_errors` in descending order.

**Validates: Requirements 4.3**

---

### Property 12: Mistake Pattern Persisted Every 5 Errors

*For any* sequence of N incorrect answers for a subject/topic, a Mistake_Pattern summary
should be persisted to Memory_Store exactly `floor(N / 5)` times.

**Validates: Requirements 4.5**

---

### Property 13: Study Session Record Structural Completeness

*For any* valid study session log call, the persisted Study_Session_Record should contain
all required fields with `duration_minutes > 0`.

**Validates: Requirements 5.1**

---

### Property 14: Zero-Duration Session Rejected

*For any* study session log attempt with `durationMinutes <= 0`, the Schedule_Manager should
return a validation error and not persist any record to Memory_Store.

**Validates: Requirements 5.6**

---

### Property 15: Study History Grouped and Sorted

*For any* set of Study_Session_Records, the result of `getStudyHistory` should group records
by subject and within each group sort by `date` descending.

**Validates: Requirements 5.2**

---

### Property 16: Average Daily Duration Computation

*For any* set of Study_Session_Records within the past 30 days for a subject, the computed
average daily duration should equal `total_minutes / count_of_distinct_days_with_sessions`.

**Validates: Requirements 5.3**

---

### Property 17: Due Reminder Filtering

*For any* set of Exam_Events, the reminder check function should return exactly those events
whose `reminder_lead_days` contains a value equal to the number of days until the exam date
from the current date, and should exclude events whose `is_completed = true`.

**Validates: Requirements 5.5, 8.2, 8.5**

---

### Property 18: Future Exam Subjects Included in Plan

*For any* set of Exam_Events with `exam_date` in the future, all their subjects should appear
in the study plan generation input.

**Validates: Requirements 5.7**

---

### Property 19: Time Allocation Inversely Proportional to Accuracy

*For any* two subjects A and B where `accuracyRate(A) < accuracyRate(B)`, the generated
study plan should allocate more total minutes per week to subject A than to subject B.

**Validates: Requirements 6.2**

---

### Property 20: Daily Cap at 150% of Historical Average

*For any* generated study plan, no subject's scheduled daily duration should exceed
`1.5 * historicalAverageDailyMinutes` for that subject.

**Validates: Requirements 6.3**

---

### Property 21: Plan Horizon Bounds

*For any* plan generation request, the generated plan should cover exactly `horizonDays` days.
Requests with `horizonDays < 1` or `horizonDays > 90` should be rejected with a validation
error.

**Validates: Requirements 6.4**

---

### Property 22: Exam Prep Session Within 3 Days Before Exam

*For any* Exam_Event within the plan horizon, the generated study plan should contain at
least one session of type `exam_prep` for that subject within the 3 calendar days immediately
preceding the exam date.

**Validates: Requirements 6.5**

---

### Property 23: Weak Area Revision Frequency

*For any* generated study plan with `horizonDays >= 7`, each Weak_Area should appear in at
least one `revision` session per 7-day window.

**Validates: Requirements 6.6**

---

### Property 24: Revision Questions Target Weak Areas

*For any* revision session request where the student has at least one Weak_Area, all generated
Revision_Questions should have a `topic` that appears in the student's Weak_Areas list.

**Validates: Requirements 7.1**

---

### Property 25: Revision Session Format Diversity

*For any* revision session generating 3 or more questions, the set of `format` values across
all questions should contain at least 2 distinct formats.

**Validates: Requirements 7.2**

---

### Property 26: Revision Question Count Bounds

*For any* revision session request with a valid count (3–20), the session should contain
exactly that many questions. Requests outside this range should be clamped to [3, 20].

**Validates: Requirements 7.4**

---

### Property 27: Revision Session Persists All Records

*For any* completed revision session with N questions, exactly N Quiz_Records should be
persisted to Memory_Store.

**Validates: Requirements 7.5**

---

### Property 28: Reminder Display Contains Required Fields

*For any* exam reminder displayed in the Web_UI, the rendered output should contain the exam
subject, days remaining, the student's current Accuracy_Rate for that subject, and the top 3
Weak_Areas for that subject.

**Validates: Requirements 8.3**

---

### Property 29: Student ID Scoping Prevents Cross-Student Leakage

*For any* two students with overlapping subjects, a memory recall for student A should never
return records whose `student_id` equals student B's ID.

**Validates: Requirements 9.2**

---

### Property 30: Subject/Topic Listing Completeness

*For any* set of Quiz_Records in Memory_Store for a student, the result of `listSubjects`
should contain exactly the set of unique `(subject, topic)` pairs present in those records —
no more, no less.

**Validates: Requirements 9.3**

---

### Property 31: Topic Rename Consistency

*For any* topic rename operation from `oldName` to `newName`, all Memory_Store entries for
that student and subject that previously had `topic = oldName` should have `topic = newName`
after the operation, and no entries should retain the old name.

**Validates: Requirements 9.4**

---

### Property 32: Session Context Invariant

*For any* active session, the session context object should always contain non-null values for
`currentSubject` and `currentTopic` once they have been set, and should reflect the most
recently set values.

**Validates: Requirements 10.1**

---

### Property 33: Session Flush Completeness

*For any* session end with N pending records in the write-ahead buffer, all N records should
be persisted to Memory_Store before the session terminates.

**Validates: Requirements 10.2**

---

### Property 34: Session Priming Retrieves Correct Records

*For any* new session start, the primed context should contain the student's most recent
Study_Session_Record and exactly the last 5 Quiz_Records (or fewer if fewer exist).

**Validates: Requirements 10.3**

---

### Property 35: Write-Ahead Buffer Recovery

*For any* interrupted session with M pending records in the write-ahead buffer, the next
session start should recover and persist all M records to Memory_Store before proceeding.

**Validates: Requirements 10.4**

---

### Property 36: Missing Required Config Fails Startup

*For any* subset of required environment variables that is missing, the config validation
should fail with an error message that names each missing variable.

**Validates: Requirements 11.2**

---

### Property 37: OpenClaw Command Routing

*For any* command in `['/quiz', '/mistakes', '/plan', '/log-session', '/add-exam', '/reminders', '/summary']`,
the intent router should map it to the correct sub-component handler without error.

**Validates: Requirements 12.3, 12.4**

---

### Property 38: Long Response Splitting

*For any* response string of length L > 4000, the `splitResponse` function should produce
`ceil(L / 4000)` chunks where each chunk has length <= 4000 and the concatenation of all
chunks equals the original string.

**Validates: Requirements 12.5**

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests catch concrete bugs with specific examples and edge cases.
- Property tests verify universal correctness across randomized inputs.

### Property-Based Testing

**Library:** [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native, no extra
runtime dependencies).

**Configuration:** Each property test runs a minimum of 100 iterations (`numRuns: 100`).

Each property test must be tagged with a comment referencing the design property:

```typescript
// Feature: ai-study-companion, Property 6: Accuracy Rate Computation
it('accuracy rate equals correct_count / total_count', () => {
  fc.assert(fc.property(
    fc.array(fc.record({ is_correct: fc.boolean() }), { minLength: 1 }),
    (records) => {
      const rate = computeAccuracyRate(records);
      const expected = records.filter(r => r.is_correct).length / records.length;
      return Math.abs(rate - expected) < 1e-9;
    }
  ), { numRuns: 100 });
});
```

**Property tests to implement** (one test per property, referencing the property number):

| Property | Test Focus | Pattern |
|---|---|---|
| 1 | Memory round-trip | Round-trip |
| 2 | Metadata envelope completeness | Invariant |
| 3 | Retry count = 3 | Error condition |
| 4 | Exam events sorted ascending | Invariant |
| 5 | Quiz history sorted descending | Invariant |
| 6 | Accuracy rate formula | Invariant |
| 7 | All formats supported | Coverage |
| 8 | No question repetition | Metamorphic |
| 9 | Error count increment | Invariant |
| 10 | Weak area classification/removal | State transition |
| 11 | Weak areas sorted by error count | Invariant |
| 12 | Pattern persisted every 5 errors | Invariant |
| 14 | Zero-duration rejected | Error condition |
| 15 | History grouped and sorted | Invariant |
| 16 | Average duration formula | Invariant |
| 17 | Due reminder filtering | Invariant |
| 18 | Future exam subjects in plan | Coverage |
| 19 | Time allocation inversely proportional | Metamorphic |
| 20 | Daily cap at 150% | Invariant |
| 21 | Plan horizon bounds | Range validation |
| 22 | Exam prep within 3 days | Invariant |
| 23 | Weak area revision frequency | Invariant |
| 24 | Revision targets weak areas | Invariant |
| 25 | Format diversity in revision | Invariant |
| 26 | Question count bounds | Range validation |
| 27 | Revision persists all records | Invariant |
| 28 | Reminder display fields | Invariant |
| 29 | Student ID scoping | Invariant |
| 30 | Subject listing completeness | Round-trip |
| 31 | Topic rename consistency | Invariant |
| 32 | Session context invariant | Invariant |
| 33 | Session flush completeness | Invariant |
| 34 | Session priming record count | Invariant |
| 35 | WAL recovery | Round-trip |
| 36 | Missing config fails startup | Error condition |
| 37 | OpenClaw command routing | Coverage |
| 38 | Long response splitting | Invariant |

### Unit Tests

Unit tests focus on specific examples, edge cases, and integration points. Avoid duplicating
what property tests already cover.

**Key unit test scenarios:**
- Onboarding flow: new student with name, subjects, first exam persisted correctly
- Empty state: no Quiz_Records → Mistake_Tracker returns empty list with message (Req 4.6)
- Empty state: no Weak_Areas → Quiz_Engine generates general questions (Req 7.6)
- Fewer than 3 Quiz_Records → Plan_Generator returns generic onboarding plan (Req 6.7)
- Hindsight connection failure → Web_UI renders error state (Req 1.4)
- Missing env var → config validation error names the variable (Req 11.2)
- OpenClaw disabled → `/api/webhook` returns 404 (Req 12.6)
- Custom reminder lead times override defaults (Req 8.6)
- Subject with no records returns empty result with message (Req 9.5)
- `WEAK_AREA_THRESHOLD` defaults to 0.6 when not set (Req 11.4)

### Test File Organization

```
study-companion/
├── __tests__/
│   ├── unit/
│   │   ├── quiz-engine.test.ts
│   │   ├── mistake-tracker.test.ts
│   │   ├── schedule-manager.test.ts
│   │   ├── plan-generator.test.ts
│   │   ├── hindsight.test.ts
│   │   ├── config.test.ts
│   │   └── webhook.test.ts
│   └── property/
│       ├── memory.property.test.ts      # Properties 1–3
│       ├── quiz-engine.property.test.ts # Properties 4–8, 24–27
│       ├── mistake-tracker.property.test.ts # Properties 9–12
│       ├── schedule-manager.property.test.ts # Properties 13–18
│       ├── plan-generator.property.test.ts # Properties 19–23
│       ├── session.property.test.ts     # Properties 32–35
│       ├── config.property.test.ts      # Property 36
│       └── webhook.property.test.ts     # Properties 37–38
```

**Test runner:** Jest with `ts-jest`. Run with:
```bash
npx jest --testPathPattern="__tests__" --passWithNoTests
```
