// chanhed to ts 
import axios from 'axios';
import {
  FrameworkDetectionResult,
  GenerateTestsResult,
  HealthCheckResult
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000' : '');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes for large files with 7-part chunked generation & coverage iterations
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    } else if (error.request) {
      console.error('API No Response:', error.request);
    } else {
      console.error('API Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const checkHealth = async (): Promise<HealthCheckResult> => {
  try {
    const response = await api.get<HealthCheckResult>('/api/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

export const detectFramework = async (filename: string): Promise<FrameworkDetectionResult> => {
  try {
    const response = await api.post<FrameworkDetectionResult>('/api/detect-framework', { filename });
    return response.data;
  } catch (error: any) {
    console.error('Framework detection failed:', error);
    return {
      status: 'error',
      framework: 'Jest',
      language: 'JavaScript',
      extension: '',
      availableFrameworks: ['Jest'],
      error: error?.message || 'Framework detection failed'
    };
  }
};

export const generateTests = async (
  code: string,
  language: string,
  framework: string,
  coverageTarget: number,
  filename?: string
): Promise<GenerateTestsResult> => {
  try {
    const response = await api.post<GenerateTestsResult>('/api/generate-tests', {
      code,
      language,
      framework,
      coverageTarget,
      filename
    });
    return response.data;
  } catch (error: any) {
    console.error('Test generation failed:', error);
    throw error;
  }
};

export const generateTestsStream = async (
  code: string,
  language: string,
  framework: string,
  coverageTarget: number,
  filename?: string,
  onLog?: (tag: string, text: string) => void,
  onTrial?: (trial: any) => void
): Promise<GenerateTestsResult> => {
  const url = `${API_BASE_URL}/api/generate-tests-stream`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language, framework, coverageTarget, filename })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stream request failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream not supported by browser environment.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: GenerateTestsResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? ''; // keep trailing buffer

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      let eventType = 'message';
      let dataStr = '';

      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) {
          eventType = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          dataStr = line.replace('data:', '').trim();
        }
      }

      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (eventType === 'log') {
            onLog?.(parsed.tag, parsed.text);
          } else if (eventType === 'trial') {
            onTrial?.(parsed);
          } else if (eventType === 'done' || eventType === 'result') {
            finalResult = parsed;
          } else if (eventType === 'error') {
            throw new Error(parsed.message || 'Stream server error');
          }
        } catch (e: any) {
          if (eventType === 'error') throw e;
        }
      }
    }
  }

  // Check remaining trailing buffer if stream ended
  if (!finalResult && buffer.trim()) {
    let eventType = 'message';
    let dataStr = '';
    for (const line of buffer.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        dataStr = line.replace('data:', '').trim();
      }
    }
    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        if (eventType === 'done' || eventType === 'result') {
          finalResult = parsed;
        }
      } catch (e) {}
    }
  }

  if (!finalResult) {
    throw new Error('Stream ended without returning complete test generation response');
  }

  return finalResult;
};

export const fixTests = async (
  testCode: string,
  errorMessage: string,
  sourceCode: string,
  framework: string,
  language: string
): Promise<GenerateTestsResult> => {
  try {
    const response = await api.post<GenerateTestsResult>('/api/fix-tests', {
      testCode,
      errorMessage,
      sourceCode,
      framework,
      language
    });
    return response.data;
  } catch (error) {
    console.error('Test fixing failed:', error);
    throw error;
  }
};

export const analyzeCoverage = async (
  code: string,
  tests: string,
  language?: string,
  framework?: string
): Promise<GenerateTestsResult> => {
  try {
    const response = await api.post<GenerateTestsResult>('/api/analyze-coverage', {
      code,
      tests,
      language,
      framework
    });
    return response.data;
  } catch (error) {
    console.error('Coverage analysis failed:', error);
    throw error;
  }
};

export default api;
