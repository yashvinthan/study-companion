import { test, describe } from 'node:test';
import assert from 'node:assert';
import { daysUntil } from './utils.ts';

describe('daysUntil', () => {
  // Using explicit local time components (T12:00:00) to ensure we don't hit
  // timezone shift bugs where YYYY-MM-DD parses as UTC midnight, which might
  // be the previous day in local time.
  test('returns 0 for the same date', () => {
    assert.strictEqual(daysUntil('2023-10-15T12:00:00', new Date('2023-10-15T14:30:00')), 0);
  });

  test('returns positive number for future dates', () => {
    assert.strictEqual(daysUntil('2023-10-20T12:00:00', new Date('2023-10-15T09:00:00')), 5);
  });

  test('returns negative number for past dates', () => {
    assert.strictEqual(daysUntil('2023-10-10T12:00:00', new Date('2023-10-15T20:00:00')), -5);
  });

  test('handles cross-month correctly', () => {
    assert.strictEqual(daysUntil('2023-11-02T12:00:00', new Date('2023-10-31T10:00:00')), 2);
    assert.strictEqual(daysUntil('2023-10-30T12:00:00', new Date('2023-11-02T10:00:00')), -3);
  });

  test('handles leap years correctly', () => {
    assert.strictEqual(daysUntil('2024-03-01T12:00:00', new Date('2024-02-28T12:00:00')), 2);
    assert.strictEqual(daysUntil('2023-03-01T12:00:00', new Date('2023-02-28T12:00:00')), 1);
  });

  test('handles cross-year correctly', () => {
    assert.strictEqual(daysUntil('2024-01-02T12:00:00', new Date('2023-12-30T10:00:00')), 3);
    assert.strictEqual(daysUntil('2023-12-30T12:00:00', new Date('2024-01-02T10:00:00')), -3);
  });

  test('ignores time components', () => {
    // Both are logically on "2023-10-15" local time
    const baseDate = new Date('2023-10-15T23:59:59');
    assert.strictEqual(daysUntil('2023-10-15T00:00:01', baseDate), 0);

    // Testing target date exactly one second into the next day
    assert.strictEqual(daysUntil('2023-10-16T00:00:01', baseDate), 1);
  });

  test('uses current date as default base', () => {
    const today = new Date();

    // To avoid midnight flakiness (where the test's `today` is one day, but
    // `daysUntil` internally creates a `new Date()` that crosses midnight into the next day),
    // we calculate the expected difference based on `today`, and verify that `daysUntil`
    // is either exactly that difference, or offset by 1 (if midnight just crossed between statements).

    // Test future
    const future = new Date(today);
    future.setDate(today.getDate() + 5);
    const futureStr = future.toISOString(); // keep full ISO so target parses consistently

    const diffFuture = daysUntil(futureStr);
    assert.ok(diffFuture === 5 || diffFuture === 4, `Expected 5 (or 4 on midnight cross), got ${diffFuture}`);

    // Test past
    const past = new Date(today);
    past.setDate(today.getDate() - 5);
    const pastStr = past.toISOString();

    const diffPast = daysUntil(pastStr);
    assert.ok(diffPast === -5 || diffPast === -6, `Expected -5 (or -6 on midnight cross), got ${diffPast}`);
  });

  test('handles daylight saving time transitions', () => {
    // In US, Spring Forward is usually 2nd Sunday in March (e.g. 2024-03-10)
    // and Fall Back is 1st Sunday in November (e.g. 2024-11-03)
    // The underlying Math.round handles any 23h or 25h days

    // Spring forward (one day is 23 hours)
    assert.strictEqual(daysUntil('2024-03-12T12:00:00', new Date('2024-03-09T12:00:00')), 3);

    // Fall back (one day is 25 hours)
    assert.strictEqual(daysUntil('2024-11-05T12:00:00', new Date('2024-11-02T12:00:00')), 3);
  });
});
