import { test, describe } from 'node:test';
import assert from 'node:assert';
import { slugify } from './utils';

describe('slugify', () => {
  test('standard strings', () => {
    assert.strictEqual(slugify('Hello World'), 'hello-world');
    assert.strictEqual(slugify('NextJS App Router'), 'nextjs-app-router');
  });

  test('special characters', () => {
    assert.strictEqual(slugify('Hello! @World#'), 'hello-world');
    assert.strictEqual(slugify('What is 100%?'), 'what-is-100');
  });

  test('multiple spaces and hyphens', () => {
    assert.strictEqual(slugify('Hello   World'), 'hello-world');
    assert.strictEqual(slugify('Hello---World'), 'hello-world');
    assert.strictEqual(slugify('Hello   ---   World'), 'hello-world');
  });

  test('leading and trailing non-alphanumeric characters', () => {
    assert.strictEqual(slugify('--Hello World--'), 'hello-world');
    assert.strictEqual(slugify('  Hello World  '), 'hello-world');
    assert.strictEqual(slugify('!!Hello World!!'), 'hello-world');
  });

  test('strings longer than 64 characters', () => {
    const longString = 'a'.repeat(70);
    const result = slugify(longString);
    assert.strictEqual(result.length, 64);
    assert.strictEqual(result, 'a'.repeat(64));

    const longSentence = 'This is a very long sentence that definitely exceeds sixty four characters in length and should be truncated';
    assert.strictEqual(
      slugify(longSentence),
      'this-is-a-very-long-sentence-that-definitely-exceeds-sixty-four-'
    );
  });

  test('accented characters', () => {
    // Expected behavior: 'é' is stripped because the regex /[^a-z0-9]+/g replaces sequences of non-matching chars with a single hyphen.
    // 'Café' -> 'caf' + 'é' -> 'caf' + '-' -> 'caf-' but the trailing hyphen is removed by /^-+|-+$/g
    // So 'Café' -> 'caf'
    assert.strictEqual(slugify('Café'), 'caf');
    assert.strictEqual(slugify('Naïve'), 'na-ve');
  });

  test('empty strings', () => {
    assert.strictEqual(slugify(''), '');
  });

  test('exclusively non-alphanumeric strings', () => {
    assert.strictEqual(slugify('!@#$%^&*()'), '');
    assert.strictEqual(slugify('---'), '');
    assert.strictEqual(slugify('   '), '');
  });
});
