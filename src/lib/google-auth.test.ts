import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { getGoogleOAuthRedirectUri } from './google-auth';

describe('getGoogleOAuthRedirectUri', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return the correct redirect URI when config is valid', () => {
    process.env.APP_BASE_URL = 'https://example.com';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const result = getGoogleOAuthRedirectUri();
    assert.strictEqual(result, 'https://example.com/api/auth/google/callback');
  });

  it('should format URL correctly when APP_BASE_URL has a trailing slash', () => {
    process.env.APP_BASE_URL = 'https://example.com/';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const result = getGoogleOAuthRedirectUri();
    assert.strictEqual(result, 'https://example.com/api/auth/google/callback');
  });

  it('should throw ConfigError when required config is missing', () => {
    process.env.APP_BASE_URL = '';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    assert.throws(
      () => getGoogleOAuthRedirectUri(),
      {
        name: 'ConfigError',
        message: 'Google OAuth is not configured. Set APP_BASE_URL, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.'
      }
    );

    process.env.APP_BASE_URL = 'https://example.com';
    process.env.GOOGLE_CLIENT_ID = '';

    assert.throws(
      () => getGoogleOAuthRedirectUri(),
      {
        name: 'ConfigError',
        message: 'Google OAuth is not configured. Set APP_BASE_URL, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.'
      }
    );
  });
});
