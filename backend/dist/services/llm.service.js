"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGroqApi = callGroqApi;
const axios_1 = __importDefault(require("axios"));
const env_config_1 = require("../config/env.config");
async function callGroqApi(prompt, model, maxTokens = 6000) {
    if (!env_config_1.envConfig.groqApiKey) {
        console.error('ERROR: GROQ_API_KEY is not configured in environment variables.');
        return null;
    }
    const payload = {
        model: model || env_config_1.envConfig.defaultModel,
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
    try {
        const response = await axios_1.default.post(env_config_1.envConfig.groqApiUrl, payload, {
            headers: {
                Authorization: `Bearer ${env_config_1.envConfig.groqApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
        if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content;
        }
        console.error('Groq API Unexpected response structure:', response.data);
        return null;
    }
    catch (error) {
        console.error('Groq API Request failed:', error?.response?.data || error?.message || error);
        return null;
    }
}
