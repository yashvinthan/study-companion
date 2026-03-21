import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { createOpaqueToken } from '../security';

describe('createOpaqueToken', () => {
  test('returns a string', () => {
    const token = createOpaqueToken();
    assert.strictEqual(typeof token, 'string');
  });

  test('default size is 32 bytes, resulting in 64 hex characters', () => {
    const token = createOpaqueToken();
    assert.strictEqual(token.length, 64);
  });

  test('custom size is respected', () => {
    const token = createOpaqueToken(16);
    assert.strictEqual(token.length, 32);
  });

  test('returns valid hex string', () => {
    const token = createOpaqueToken();
    assert.match(token, /^[0-9a-f]+$/i);
  });

  test('returns unique tokens', () => {
    const token1 = createOpaqueToken();
    const token2 = createOpaqueToken();
    assert.notStrictEqual(token1, token2);
  });
});
