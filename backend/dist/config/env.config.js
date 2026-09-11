"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
exports.envConfig = {
    port: parseInt(process.env.PORT || process.env.FLASK_PORT || '5000', 10),
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqApiUrl: process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    maxIterations: 3,
    corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173']
};
