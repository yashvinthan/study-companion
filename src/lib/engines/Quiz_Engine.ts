import { generateObject } from 'ai';
import { z } from 'zod';
import { getGroqModel } from '@/lib/llm';
import { memoryStore } from '@/lib/memory/MemoryStore';
import type { QuizPromptEntry, QuizQuestion, QuizRecord } from '@/lib/types';
import { normalizeAnswer } from '@/lib/utils';

const QUIZ_LLM_TIMEOUT_MS = 20_000;
const QUIZ_HISTORY_TIMEOUT_MS = 2_500;

const quizQuestionSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().min(1),
  format: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
});

const shortAnswerEvaluationSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().min(1),
});

const GROQ_PROVIDER_OPTIONS = {
  openai: {
    reasoning_effort: 'low',
    service_tier: 'on_demand',
  },
} as const;

function resolveMultipleChoiceAnswer(options: string[], rawAnswer: string) {
  const trimmed = rawAnswer.trim();
  const letterMatch = trimmed.match(/^([A-D])(?:[).:\s-]|$)/i);

  if (!letterMatch) {
    return trimmed;
  }

  const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
  return options[index] ?? trimmed;
}

function normalizeQuestionAnswer(question: QuizQuestion, rawAnswer: string) {
  if (question.format === 'multiple_choice') {
    return resolveMultipleChoiceAnswer(question.options, rawAnswer);
  }

  if (question.format === 'true_false') {
    const value = normalizeAnswer(rawAnswer);
    if (['t', 'true', 'yes'].includes(value)) {
      return 'true';
    }
    if (['f', 'false', 'no'].includes(value)) {
      return 'false';
    }
  }

  return rawAnswer.trim();
}

export class QuizEngine {
  private readonly volatilePrompts = new Map<string, QuizPromptEntry>();

