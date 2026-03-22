import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveMultipleChoiceAnswer } from './Quiz_Engine_utils.ts';

describe('resolveMultipleChoiceAnswer', () => {
  const options = ['First', 'Second', 'Third', 'Fourth'];

  it('should resolve correct option based on exact letter match (A, B, C, D)', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'A'), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'B'), 'Second');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'C'), 'Third');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'D'), 'Fourth');
  });

  it('should resolve correct option based on lowercase letter match (a, b, c, d)', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'a'), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'b'), 'Second');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'c'), 'Third');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'd'), 'Fourth');
  });

  it('should resolve correct option when letter is followed by punctuation', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'A)'), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'B.'), 'Second');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'c:'), 'Third');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'D-'), 'Fourth');
  });

  it('should resolve correct option when letter is followed by a space', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'A '), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'b '), 'Second');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'C   '), 'Third');
  });

  it('should resolve correct option ignoring leading and trailing whitespace', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, '  A  '), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, '\tB)\n'), 'Second');
  });

  it('should resolve correct option when letter is part of a longer string but separated by accepted punctuation', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'A) First option'), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'B: Second option'), 'Second');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'C - Third option'), 'Third');
  });

  it('should return original trimmed string if no matching letter pattern is found at start', () => {
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'First'), 'First');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'E)'), 'E)'); // Out of bounds letter pattern A-D
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'Z.'), 'Z.');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, '1.'), '1.');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'The answer is A'), 'The answer is A');
  });

  it('should return original trimmed string if option index is out of bounds', () => {
    const limitedOptions = ['Only One'];
    assert.strictEqual(resolveMultipleChoiceAnswer(limitedOptions, 'A'), 'Only One');
    assert.strictEqual(resolveMultipleChoiceAnswer(limitedOptions, 'B'), 'B');
    assert.strictEqual(resolveMultipleChoiceAnswer(limitedOptions, 'D)'), 'D)');
  });

  it('should return original trimmed string for letters immediately followed by alphanumeric characters', () => {
    // Should not match "Apple", "Boy", etc. since they don't have accepted separators
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'Apple'), 'Apple');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'Boy'), 'Boy');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'Cat'), 'Cat');
    assert.strictEqual(resolveMultipleChoiceAnswer(options, 'Dog'), 'Dog');
  });
});
