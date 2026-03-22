import { test, describe, mock } from 'node:test';
import * as assert from 'node:assert';
import { ScheduleManager } from './Schedule_Manager';
import { memoryStore } from '@/lib/memory/MemoryStore';

describe('ScheduleManager', () => {
  describe('logStudySession', () => {
    test('throws an error if durationMinutes is less than or equal to 0', async () => {
      const manager = new ScheduleManager();

      await assert.rejects(
        manager.logStudySession({
          studentId: 'test-student',
          subject: 'Math',
          durationMinutes: 0
        }),
        { message: 'Study session duration must be greater than 0 minutes.' }
      );

      await assert.rejects(
        manager.logStudySession({
          studentId: 'test-student',
          subject: 'Math',
          durationMinutes: -10
        }),
        { message: 'Study session duration must be greater than 0 minutes.' }
      );
    });

    test('logs a valid study session successfully', async () => {
      // Mock memoryStore.retainEntry to just resolve
      mock.method(memoryStore, 'retainEntry', async () => {});

      const manager = new ScheduleManager();
      const input = {
        studentId: 'test-student',
        subject: 'Math',
        topic: 'Algebra',
        durationMinutes: 60,
        confidenceScore: 4 as const
      };

      const result = await manager.logStudySession(input);

      assert.strictEqual(result.entry_type, 'study_session');
      assert.strictEqual(result.student_id, 'test-student');
      assert.strictEqual(result.subject, 'Math');
      assert.strictEqual(result.topic, 'Algebra');
      assert.strictEqual(result.durationMinutes, 60);
      assert.strictEqual(result.confidenceScore, 4);
      assert.deepStrictEqual(result.subjects, ['Math']);
      assert.deepStrictEqual(result.topics, ['Algebra']);
      assert.ok(result.session_id);
      assert.ok(result.timestamp);
      assert.ok(result.date);
      assert.ok(result.startTime);
    });

    test('logs a valid study session with default confidence score and topic', async () => {
      // Mock memoryStore.retainEntry to just resolve
      mock.method(memoryStore, 'retainEntry', async () => {});

      const manager = new ScheduleManager();
      const input = {
        studentId: 'test-student',
        subject: 'History',
        durationMinutes: 30
      };

      const result = await manager.logStudySession(input);

      assert.strictEqual(result.entry_type, 'study_session');
      assert.strictEqual(result.student_id, 'test-student');
      assert.strictEqual(result.subject, 'History');
      assert.strictEqual(result.topic, 'History'); // defaults to subject
      assert.strictEqual(result.durationMinutes, 30);
      assert.strictEqual(result.confidenceScore, 3); // defaults to 3
      assert.deepStrictEqual(result.subjects, ['History']);
      assert.deepStrictEqual(result.topics, ['History']);
    });
  });
});
