import { createHash, randomBytes } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { assertGoogleOAuthConfig } from '@/lib/config';

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

function base64Url(value: Buffer) {
  return value.toString('base64url');
}

function createSecret(size = 32) {
  return base64Url(randomBytes(size));
}

function createCodeChallenge(codeVerifier: string) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function getGoogleOAuthRedirectUri() {
  const config = assertGoogleOAuthConfig();
  return `${config.appBaseUrl}${GOOGLE_CALLBACK_PATH}`;
}

export function createGoogleOAuthClient() {
  const config = assertGoogleOAuthConfig();

  return new OAuth2Client({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: getGoogleOAuthRedirectUri(),
  });
}

export function createGoogleAuthorizationRequest() {
  const client = createGoogleOAuthClient();
  const state = createSecret();
  const nonce = createSecret();
  const codeVerifier = createSecret(48);
  const codeChallenge = createCodeChallenge(codeVerifier);

  const authorizationUrl = client.generateAuthUrl({
    scope: GOOGLE_SCOPES,
    state,
    nonce,
    prompt: 'select_account',
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
  });

  return {
    authorizationUrl,
    state,
    nonce,
    codeVerifier,
  };
}

export async function exchangeGoogleCode(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}) {
  const config = assertGoogleOAuthConfig();
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken({
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirect_uri: getGoogleOAuthRedirectUri(),
  });

  if (!tokens.id_token) {
    throw new Error('Google did not return an ID token.');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error('Google account email could not be verified.');
  }

  if (payload.nonce !== input.nonce) {
    throw new Error('Google OAuth nonce did not match.');
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    fullName: payload.name?.trim() || payload.email.split('@')[0],
  };
}
