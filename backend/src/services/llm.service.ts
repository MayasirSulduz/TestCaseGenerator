import axios from 'axios';
import { envConfig } from '../config/env.config';
import { MODEL_CHAIN, ModelConfig } from '../config/model.config';

// ── Public Types ──────────────────────────────────────────────────────────────

export interface LLMCallResult {
  content: string;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  failureReasons?: string[];
}

// ── Helper Utilities ──────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseWaitTimeMs(errorMsg: string): number | null {
  const match = errorMsg.match(/try again in ([0-9.]+)\s*(s|ms)/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    return unit === 's' ? Math.ceil(val * 1000) : Math.ceil(val);
  }
  return null;
}

/**
 * Returns true for errors that are transient and worth retrying.
 */
function isRetryableError(error: any): boolean {
  const errData = error?.response?.data;
  const errMsg = typeof errData === 'string'
    ? errData
    : JSON.stringify(errData || '');
  const sysMsg = `${error?.message || ''} ${error?.code || ''}`;

  // "high demand" / "overloaded" / "temporarily unavailable"
  if (/high.?demand|overloaded|temporarily|unavailable|503|server.?error/i.test(errMsg)) {
    return true;
  }

  // Network timeouts, DNS resolution errors (EAI_AGAIN, getaddrinfo, ENOTFOUND, ETIMEDOUT, ECONNRESET)
  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|getaddrinfo|ENETUNREACH|socket.?hang|network|fetch.?failed/i.test(sysMsg)) {
    return true;
  }

  return false;
}

// ── Token Estimation ──────────────────────────────────────────────────────────

/**
 * Rough token estimate: ~4 characters per token (industry heuristic).
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil((text || '').length / 4);
}
// ── Truncation Detection ──────────────────────────────────────────────────────
/**
 * Detects if the LLM output is OBVIOUSLY truncated mid-code.
 * Very conservative — only flags the most blatant cases to avoid
 * false positives that waste rate limit budget.
 */
function isOutputTruncated(content: string): boolean {
  if (!content || content.trim().length < 10) return true;
  return false;
}

// ── Provider-Specific API Callers ─────────────────────────────────────────────

async function callGroqApi(
  prompt: string,
  model: string,
  maxTokens: number
): Promise<string | null> {
  if (!envConfig.groqApiKey) {
    return null;
  }

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert software test engineer who writes comprehensive unit tests.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
    top_p: 0.9
  };

  const response = await axios.post(envConfig.groqApiUrl, payload, {
    headers: {
      Authorization: `Bearer ${envConfig.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 90000
  });

  if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
    return response.data.choices[0].message.content;
  }

  return null;
}

async function callGeminiApi(
  prompt: string,
  model: string,
  maxTokens: number
): Promise<string | null> {
  if (!envConfig.geminiApiKey) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${envConfig.geminiApiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: 'You are an expert software test engineer who writes comprehensive unit tests.'
        }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      topP: 0.9
    }
  };

  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000
  });

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}

async function callMistralApi(
  prompt: string,
  model: string,
  maxTokens: number
): Promise<string | null> {
  if (!envConfig.mistralApiKey) {
    return null;
  }

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert software test engineer who writes comprehensive unit tests.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
    top_p: 0.9
  };

  const response = await axios.post(envConfig.mistralApiUrl, payload, {
    headers: {
      Authorization: `Bearer ${envConfig.mistralApiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 90000
  });

  if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
    return response.data.choices[0].message.content;
  }

  return null;
}

// ── Rate Limit Checker ────────────────────────────────────────────────────────

function isRateLimitError(error: any): boolean {
  const status = error?.response?.status;
  if (status === 429) return true;

  const errData = error?.response?.data;
  const errMsg = typeof errData === 'string'
    ? errData
    : JSON.stringify(errData || '');

  return /rate.?limit|tokens?.per.?minute|tpm|otpm|too.?large|quota|exceeded/i.test(errMsg);
}

function isApiKeyMissing(model: ModelConfig): boolean {
  if (model.provider === 'groq') return !envConfig.groqApiKey;
  if (model.provider === 'gemini') return !envConfig.geminiApiKey;
  if (model.provider === 'mistral') return !envConfig.mistralApiKey;
  return true;
}

// ── Fallback Engine ───────────────────────────────────────────────────────────

