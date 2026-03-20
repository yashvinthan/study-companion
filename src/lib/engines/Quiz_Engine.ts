import { generateObject } from 'ai';
import { z } from 'zod';
import { getGroqModel } from '@/lib/llm';
import { memoryStore } from '@/lib/memory/MemoryStore';
import type { QuizPromptEntry, QuizQuestion, QuizRecord } from '@/lib/types';
import { normalizeAnswer } from '@/lib/utils';

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
  async generateQuiz(studentId: string, subject: string, topic?: string) {
    const recentRecords = await memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record');
    const matchingRecords = recentRecords
      .filter((record) => record.subject.toLowerCase() === subject.toLowerCase())
      .slice(0, 10);

    const repeatAvoidance = matchingRecords
      .map((record) => `- ${record.questionText}`)
      .join('\n');

    const { object } = await generateObject({
      model: getGroqModel(),
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

    await memoryStore.retainEntry(promptEntry);
    return promptEntry;
  }

  async getPendingPrompt(studentId: string) {
    const prompts = await memoryStore.listEntries<QuizPromptEntry>(studentId, 'quiz_prompt');
    const records = await memoryStore.listEntries<QuizRecord>(studentId, 'quiz_record');
    const answeredSessionIds = new Set(records.map((record) => record.session_id));

    return prompts.find((prompt) => !answeredSessionIds.has(prompt.session_id)) ?? null;
  }

  async evaluateLatestAnswer(studentId: string, answer: string) {
    const prompt = await this.getPendingPrompt(studentId);

    if (!prompt) {
      throw new Error('No active quiz question. Start one with /quiz <subject>.');
    }

    const normalizedStudentAnswer = normalizeQuestionAnswer(prompt.question, answer);
    let isCorrect = false;
    let feedback = '';

    if (prompt.question.format === 'short_answer') {
      const { object } = await generateObject({
        model: getGroqModel(),
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

    await memoryStore.retainEntry(record);
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

    lines.push('', 'Reply with /answer <your answer>.');
    return lines.join('\n');
  }
}

export const quizEngine = new QuizEngine();
