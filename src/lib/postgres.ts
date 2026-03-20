import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { ConfigError, getPostgresUrl } from '@/lib/config';
import { createOpaqueToken, sha256Hex } from '@/lib/security';
import type {
  AuthSession,
  AuthenticatedUser,
  RecentLiveEvent,
} from '@/lib/types';

declare global {
  var __studyCompanionPool: Pool | undefined;
  var __studyCompanionDbReady: Promise<void> | undefined;
}

const PASSWORD_HASH_ROUNDS = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS_PER_USER = 5;

type SessionRow = {
  expires_at: string;
  id: string;
  email: string;
  full_name: string;
};

type UserSnapshotRow = {
  id: string;
  email: string;
  full_name: string;
  auth_provider: 'password' | 'google' | 'password_google';
  has_password: boolean;
  created_at: string | null;
  last_login_at: string | null;
  active_session_count: string;
};

type UserCredentialsRow = {
  id: string;
  email: string;
  full_name: string;
  auth_provider: 'password' | 'google' | 'password_google';
  google_sub: string | null;
  password_hash: string | null;
};

type LiveEventRow = {
  id: number;
  event_type: RecentLiveEvent['eventType'];
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePasswordStrength(password: string) {
  if (
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.',
    );
  }
}

function getAuthProvider(hasPassword: boolean, hasGoogle: boolean) {
  if (hasPassword && hasGoogle) {
    return 'password_google' as const;
  }

  if (hasGoogle) {
    return 'google' as const;
  }

  return 'password' as const;
}

