const DEFAULT_BANK_PREFIX = 'study-companion';
const DEFAULT_GROQ_MODEL = 'llama3-70b-8192';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface ServerConfig {
  appBaseUrl: string;
  hindsightBaseUrl: string;
  hindsightApiKey: string;
  hindsightBankPrefix: string;
  groqApiKey: string;
  groqModel: string;
  openClawWebhookSecret: string;
  googleClientId: string;
  googleClientSecret: string;
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? '';
}

export function getPostgresUrl() {
  const postgresUrl = readEnv('POSTGRES_URL');

  if (!postgresUrl) {
    throw new ConfigError(
      'PostgreSQL is not configured. Set POSTGRES_URL in the environment before starting the app.',
    );
  }

  return postgresUrl;
}

export function getServerConfig(): ServerConfig {
  return {
    appBaseUrl: readEnv('APP_BASE_URL').replace(/\/+$/, ''),
    hindsightBaseUrl: readEnv('HINDSIGHT_BASE_URL'),
    hindsightApiKey: readEnv('HINDSIGHT_API_KEY'),
    hindsightBankPrefix: readEnv('HINDSIGHT_BANK_PREFIX') || DEFAULT_BANK_PREFIX,
    groqApiKey: readEnv('GROQ_API_KEY'),
    groqModel: readEnv('GROQ_MODEL') || DEFAULT_GROQ_MODEL,
    openClawWebhookSecret: readEnv('OPENCLAW_WEBHOOK_SECRET'),
    googleClientId: readEnv('GOOGLE_CLIENT_ID'),
    googleClientSecret: readEnv('GOOGLE_CLIENT_SECRET'),
  };
}

export function assertAppBaseUrl() {
  const { appBaseUrl } = getServerConfig();

  if (!appBaseUrl) {
    throw new ConfigError('APP_BASE_URL is required for this environment.');
  }

  return appBaseUrl;
}

export function assertMemoryConfig() {
  const config = getServerConfig();

  if (!config.hindsightBaseUrl || !config.hindsightApiKey) {
    throw new ConfigError('Hindsight is not configured for this environment.');
  }

  return config;
}

export function assertGroqConfig() {
  const config = getServerConfig();

  if (!config.groqApiKey) {
    throw new ConfigError('Groq is not configured for this environment.');
  }

  return config;
}

export function assertOpenClawWebhookSecret() {
  const secret = getServerConfig().openClawWebhookSecret;

  if (!secret) {
    throw new ConfigError(
      'OpenClaw webhook integration is disabled because OPENCLAW_WEBHOOK_SECRET is not configured.',
    );
  }

  return secret;
}

export function isGoogleOAuthConfigured() {
  const config = getServerConfig();
  return Boolean(config.appBaseUrl && config.googleClientId && config.googleClientSecret);
}

export function assertGoogleOAuthConfig() {
  const config = getServerConfig();

  if (!config.appBaseUrl || !config.googleClientId || !config.googleClientSecret) {
    throw new ConfigError(
      'Google OAuth is not configured. Set APP_BASE_URL, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.',
    );
  }

  return config;
}
