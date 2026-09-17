export type ModelProvider = 'groq' | 'gemini';

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  /** Tokens-per-minute limit on the free tier (approximate). */
  freeTierTPM: number;
}

/**
 * Ordered fallback chain — tried from first to last.
 * The generator will skip a model if:
 *  1. Its API key is not configured.
 *  2. The prompt exceeds its context window.
 *  3. It returns a rate-limit (429) or server error (5xx).
 */
export const MODEL_CHAIN: ModelConfig[] = [
  {
    id: 'qwen/qwen3.8-27b',
    provider: 'groq',
    displayName: 'Qwen 3.8 27B',
    contextWindow: 131_042,
    maxOutputTokens: 16_384,
    freeTierTPM: 30_000
  },
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    displayName: 'GPT-OSS 120B',
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    freeTierTPM: 8_000
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    displayName: 'Gemini 2.5 Flash',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    freeTierTPM: 1_000_000
  }
];
