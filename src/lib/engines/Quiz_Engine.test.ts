import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { normalizeQuestionAnswer } from './Quiz_Engine';
import { resolveMultipleChoiceAnswer } from './Quiz_Engine_utils';
import type { QuizQuestion } from '../types';

describe('resolveMultipleChoiceAnswer', () => {
  const options = ['Option A', 'Option B', 'Option C', 'Option D'];

  test('resolves letter A to first option', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'A'), 'Option A');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'A.'), 'Option A');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'a)'), 'Option A');
  });

  test('resolves letter C to third option', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'c:'), 'Option C');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'C -'), 'Option C');
  });

  test('returns original trimmed string if no match', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, ' Option B '), 'Option B');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'E'), 'E');
  });
});

describe('normalizeQuestionAnswer', () => {
  test('handles multiple_choice format', () => {
    const question: QuizQuestion = {
      questionId: '1',
      subject: 'Math',
      topic: 'Algebra',
      format: 'multiple_choice',
      prompt: '1+1?',
      options: ['1', '2', '3', '4'],
      correctAnswer: '2',
      explanation: 'basic math'
    };
    assert.strictEqual(normalizeQuestionAnswer(question, 'B'), '2');
    assert.strictEqual(normalizeQuestionAnswer(question, ' b) '), '2');
    assert.strictEqual(normalizeQuestionAnswer(question, '2'), '2');
  });

  test('handles true_false format', () => {
    const question: QuizQuestion = {
      questionId: '2',
      subject: 'Math',
      topic: 'Algebra',
      format: 'true_false',
      prompt: '1+1=2?',
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: 'basic math'
    };
    assert.strictEqual(normalizeQuestionAnswer(question, 'T'), 'true');
    assert.strictEqual(normalizeQuestionAnswer(question, 't'), 'true');
    assert.strictEqual(normalizeQuestionAnswer(question, 'True'), 'true');
    assert.strictEqual(normalizeQuestionAnswer(question, 'yes'), 'true');

    assert.strictEqual(normalizeQuestionAnswer(question, 'F'), 'false');
    assert.strictEqual(normalizeQuestionAnswer(question, 'f'), 'false');
    assert.strictEqual(normalizeQuestionAnswer(question, 'False'), 'false');
    assert.strictEqual(normalizeQuestionAnswer(question, 'no'), 'false');

    assert.strictEqual(normalizeQuestionAnswer(question, 'maybe'), 'maybe');
  });

  test('handles short_answer format', () => {
    const question: QuizQuestion = {
      questionId: '3',
      subject: 'Math',
      topic: 'Algebra',
      format: 'short_answer',
      prompt: '1+1?',
      options: [],
      correctAnswer: '2',
      explanation: 'basic math'
    };
    assert.strictEqual(normalizeQuestionAnswer(question, ' 2 '), '2');
    assert.strictEqual(normalizeQuestionAnswer(question, 'two'), 'two');
  });
});
