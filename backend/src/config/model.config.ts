export type ModelProvider = 'groq' | 'gemini';

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  /**
   * Hard cap on max_tokens we send in the API request for this model.
   * For Groq free tier, this must be ≤ the OTPM (Output Tokens Per Minute) limit,
   * otherwise EVERY request fails with "Request too large" before even starting.
   */
  maxRequestTokens: number;
  /** Tokens-per-minute limit on the free tier (approximate). */
  freeTierTPM: number;
}

/**
 * Ordered fallback chain — tried from first to last.
 *
 * Gemini 3.6 Flash is first because it has the highest capacity
 * (1M TPM, 65K max output) and won't truncate test code.
 * Groq models are fallback only — their free-tier OTPM limits
 * are too low for generating comprehensive test suites.
 */
export const MODEL_CHAIN: ModelConfig[] = [
  {
    id: 'gemini-3.6-flash',
    provider: 'gemini',
    displayName: 'Gemini 3.6 Flash',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    maxRequestTokens: 8_000,
    freeTierTPM: 1_000_000
  },
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    displayName: 'GPT-OSS 120B',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    maxRequestTokens: 3_000,
    freeTierTPM: 8_000
  },
  {
    id: 'qwen/qwen3.8-27b',
    provider: 'groq',
    displayName: 'Qwen 3.8 27B',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    maxRequestTokens: 900,     // OTPM hard limit is 1,000 — stay safely under
    freeTierTPM: 30_000
  }
];
