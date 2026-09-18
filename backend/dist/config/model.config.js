"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_CHAIN = void 0;
/**
 * Ordered fallback chain — tried from first to last.
 *
 * Gemini 3.6 Flash is first because it has the highest capacity
 * (1M TPM, 65K max output) and won't truncate test code.
 * Groq models are fallback only — their free-tier OTPM limits
 * are too low for generating comprehensive test suites.
 */
exports.MODEL_CHAIN = [
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
        maxRequestTokens: 900, // OTPM hard limit is 1,000 — stay safely under
        freeTierTPM: 30_000
    }
];
