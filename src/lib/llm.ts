import { createOpenAI } from '@ai-sdk/openai';
import { assertGroqConfig, getServerConfig } from '@/lib/config';

export function getGroqModel() {
  const config = assertGroqConfig();
  const groq = createOpenAI({
    apiKey: config.groqApiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  return groq(config.groqModel);
}

export function getGroqModelName() {
  return getServerConfig().groqModel;
}
