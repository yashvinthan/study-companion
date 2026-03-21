import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sha256Hex } from './security';

describe('sha256Hex', () => {
  it('hashes an empty string correctly', () => {
    // Expected SHA-256 for empty string: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const result = sha256Hex('');
    assert.strictEqual(
      result,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('hashes a known string correctly', () => {
    // Expected SHA-256 for "hello world"
    const result = sha256Hex('hello world');
    assert.strictEqual(
      result,
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    );
  });

  it('creates a 64-character hex string', () => {
    const result = sha256Hex('some random value');
    assert.strictEqual(result.length, 64);
    assert.match(result, /^[0-9a-f]{64}$/);
  });

  it('produces deterministic output', () => {
    const input = 'deterministic test string';
    const result1 = sha256Hex(input);
    const result2 = sha256Hex(input);
    const result3 = sha256Hex(input);

    assert.strictEqual(result1, result2);
    assert.strictEqual(result2, result3);
  });
});
