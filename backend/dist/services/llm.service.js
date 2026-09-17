"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTokenCount = estimateTokenCount;
exports.callLLMWithFallback = callLLMWithFallback;
exports.buildAllModelsFailedMessage = buildAllModelsFailedMessage;
const axios_1 = __importDefault(require("axios"));
const env_config_1 = require("../config/env.config");
const model_config_1 = require("../config/model.config");
// ── Token Estimation ──────────────────────────────────────────────────────────
/**
 * Rough token estimate: ~4 characters per token (industry heuristic).
 * This is intentionally conservative to avoid over-sending.
 */
function estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
}
// ── Provider-Specific API Callers ─────────────────────────────────────────────
async function callGroqApi(prompt, model, maxTokens) {
    if (!env_config_1.envConfig.groqApiKey) {
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
    const response = await axios_1.default.post(env_config_1.envConfig.groqApiUrl, payload, {
        headers: {
            Authorization: `Bearer ${env_config_1.envConfig.groqApiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 90000
    });
    if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content;
    }
    return null;
}
async function callGeminiApi(prompt, model, maxTokens) {
    if (!env_config_1.envConfig.geminiApiKey) {
        return null;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env_config_1.envConfig.geminiApiKey}`;
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
    const response = await axios_1.default.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
    });
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
}
// ── Fallback Engine ───────────────────────────────────────────────────────────
/**
 * Detect whether an Axios error is a rate-limit / token-limit error.
 */
function isRateLimitError(error) {
    const status = error?.response?.status;
    if (status === 429)
        return true;
    const errData = error?.response?.data;
    const errMsg = typeof errData === 'string'
        ? errData
        : JSON.stringify(errData || '');
    return /rate.?limit|tokens?.per.?minute|tpm|too.?large|quota/i.test(errMsg);
}
function isApiKeyMissing(model) {
    if (model.provider === 'groq')
        return !env_config_1.envConfig.groqApiKey;
    if (model.provider === 'gemini')
        return !env_config_1.envConfig.geminiApiKey;
    return true;
}
/**
 * Core fallback engine.
 *
 * Iterates through MODEL_CHAIN in order. For each model:
 *  1. Skip if the provider's API key is not configured.
 *  2. Skip if the estimated prompt tokens + maxTokens exceeds the model's context window.
 *  3. Call the provider-specific API.
 *  4. On success → return immediately.
 *  5. On rate-limit / size error → log and try next model.
 *  6. On other error → log and try next model.
 *
 * Returns null only if ALL models fail.
 */
async function callLLMWithFallback(prompt, maxTokens = 3000) {
    const promptTokens = estimateTokenCount(prompt);
    const failureReasons = [];
    let firstModelIndex = 0;
    for (let i = 0; i < model_config_1.MODEL_CHAIN.length; i++) {
        const model = model_config_1.MODEL_CHAIN[i];
        // 1. API key check
        if (isApiKeyMissing(model)) {
            const reason = `${model.displayName}: API key not configured`;
            console.log(`  ⏭ Skipping ${model.displayName} — API key not configured`);
            failureReasons.push(reason);
            continue;
        }
        // 2. Context window check
        const totalTokens = promptTokens + maxTokens;
        if (totalTokens > model.contextWindow) {
            const reason = `${model.displayName}: Code too large (${totalTokens} tokens > ${model.contextWindow} context)`;
            console.log(`  ⏭ Skipping ${model.displayName} — ${reason}`);
            failureReasons.push(reason);
            continue;
        }
        // 3. Clamp maxTokens to model's max output
        const clampedMaxTokens = Math.min(maxTokens, model.maxOutputTokens);
        // 4. Call the appropriate provider
        console.log(`  🤖 Trying ${model.displayName} (${model.id})...`);
        try {
            let content = null;
            if (model.provider === 'groq') {
                content = await callGroqApi(prompt, model.id, clampedMaxTokens);
            }
            else if (model.provider === 'gemini') {
                content = await callGeminiApi(prompt, model.id, clampedMaxTokens);
            }
            if (content) {
                const fallbackUsed = i > firstModelIndex || failureReasons.length > 0;
                console.log(`  ✓ ${model.displayName} responded successfully${fallbackUsed ? ' (fallback)' : ''}`);
                return {
                    content,
                    modelUsed: model.displayName,
                    fallbackUsed,
                    fallbackReason: fallbackUsed ? failureReasons.join('; ') : undefined
                };
            }
            // Content was null but no exception
            const reason = `${model.displayName}: Empty response`;
            console.log(`  ⚠ ${model.displayName} — empty response, trying next...`);
            failureReasons.push(reason);
        }
        catch (error) {
            const isRateLimit = isRateLimitError(error);
            const errDetail = error?.response?.data?.error?.message
                || error?.response?.data?.error?.status
                || error?.message
                || 'Unknown error';
            if (isRateLimit) {
                const reason = `${model.displayName}: Rate/token limit exceeded`;
                console.log(`  ⚠ ${model.displayName} — rate limit hit, trying next...`);
                console.log(`    Detail: ${errDetail}`);
                failureReasons.push(reason);
            }
            else {
                const reason = `${model.displayName}: ${errDetail}`;
                console.log(`  ✗ ${model.displayName} — error: ${errDetail}`);
                failureReasons.push(reason);
            }
        }
    }
    // All models failed
    console.error(`  ✗ All ${model_config_1.MODEL_CHAIN.length} models failed: ${failureReasons.join(' | ')}`);
    return null;
}
/**
 * Collects the specific failure reasons into a human-readable message
 * for the frontend error display.
 */
function buildAllModelsFailedMessage(failureReasons) {
    const base = 'All AI models failed to generate tests.';
    if (failureReasons) {
        return `${base} Details: ${failureReasons}`;
    }
    return `${base} Please check your API keys and try again.`;
}