export function getPool() {
  if (!global.__studyCompanionPool) {
    global.__studyCompanionPool = new Pool({
      connectionString: getPostgresUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.__studyCompanionPool;
}

export async function ensurePostgres() {
  if (!global.__studyCompanionDbReady) {
    global.__studyCompanionDbReady = (async () => {
      const pool = getPool();

      await pool.query('create extension if not exists pgcrypto');
      await pool.query(`
        create table if not exists app_users (
          id uuid primary key default gen_random_uuid(),
          email text unique not null,
          full_name text not null,
          password_hash text,
          google_sub text unique,
          auth_provider text not null default 'password',
          created_at timestamptz not null default now(),
          last_login_at timestamptz
        )
      `);
      await pool.query(`
        alter table app_users
        alter column password_hash drop not null
      `);
      await pool.query(`
        alter table app_users
        add column if not exists google_sub text
      `);
      await pool.query(`
        alter table app_users
        add column if not exists auth_provider text not null default 'password'
      `);
      await pool.query(`
        update app_users
        set auth_provider =
          case
            when password_hash is not null and google_sub is not null then 'password_google'
            when google_sub is not null then 'google'
            else 'password'
          end
        where auth_provider is null
           or auth_provider not in ('password', 'google', 'password_google')
      `);
      await pool.query(`
        create unique index if not exists app_users_google_sub_idx
        on app_users(google_sub)
        where google_sub is not null
      `);
      await pool.query(`
        create table if not exists app_sessions (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references app_users(id) on delete cascade,
          token_hash text unique,
          created_at timestamptz not null default now(),
          expires_at timestamptz not null
        )
      `);
      await pool.query(`
        alter table app_sessions
        add column if not exists token_hash text
      `);
      await pool.query(`
        alter table app_sessions
        add column if not exists created_at timestamptz not null default now()
      `);
      await pool.query(`
        do $$
        begin
          if exists (
            select 1
            from information_schema.columns
            where table_name = 'app_sessions'
              and column_name = 'token'
          ) then
            alter table app_sessions alter column token drop not null;
            update app_sessions
            set token_hash = encode(digest(token, 'sha256'), 'hex')
            where token is not null and token_hash is null;
            update app_sessions
            set token = null
            where token is not null;
          end if;
        end $$;
      `);
      await pool.query(`
        create unique index if not exists app_sessions_token_hash_idx
        on app_sessions(token_hash)
      `);
      await pool.query(`
        create table if not exists app_live_events (
          id bigserial primary key,
          event_type text not null,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists app_rate_limits (
          bucket_key text primary key,
          scope text not null,
          count integer not null,
          window_started_at timestamptz not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create index if not exists app_rate_limits_scope_idx
        on app_rate_limits(scope, updated_at)
      `);
      await pool.query(`delete from app_sessions where expires_at <= now()`);
      await pool.query(`delete from app_rate_limits where updated_at < now() - interval '7 days'`);
    })().catch((error) => {
      global.__studyCompanionDbReady = undefined;
      console.error('ensurePostgres failed:', error);
      throw error;
    });
  }

  return global.__studyCompanionDbReady;
}

function mapSessionRow(row: SessionRow): AuthSession {
  return {
    expiresAt: row.expires_at,
    user: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
    },
  };
}

export async function enforceRateLimit(input: {
  scope: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
}) {
  await ensurePostgres();

  const bucketKey = `${input.scope}:${input.key}`;
  const windowStartedAt = new Date(
    Math.floor(Date.now() / input.windowMs) * input.windowMs,
  ).toISOString();

  const result = await getPool().query<{ count: number }>(
    `insert into app_rate_limits (bucket_key, scope, count, window_started_at)
     values ($1, $2, 1, $3)
     on conflict (bucket_key)
     do update
       set count =
         case
           when app_rate_limits.window_started_at = excluded.window_started_at
             then app_rate_limits.count + 1
           else 1
         end,
           window_started_at =
         case
           when app_rate_limits.window_started_at = excluded.window_started_at
             then app_rate_limits.window_started_at
           else excluded.window_started_at
         end,
           updated_at = now()
     returning count`,
    [bucketKey, input.scope, windowStartedAt],
  );

  const count = Number(result.rows[0]?.count ?? 0);

  if (count > input.maxAttempts) {
    throw new Error('Too many requests. Please try again later.');
  }
}

export async function authenticateUser(email: string, password: string) {
  await ensurePostgres();
  const pool = getPool();
  const result = await pool.query<UserCredentialsRow>(
    `select id, email, full_name, auth_provider, google_sub, password_hash
     from app_users
     where email = $1
     limit 1`,
    [normalizeEmail(email)],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  if (!row.password_hash) {
    return null;
  }

  const passwordValid = await bcrypt.compare(password, row.password_hash);
  if (!passwordValid) {
    return null;
  }

  await pool.query('update app_users set last_login_at = now() where id = $1', [row.id]);

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
  } satisfies AuthenticatedUser;
}

export async function authenticateGoogleUser(input: {
  email: string;
  fullName: string;
  googleSub: string;
}) {
  await ensurePostgres();
  const client = await getPool().connect();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();

  try {
    await client.query('begin');

    const byGoogle = await client.query<UserCredentialsRow>(
      `select id, email, full_name, auth_provider, google_sub, password_hash
       from app_users
       where google_sub = $1
       limit 1`,
      [input.googleSub],
    );

    if (byGoogle.rows[0]) {
      const user = byGoogle.rows[0];
      const updated = await client.query<AuthenticatedUser>(
        `update app_users
         set full_name = $2,
             auth_provider = $3,
             last_login_at = now()
         where id = $1
         returning id, email, full_name as "fullName"`,
        [
          user.id,
          fullName || user.full_name,
          getAuthProvider(Boolean(user.password_hash), true),
        ],
      );

      await client.query('commit');
      return { action: 'signin' as const, user: updated.rows[0] };
    }

    const byEmail = await client.query<UserCredentialsRow>(
      `select id, email, full_name, auth_provider, google_sub, password_hash
       from app_users
       where email = $1
       limit 1`,
      [email],
    );

    if (byEmail.rows[0]) {
      const user = byEmail.rows[0];

      if (user.google_sub && user.google_sub !== input.googleSub) {
        throw new Error('Unable to link Google account to the requested user.');
      }

      const updated = await client.query<AuthenticatedUser>(
        `update app_users
         set google_sub = $2,
             auth_provider = $3,
             last_login_at = now()
         where id = $1
         returning id, email, full_name as "fullName"`,
        [user.id, input.googleSub, getAuthProvider(Boolean(user.password_hash), true)],
      );

      await client.query('commit');
      return { action: 'linked' as const, user: updated.rows[0] };
    }

    const created = await client.query<AuthenticatedUser>(
      `insert into app_users (email, full_name, password_hash, google_sub, auth_provider, last_login_at)
       values ($1, $2, null, $3, 'google', now())
       returning id, email, full_name as "fullName"`,
      [email, fullName, input.googleSub],
    );

    await client.query('commit');
    return { action: 'signup' as const, user: created.rows[0] };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function registerUser(input: {
  email: string;
  fullName: string;
  password: string;
}) {
  await ensurePostgres();
  const pool = getPool();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  const password = input.password;

  if (!fullName) {
    throw new Error('Full name is required.');
  }

  validatePasswordStrength(password);

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  try {
    const result = await pool.query<AuthenticatedUser>(
      `insert into app_users (email, full_name, password_hash)
       values ($1, $2, $3)
       returning id, email, full_name as "fullName"`,
      [email, fullName, passwordHash],
    );

    const user = result.rows[0];
    await pool.query('update app_users set last_login_at = now() where id = $1', [user.id]);
    return user;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new Error('Unable to create account with the provided details.');
    }

    throw error;
  }
}

export async function createAuthSession(userId: string) {
  await ensurePostgres();
  const pool = getPool();
  const token = createOpaqueToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `insert into app_sessions (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  );
  await pool.query(
    `delete from app_sessions
     where user_id = $1
       and id not in (
         select id
         from app_sessions
         where user_id = $1
         order by created_at desc
         limit $2
       )`,
    [userId, MAX_ACTIVE_SESSIONS_PER_USER],
  );

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getAuthSession(token: string | undefined) {
  if (!token) {
    return null;
  }

  await ensurePostgres();
  const pool = getPool();
  const tokenHash = sha256Hex(token);
  const result = await pool.query<SessionRow>(
    `select s.expires_at, u.id, u.email, u.full_name
     from app_sessions s
     join app_users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()
     limit 1`,
    [tokenHash],
  );

  const row = result.rows[0];
  return row ? mapSessionRow(row) : null;
}

export async function getPostgresUserSnapshot(userId: string) {
  await ensurePostgres();
  const result = await getPool().query<UserSnapshotRow>(
    `select
       u.id,
       u.email,
       u.full_name,
       u.auth_provider,
       (u.password_hash is not null) as has_password,
       u.created_at,
       u.last_login_at,
       count(s.id)::text as active_session_count
     from app_users u
     left join app_sessions s
       on s.user_id = u.id
      and s.expires_at > now()
     where u.id = $1
     group by u.id, u.email, u.full_name, u.auth_provider, u.password_hash, u.created_at, u.last_login_at
     limit 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('User profile was not found in PostgreSQL.');
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    authProvider: row.auth_provider,
    hasPassword: row.has_password,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    activeSessionCount: Number.parseInt(row.active_session_count, 10),
  };
}

export async function updateUserProfile(userId: string, input: { fullName: string }) {
  await ensurePostgres();
  const fullName = input.fullName.trim();

  if (!fullName) {
    throw new Error('Full name is required.');
  }

  const result = await getPool().query<AuthenticatedUser>(
    `update app_users
     set full_name = $2
     where id = $1
     returning id, email, full_name as "fullName"`,
    [userId, fullName],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error('Unable to update the user profile.');
  }

  return user;
}

export async function updateUserPassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}) {
  await ensurePostgres();
  const { userId, currentPassword } = input;
  const nextPassword = input.nextPassword;

  validatePasswordStrength(nextPassword);

  const result = await getPool().query<UserCredentialsRow>(
    `select id, email, full_name, auth_provider, google_sub, password_hash
     from app_users
     where id = $1
     limit 1`,
    [userId],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error('User profile was not found.');
  }

  if (!user.password_hash) {
    if (currentPassword.trim()) {
      throw new Error('This account does not currently use a password sign-in.');
    }
  } else {
    const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordValid) {
      throw new Error('Current password is incorrect.');
    }

    if (await bcrypt.compare(nextPassword, user.password_hash)) {
      throw new Error('New password must be different from the current password.');
    }
  }

  const nextPasswordHash = await bcrypt.hash(nextPassword, PASSWORD_HASH_ROUNDS);
  await getPool().query(
    `update app_users
     set password_hash = $2,
         auth_provider = $3
     where id = $1`,
    [userId, nextPasswordHash, getAuthProvider(true, Boolean(user.google_sub))],
  );
  await getPool().query('delete from app_sessions where user_id = $1', [userId]);
}

