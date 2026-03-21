import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { assertAIConfig, getServerConfig, type AIProvider } from '@/lib/config';

/**
 * Production-grade AI provider with support for multiple backends:
 * - OpenAI (gpt-4o, gpt-4o-mini, etc.)
 * - Anthropic (Claude 3.5 Sonnet, etc.)
 * - Groq (fast inference with open models)
 */
class AIProviderService {
  getModel() {
    const config = assertAIConfig();
    const provider = config.aiProvider;

    switch (provider) {
      case 'openai':
        return this.getOpenAIModel();
      case 'anthropic':
        return this.getAnthropicModel();
      case 'groq':
        return this.getGroqModel();
      default:
        throw new Error(`Unsupported AI provider: ${provider satisfies never}`);
    }
  }

  getProviderName(): string {
    const config = getServerConfig();
    const provider = config.aiProvider;

    switch (provider) {
      case 'openai':
        return `OpenAI ${config.openaiModel}`;
      case 'anthropic':
        return `Anthropic ${config.anthropicModel}`;
      case 'groq':
        return `Groq ${config.groqModel}`;
      default:
        return 'Unknown';
    }
  }

  getProvider(): AIProvider {
    return getServerConfig().aiProvider;
  }

  private getOpenAIModel() {
    const config = assertAIConfig();
    const openai = createOpenAI({
      apiKey: config.openaiApiKey,
    });

    return openai(config.openaiModel);
  }

  private getAnthropicModel() {
    const config = assertAIConfig();
    const anthropic = createAnthropic({
      apiKey: config.anthropicApiKey,
    });

    return anthropic(config.anthropicModel);
  }

  private getGroqModel() {
    const config = assertAIConfig();
    const groq = createOpenAI({
      apiKey: config.groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    return groq(config.groqModel);
  }
}

export const aiProvider = new AIProviderService();

// Legacy exports for backward compatibility
export function getGroqModel() {
  const config = getServerConfig();
  const groq = createOpenAI({
    apiKey: config.groqApiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  return groq(config.groqModel);
}

export function getGroqModelName() {
  return getServerConfig().groqModel;
}