export async function callLLMWithFallback(
  prompt: string,
  maxTokens: number = 3000
): Promise<LLMCallResult | null> {
  const promptTokens = estimateTokenCount(prompt);
  const failureReasons: string[] = [];

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];

    // 1. API Key check
    if (isApiKeyMissing(model)) {
      const reason = `${model.displayName}: API key not configured in backend .env`;
      console.log(`  ⏭ Skipping ${model.displayName} — API key not configured`);
      failureReasons.push(reason);
      continue;
    }

    // 2. Context Window check
    const totalTokens = promptTokens + maxTokens;
    if (totalTokens > model.contextWindow) {
      const reason = `${model.displayName}: Prompt too large (${totalTokens} tokens > ${model.contextWindow} limit)`;
      console.log(`  ⏭ Skipping ${model.displayName} — ${reason}`);
      failureReasons.push(reason);
      continue;
    }

    // 3. Clamp max output tokens to BOTH model.maxOutputTokens AND model.maxRequestTokens
    const clampedMaxTokens = Math.min(maxTokens, model.maxOutputTokens, model.maxRequestTokens);

    // 4. Try API Call (up to 2 attempts with fast backoff on rate-limit or transient errors)
    console.log(`  🤖 Trying ${model.displayName} (${model.id}) [max_tokens=${clampedMaxTokens}]...`);
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        let content: string | null = null;

        if (model.provider === 'groq') {
          content = await callGroqApi(prompt, model.id, clampedMaxTokens);
        } else if (model.provider === 'gemini') {
          content = await callGeminiApi(prompt, model.id, clampedMaxTokens);
        } else if (model.provider === 'mistral') {
          content = await callMistralApi(prompt, model.id, clampedMaxTokens);
        }

        if (content) {
          if (isOutputTruncated(content)) {
            const reason = `${model.displayName}: Output truncated (max_tokens=${clampedMaxTokens} too low)`;
            console.log(`  ⚠ ${model.displayName} — output truncated mid-code, trying next model...`);
            failureReasons.push(reason);
            break; // try next model
          }

          const fallbackUsed = i > 0 || failureReasons.length > 0;
          console.log(`  ✓ ${model.displayName} responded successfully${fallbackUsed ? ' (fallback)' : ''}`);
          return {
            content,
            modelUsed: model.displayName,
            fallbackUsed,
            fallbackReason: fallbackUsed ? failureReasons.join('; ') : undefined,
            failureReasons
          };
        }

        const reason = `${model.displayName}: Empty response received`;
        console.log(`  ⚠ ${model.displayName} — empty response`);
        failureReasons.push(reason);
        break;
      } catch (error: any) {
        const errDetail = error?.response?.data?.error?.message
          || error?.response?.data?.error?.status
          || (typeof error?.response?.data === 'string' ? error.response.data : '')
          || error?.message
          || 'Unknown error';

        // Check if it's a rate-limit error
        if (isRateLimitError(error)) {
          if (attempt < maxAttempts) {
            const parsedWaitMs = parseWaitTimeMs(errDetail);
            const waitMs = (parsedWaitMs && parsedWaitMs <= 15000) ? parsedWaitMs + 500 : 6000;
            console.log(`  ⏳ ${model.displayName} rate limited. Waiting ${(waitMs / 1000).toFixed(1)}s before retry (attempt ${attempt}/${maxAttempts})...`);
            await delay(waitMs);
            continue;
          }
          const reason = `${model.displayName}: Rate limit exceeded`;
          console.log(`  ⚠ ${model.displayName} — rate limit hit`);
          failureReasons.push(reason);
          break;
        }

        // Check if it's a retryable transient error (high demand, network timeout)
        if (isRetryableError(error) && attempt < maxAttempts) {
          console.log(`  ⏳ ${model.displayName} transient error. Retrying in 5s... (${errDetail.slice(0, 80)})`);
          await delay(5000);
          continue;
        }

        // Non-retryable or final attempt
        const reason = `${model.displayName}: ${errDetail.slice(0, 120)}`;
        console.log(`  ✗ ${model.displayName} — error: ${errDetail.slice(0, 120)}`);
        failureReasons.push(reason);
        break;
      }
    }
  }

  // All models failed
  console.error(`  ✗ All ${MODEL_CHAIN.length} models failed:`);
  failureReasons.forEach(r => console.error(`    • ${r}`));
  return null;
}

/**
 * Builds clear, formatted breakdown of why each model failed.
 */
export function buildAllModelsFailedMessage(failureReasons?: string[] | string): string {
  if (Array.isArray(failureReasons) && failureReasons.length > 0) {
    const list = failureReasons.map(r => `• ${r}`).join('\n');
    return `All AI models failed to generate tests:\n${list}\n\nTroubleshooting:\n- Check your internet connection.\n- Wait ~1 minute for Groq token limits to reset.\n- Ensure GEMINI_API_KEY is set in backend/.env.`;
  }
  if (typeof failureReasons === 'string') {
    return `All AI models failed: ${failureReasons}`;
  }
  return 'All AI models failed to generate tests. Please check your API keys and rate limits.';
}
