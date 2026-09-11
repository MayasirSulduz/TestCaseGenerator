import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const envConfig = {
  port: parseInt(process.env.PORT || process.env.FLASK_PORT || '5000', 10),
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqApiUrl: process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
  defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  maxIterations: 3,
  corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173']
};
