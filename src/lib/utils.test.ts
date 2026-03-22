import { describe, it } from 'node:test';
import assert from 'node:assert';
import { slugify } from './utils';

describe('slugify', () => {
  it('should convert strings to lowercase', () => {
    assert.strictEqual(slugify('HELLO WORLD'), 'hello-world');
    assert.strictEqual(slugify('CamelCaseString'), 'camelcasestring');
  });

  it('should replace spaces and non-alphanumeric characters with hyphens', () => {
    assert.strictEqual(slugify('hello world'), 'hello-world');
    assert.strictEqual(slugify('hello@world!'), 'hello-world');
    assert.strictEqual(slugify('test#case%example'), 'test-case-example');
  });

  it('should collapse multiple hyphens into a single hyphen', () => {
    assert.strictEqual(slugify('hello   world'), 'hello-world');
    assert.strictEqual(slugify('hello---world'), 'hello-world');
    assert.strictEqual(slugify('hello @#$% world'), 'hello-world');
  });

  it('should remove leading and trailing whitespace and hyphens', () => {
    assert.strictEqual(slugify('  hello world  '), 'hello-world');
    assert.strictEqual(slugify('---hello world---'), 'hello-world');
    assert.strictEqual(slugify('  @hello world!  '), 'hello-world');
  });

  it('should truncate the result to a maximum of 64 characters', () => {
    const longString = 'a'.repeat(100);
    const slugifiedLongString = slugify(longString);
    assert.strictEqual(slugifiedLongString.length, 64);
    assert.strictEqual(slugifiedLongString, 'a'.repeat(64));

    const longStringWithSpaces = 'this is a very long string that will definitely exceed the sixty four character limit we have set';
    const slugifiedLongStringWithSpaces = slugify(longStringWithSpaces);
    assert.strictEqual(slugifiedLongStringWithSpaces.length, 64);
    // Let's manually check the truncation logic.
    const expected = longStringWithSpaces
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    assert.strictEqual(slugifiedLongStringWithSpaces, expected);
  });

  it('should handle edge cases', () => {
    assert.strictEqual(slugify(''), '');
    assert.strictEqual(slugify('1234567890'), '1234567890');
    assert.strictEqual(slugify('already-slugified-string'), 'already-slugified-string');
    assert.strictEqual(slugify('---'), '');
    assert.strictEqual(slugify('   '), '');
    assert.strictEqual(slugify('!@#$%^&*()'), '');
  });

  it('should correctly handle strings with both numbers and letters', () => {
    assert.strictEqual(slugify('Chapter 1: The Beginning'), 'chapter-1-the-beginning');
    assert.strictEqual(slugify('Version 2.0 is here!'), 'version-2-0-is-here');
  });
});
