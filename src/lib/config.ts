const DEFAULT_BANK_PREFIX = 'studytether';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_AI_PROVIDER = 'openai';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type AIProvider = 'openai' | 'anthropic' | 'groq';

export interface ServerConfig {
  appBaseUrl: string;
  hindsightBaseUrl: string;
  hindsightApiKey: string;
  hindsightBankPrefix: string;
  aiProvider: AIProvider;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  groqApiKey: string;
  groqModel: string;
  openClawWebhookSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  logLevel: string;
  metricsEnabled: boolean;
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? '';
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production';
}

function isPlaceholderSecret(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.startsWith('your_') ||
    normalized.includes('replace_me') ||
    normalized.includes('changeme') ||
    normalized === 'localdev' ||
    normalized === 'test' ||
    normalized === 'dummy'
  );
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
  const aiProvider = (readEnv('AI_PROVIDER') || DEFAULT_AI_PROVIDER) as AIProvider;

  return {
    appBaseUrl: readEnv('APP_BASE_URL').replace(/\/+$/, ''),
    hindsightBaseUrl: readEnv('HINDSIGHT_BASE_URL'),
    hindsightApiKey: readEnv('HINDSIGHT_API_KEY'),
    hindsightBankPrefix: readEnv('HINDSIGHT_BANK_PREFIX') || DEFAULT_BANK_PREFIX,
    aiProvider,
    openaiApiKey: readEnv('OPENAI_API_KEY'),
    openaiModel: readEnv('OPENAI_MODEL') || DEFAULT_OPENAI_MODEL,
    anthropicApiKey: readEnv('ANTHROPIC_API_KEY'),
    anthropicModel: readEnv('ANTHROPIC_MODEL') || DEFAULT_ANTHROPIC_MODEL,
    groqApiKey: readEnv('GROQ_API_KEY'),
    groqModel: readEnv('GROQ_MODEL') || DEFAULT_GROQ_MODEL,
    openClawWebhookSecret: readEnv('OPENCLAW_WEBHOOK_SECRET'),
    googleClientId: readEnv('GOOGLE_CLIENT_ID'),
    googleClientSecret: readEnv('GOOGLE_CLIENT_SECRET'),
    logLevel: readEnv('LOG_LEVEL') || 'info',
    metricsEnabled: readEnv('METRICS_ENABLED') !== 'false',
  };
}

export function assertAppBaseUrl() {
  const { appBaseUrl } = getServerConfig();

  if (!appBaseUrl) {
    throw new ConfigError('APP_BASE_URL is required for this environment.');
  }

  if (isProductionEnvironment()) {
    let parsed: URL;
    try {
      parsed = new URL(appBaseUrl);
    } catch {
      throw new ConfigError('APP_BASE_URL must be a valid absolute URL in production.');
    }

    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';

    if (parsed.protocol !== 'https:' && !isLocalhost) {
      throw new ConfigError('APP_BASE_URL must use https in production.');
    }
  }

  return appBaseUrl;
}

export function assertMemoryConfig() {
  const config = getServerConfig();

  if (!config.hindsightBaseUrl || !config.hindsightApiKey) {
    throw new ConfigError('Hindsight is not configured for this environment.');
  }

  if (isProductionEnvironment() && isPlaceholderSecret(config.hindsightApiKey)) {
    throw new ConfigError('HINDSIGHT_API_KEY is a placeholder value in production.');
  }

  return config;
}

export function assertAIConfig() {
  const config = getServerConfig();
  const provider = config.aiProvider;

  if (provider === 'openai') {
    if (!config.openaiApiKey) {
      throw new ConfigError('OpenAI is not configured. Set OPENAI_API_KEY in environment.');
    }
    if (isProductionEnvironment() && isPlaceholderSecret(config.openaiApiKey)) {
      throw new ConfigError('OPENAI_API_KEY is a placeholder value in production.');
    }
  } else if (provider === 'anthropic') {
    if (!config.anthropicApiKey) {
      throw new ConfigError('Anthropic is not configured. Set ANTHROPIC_API_KEY in environment.');
    }
    if (isProductionEnvironment() && isPlaceholderSecret(config.anthropicApiKey)) {
      throw new ConfigError('ANTHROPIC_API_KEY is a placeholder value in production.');
    }
  } else if (provider === 'groq') {
    if (!config.groqApiKey) {
      throw new ConfigError('Groq is not configured. Set GROQ_API_KEY in environment.');
    }
    if (isProductionEnvironment() && isPlaceholderSecret(config.groqApiKey)) {
      throw new ConfigError('GROQ_API_KEY is a placeholder value in production.');
    }
  } else {
    throw new ConfigError(`Invalid AI_PROVIDER: ${provider}. Must be 'openai', 'anthropic', or 'groq'.`);
  }

  return config;
}

export function assertGroqConfig() {
  const config = getServerConfig();

  if (!config.groqApiKey) {
    throw new ConfigError('Groq is not configured for this environment.');
  }

  if (isProductionEnvironment() && isPlaceholderSecret(config.groqApiKey)) {
    throw new ConfigError('GROQ_API_KEY is a placeholder value in production.');
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

  if (isProductionEnvironment() && isPlaceholderSecret(secret)) {
    throw new ConfigError('OPENCLAW_WEBHOOK_SECRET is a placeholder value in production.');
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

  if (isProductionEnvironment()) {
    if (isPlaceholderSecret(config.googleClientId)) {
      throw new ConfigError('GOOGLE_CLIENT_ID is a placeholder value in production.');
    }
    if (isPlaceholderSecret(config.googleClientSecret)) {
      throw new ConfigError('GOOGLE_CLIENT_SECRET is a placeholder value in production.');
    }
  }

  return config;
}
