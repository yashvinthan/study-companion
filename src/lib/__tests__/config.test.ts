import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getPostgresUrl, ConfigError } from '../config.ts';

describe('getPostgresUrl', () => {
  let originalPostgresUrl: string | undefined;

  beforeEach(() => {
    originalPostgresUrl = process.env.POSTGRES_URL;
  });

  afterEach(() => {
    if (originalPostgresUrl === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = originalPostgresUrl;
    }
  });

  it('should return the postgres url if set', () => {
    process.env.POSTGRES_URL = 'postgres://user:password@localhost:5432/db';
    assert.strictEqual(getPostgresUrl(), 'postgres://user:password@localhost:5432/db');
  });

  it('should throw ConfigError if POSTGRES_URL is not set', () => {
    delete process.env.POSTGRES_URL;
    assert.throws(() => getPostgresUrl(), ConfigError);
    assert.throws(() => getPostgresUrl(), /PostgreSQL is not configured/);
  });

  it('should throw ConfigError if POSTGRES_URL is an empty string', () => {
    process.env.POSTGRES_URL = '';
    assert.throws(() => getPostgresUrl(), ConfigError);
    assert.throws(() => getPostgresUrl(), /PostgreSQL is not configured/);
  });

  it('should throw ConfigError if POSTGRES_URL is only whitespace', () => {
    process.env.POSTGRES_URL = '   ';
    assert.throws(() => getPostgresUrl(), ConfigError);
    assert.throws(() => getPostgresUrl(), /PostgreSQL is not configured/);
  });

  it('should return trimmed postgres url if it contains surrounding whitespace', () => {
    process.env.POSTGRES_URL = '  postgres://user:password@localhost:5432/db  ';
    assert.strictEqual(getPostgresUrl(), 'postgres://user:password@localhost:5432/db');
  });
});
