import test from 'node:test';
import assert from 'node:assert';
import { normalizeAnswer } from './utils.ts';

test('normalizeAnswer', async (t) => {
  await t.test('handles basic string without modifications', () => {
    assert.strictEqual(normalizeAnswer('hello world'), 'hello world');
  });

  await t.test('converts uppercase and mixed case to lowercase', () => {
    assert.strictEqual(normalizeAnswer('HeLLo WORLD'), 'hello world');
  });

  await t.test('trims leading and trailing whitespace', () => {
    assert.strictEqual(normalizeAnswer('  hello world  '), 'hello world');
  });

  await t.test('collapses multiple consecutive spaces', () => {
    assert.strictEqual(normalizeAnswer('hello   world'), 'hello world');
  });

  await t.test('replaces tabs and newlines with spaces', () => {
    assert.strictEqual(normalizeAnswer('hello\tworld\nagain'), 'hello world again');
  });

  await t.test('handles a complex combination of spacing, casing, and whitespace', () => {
    assert.strictEqual(normalizeAnswer(' \n  HELLO \t  WORLD  \n'), 'hello world');
  });
});
