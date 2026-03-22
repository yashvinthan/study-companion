import test from 'node:test';
import assert from 'node:assert';
import { assertTrustedOrigin } from './security';

test('assertTrustedOrigin', async (t) => {
  // Helper to create a mock Request object
  const createMockRequest = (url: string, headers: Record<string, string>) => {
    return {
      url,
      headers: new Headers(headers),
    } as unknown as Request;
  };

  await t.test('allows request when origin matches expected origin', () => {
    // We also mock APP_BASE_URL which is used inside assertTrustedOrigin via assertAppBaseUrl
    process.env.APP_BASE_URL = 'https://studycompanion.app';

    const req = createMockRequest('https://studycompanion.app/api/data', {
      origin: 'https://studycompanion.app',
    });

    assert.doesNotThrow(() => assertTrustedOrigin(req));
  });

  await t.test('allows request when referer matches expected origin (and origin is missing)', () => {
    process.env.APP_BASE_URL = 'https://studycompanion.app';

    const req = createMockRequest('https://studycompanion.app/api/data', {
      referer: 'https://studycompanion.app/some-page',
    });

    assert.doesNotThrow(() => assertTrustedOrigin(req));
  });

  await t.test('throws error when origin does not match expected origin', () => {
    process.env.APP_BASE_URL = 'https://studycompanion.app';

    const req = createMockRequest('https://studycompanion.app/api/data', {
      origin: 'https://malicious.com',
    });

    assert.throws(
      () => assertTrustedOrigin(req),
      { message: 'Cross-origin requests are not allowed for this endpoint.' }
    );
  });

  await t.test('throws error when referer does not match expected origin (and origin is missing)', () => {
    process.env.APP_BASE_URL = 'https://studycompanion.app';

    const req = createMockRequest('https://studycompanion.app/api/data', {
      referer: 'https://malicious.com/some-page',
    });

    assert.throws(
      () => assertTrustedOrigin(req),
      { message: 'Cross-origin requests are not allowed for this endpoint.' }
    );
  });

  await t.test('throws error when neither origin nor referer are present in production', () => {
    process.env.APP_BASE_URL = 'https://studycompanion.app';
    const oldEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';

    const req = createMockRequest('https://studycompanion.app/api/data', {});

    assert.throws(
      () => assertTrustedOrigin(req),
      { message: 'Request origin could not be verified.' }
    );

    (process.env as any).NODE_ENV = oldEnv;
  });

  await t.test('allows request when neither origin nor referer are present in non-production mode', () => {
    process.env.APP_BASE_URL = 'https://studycompanion.app';
    const oldEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';

    const req = createMockRequest('https://studycompanion.app/api/data', {});

    assert.doesNotThrow(() => assertTrustedOrigin(req));

    (process.env as any).NODE_ENV = oldEnv;
  });

  await t.test('allows request when fetch site is same-origin', () => {
    process.env.APP_BASE_URL = 'https://studycompanion.app';

    const req = createMockRequest('https://studycompanion.app/api/data', {
      'sec-fetch-site': 'same-origin',
    });

    assert.doesNotThrow(() => assertTrustedOrigin(req));
  });
});
