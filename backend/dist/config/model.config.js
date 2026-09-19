"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_CHAIN = void 0;
/**
 * Ordered fallback chain across Gemini, Mistral AI, and Groq providers.
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
        id: 'codestral-latest',
        provider: 'mistral',
        displayName: 'Codestral (Mistral AI)',
        contextWindow: 32_768,
        maxOutputTokens: 8_192,
        maxRequestTokens: 4_096,
        freeTierTPM: 100_000
    },
    {
        id: 'mistral-small-latest',
        provider: 'mistral',
        displayName: 'Mistral Small (Mistral AI)',
        contextWindow: 32_768,
        maxOutputTokens: 8_192,
        maxRequestTokens: 4_096,
        freeTierTPM: 100_000
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
        id: 'openai/gpt-oss-20b',
        provider: 'groq',
        displayName: 'GPT-OSS 20B',
        contextWindow: 131_072,
        maxOutputTokens: 8_192,
        maxRequestTokens: 3_000,
        freeTierTPM: 30_000
    },
    {
        id: 'qwen/qwen3.8-27b',
        provider: 'groq',
        displayName: 'Qwen 3.8 27B',
        contextWindow: 131_072,
        maxOutputTokens: 8_192,
        maxRequestTokens: 900,
        freeTierTPM: 30_000
    }
];