export async function deleteAuthSession(token: string | undefined) {
  if (!token) {
    return;
  }

  await ensurePostgres();
  await getPool().query('delete from app_sessions where token_hash = $1', [sha256Hex(token)]);
}

export async function listRecentLiveEvents(input: {
  userId?: string;
  studentId?: string;
  limit?: number;
}): Promise<RecentLiveEvent[]> {
  await ensurePostgres();

  const filters: string[] = [];
  const values: Array<string | number> = [];

  if (input.userId) {
    values.push(input.userId);
    filters.push(`metadata->>'userId' = $${values.length}`);
  }

  if (input.studentId) {
    values.push(input.studentId);
    filters.push(`metadata->>'studentId' = $${values.length}`);
  }

  if (filters.length === 0) {
    return [];
  }

  values.push(input.limit ?? 10);
  const result = await getPool().query<LiveEventRow>(
    `select id, event_type, created_at, metadata
     from app_live_events
     where ${filters.join(' or ')}
     order by created_at desc
     limit $${values.length}`,
    values,
  );

  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    label:
      typeof row.metadata?.label === 'string' && row.metadata.label
        ? row.metadata.label
        : row.event_type,
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  }));
}

export async function recordLiveEvent(
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await ensurePostgres();
    await getPool().query(
      `insert into app_live_events (event_type, metadata)
       values ($1, $2::jsonb)`,
      [eventType, JSON.stringify(metadata)],
    );
  } catch (error) {
    if (!(error instanceof ConfigError)) {
      console.warn('Unable to record PostgreSQL live event', error);
    }
  }
}