  async generateQuiz(studentId: string, subject: string, topic?: string) {
    let recentRecords: QuizRecord[] = [];
    try {
      const historyPromise = memoryStore
        .listEntries<QuizRecord>(studentId, 'quiz_record')
        .catch((error) => {
          console.warn('Quiz generation: unable to load recent records, continuing without history.', error);
          return [] as QuizRecord[];
        });
      recentRecords = await Promise.race([
        historyPromise,
        new Promise<QuizRecord[]>((resolve) => {
          setTimeout(() => {
            console.warn(
              `Quiz generation: quiz history lookup exceeded ${QUIZ_HISTORY_TIMEOUT_MS}ms; continuing without history.`,
            );
            resolve([]);
          }, QUIZ_HISTORY_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      console.warn('Quiz generation: unable to load recent records, continuing without history.', error);
    }
    const matchingRecords = recentRecords
      .filter((record) => record.subject.toLowerCase() === subject.toLowerCase())
      .slice(0, 10);

    const repeatAvoidance = matchingRecords
      .map((record) => `- ${record.questionText}`)
      .join('\n');

    let object: z.infer<typeof quizQuestionSchema>;
    try {
      const result = await generateObject({
        model: getGroqModel(),
        abortSignal: AbortSignal.timeout(QUIZ_LLM_TIMEOUT_MS),
        maxOutputTokens: 600,
        providerOptions: GROQ_PROVIDER_OPTIONS,
        schema: quizQuestionSchema,
        system:
          'You generate crisp revision questions for students. Return one question only. Make it challenging but answerable without external context. Use multiple choice, true/false, or short answer.',
        prompt: [
          `Subject: ${subject}`,
          `Preferred topic: ${topic || 'Choose the highest-value topic within the subject.'}`,
          'Do not repeat or closely paraphrase any of the recent questions below.',
          repeatAvoidance || '- No recent questions on record.',
          'For multiple choice, return exactly four options and set correctAnswer to the full correct option text.',
          'For true_false, options should be ["True", "False"] and correctAnswer should be either "True" or "False".',
        ].join('\n'),
      });
      object = result.object;
    } catch (error) {
      console.warn('Quiz generation failed; falling back to deterministic question.', error);
      object = {
        subject,
        topic: topic || 'Foundations',
        format: 'multiple_choice',
        prompt: `In ${subject}, which statement best explains "${topic || 'core concept'}"?`,
        options: [
          'It is a measurable physical quantity with both magnitude and direction.',
          'It is always constant and independent of reference frame.',
          'It can never be represented mathematically.',
          'It has no relation to real-world motion.',
        ],
        correctAnswer:
          'It is a measurable physical quantity with both magnitude and direction.',
        explanation:
          'Core concepts are best defined with precise measurable properties and context, not absolute assumptions.',
      };
    }

    const question: QuizQuestion = {
      questionId: crypto.randomUUID(),
      subject: object.subject,
      topic: object.topic,
      format: object.format,
      prompt: object.prompt,
      options:
        object.format === 'short_answer'
          ? []
          : object.format === 'true_false'
            ? ['True', 'False']
            : object.options.slice(0, 4),
      correctAnswer: object.correctAnswer,
      explanation: object.explanation,
    };

    const promptEntry: QuizPromptEntry = {
      entry_type: 'quiz_prompt',
      student_id: studentId,
      subject: question.subject,
      topic: question.topic,
      timestamp: new Date().toISOString(),
      session_id: crypto.randomUUID(),
      question,
      requestLabel: `${question.subject} / ${question.topic}`,
    };

    this.volatilePrompts.set(studentId, promptEntry);
    try {
      await memoryStore.retainEntry(promptEntry);
    } catch (error) {
      console.warn('Quiz prompt retain failed; keeping prompt in volatile memory.', error);
    }
    return promptEntry;
  }

  async getPendingPrompt(studentId: string) {
    const volatilePrompt = this.volatilePrompts.get(studentId);
    let prompts: QuizPromptEntry[] = [];
    let records: QuizRecord[] = [];

    try {
      prompts = await memoryStore.listEntries<QuizPromptEntry>(studentId, 'quiz_prompt');
      records = await memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record');
    } catch (error) {
      console.warn('Unable to load quiz history from memory; using volatile prompt only.', error);
      return volatilePrompt ?? null;
    }

    const answeredSessionIds = new Set(records.map((record) => record.session_id));

    if (volatilePrompt && !answeredSessionIds.has(volatilePrompt.session_id)) {
      return volatilePrompt;
    }

    return prompts.find((prompt) => !answeredSessionIds.has(prompt.session_id)) ?? null;
  }

  async evaluateLatestAnswer(studentId: string, answer: string) {
    const prompt = await this.getPendingPrompt(studentId);

    if (!prompt) {
      throw new Error('No active quiz question. Ask for a quiz first (for example: "Quiz me on Physics kinematics").');
    }

    const normalizedStudentAnswer = normalizeQuestionAnswer(prompt.question, answer);
    let isCorrect = false;
    let feedback = '';

    if (prompt.question.format === 'short_answer') {
      const { object } = await generateObject({
        model: getGroqModel(),
        abortSignal: AbortSignal.timeout(QUIZ_LLM_TIMEOUT_MS),
        maxOutputTokens: 350,
        providerOptions: GROQ_PROVIDER_OPTIONS,
        schema: shortAnswerEvaluationSchema,
        system:
          'You evaluate short answers. Mark answers correct when they are conceptually equivalent, not only exact string matches.',
        prompt: [
          `Question: ${prompt.question.prompt}`,
          `Correct answer: ${prompt.question.correctAnswer}`,
          `Explanation: ${prompt.question.explanation}`,
          `Student answer: ${normalizedStudentAnswer}`,
        ].join('\n'),
      });

      isCorrect = object.correct;
      feedback = object.feedback;
    } else {
      isCorrect =
        normalizeAnswer(normalizedStudentAnswer) === normalizeAnswer(prompt.question.correctAnswer);
      feedback = isCorrect
        ? `Correct. ${prompt.question.explanation}`
        : `Incorrect. ${prompt.question.explanation}`;
    }

    const record: QuizRecord = {
      entry_type: 'quiz_record',
      student_id: studentId,
      subject: prompt.subject,
      topic: prompt.topic,
      timestamp: new Date().toISOString(),
      session_id: prompt.session_id,
      questionId: prompt.question.questionId,
      format: prompt.question.format,
      questionText: prompt.question.prompt,
      options: prompt.question.options,
      studentAnswer: answer.trim(),
      normalizedStudentAnswer,
      correctAnswer: prompt.question.correctAnswer,
      isCorrect,
      explanation: prompt.question.explanation,
      feedback,
    };

    this.volatilePrompts.delete(studentId);
    try {
      await memoryStore.retainEntry(record);
    } catch (error) {
      console.warn('Quiz record retain failed; evaluation will still be returned.', error);
    }
    return {
      prompt,
      record,
    };
  }

  formatQuestion(promptEntry: QuizPromptEntry) {
    const { question } = promptEntry;
    const lines = [
      `Quiz time: ${question.subject} / ${question.topic}`,
      '',
      question.prompt,
    ];

    if (question.options.length > 0) {
      lines.push(
        '',
        ...question.options.map((option, index) => {
          return `${String.fromCharCode(65 + index)}. ${option}`;
        }),
      );
    }

    lines.push('', 'Reply with your answer (for example: A, True, or your written answer).');
    return lines.join('\n');
  }
}

export const quizEngine = new QuizEngine();
