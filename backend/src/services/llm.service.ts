import axios from 'axios';
import { envConfig } from '../config/env.config';

export async function callGroqApi(
  prompt: string,
  model?: string,
  maxTokens: number = 6000
): Promise<string | null> {
  if (!envConfig.groqApiKey) {
    console.error('ERROR: GROQ_API_KEY is not configured in environment variables.');
    return null;
  }

  const payload = {
    model: model || envConfig.defaultModel,
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
    const response = await axios.post(envConfig.groqApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${envConfig.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }

    console.error('Groq API Unexpected response structure:', response.data);
    return null;
  } catch (error: any) {
    console.error('Groq API Request failed:', error?.response?.data || error?.message || error);
    return null;
  }
}
