import { describe, it } from 'node:test';
import assert from 'node:assert';
import { safeEqual } from './security';

describe('safeEqual', () => {
  it('returns true for same strings', () => {
    assert.strictEqual(safeEqual('abc', 'abc'), true);
  });

  it('returns false for different strings', () => {
    assert.strictEqual(safeEqual('abc', 'def'), false);
  });

  it('returns false for strings of different lengths', () => {
    assert.strictEqual(safeEqual('abc', 'abcd'), false);
  });

  it('handles empty strings', () => {
    assert.strictEqual(safeEqual('', ''), true);
    assert.strictEqual(safeEqual('', 'a'), false);
  });

  it('handles strings with special characters', () => {
    assert.strictEqual(safeEqual('!@#$%^&*()', '!@#$%^&*()'), true);
    assert.strictEqual(safeEqual('!@#$%^&*()', '!@#$%^&*( )'), false);
  });

  it('handles strings with unicode characters', () => {
    assert.strictEqual(safeEqual('🔥', '🔥'), true);
    assert.strictEqual(safeEqual('🔥', '💧'), false);
  });

  it('handles long strings', () => {
    const longString1 = 'a'.repeat(10000);
    const longString2 = 'a'.repeat(10000);
    const longString3 = 'a'.repeat(9999) + 'b';
    assert.strictEqual(safeEqual(longString1, longString2), true);
    assert.strictEqual(safeEqual(longString1, longString3), false);
  });
});
