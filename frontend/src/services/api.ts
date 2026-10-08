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

type ConnectionListener = (connected: boolean, healthInfo?: HealthCheckResult) => void;
const connectionListeners = new Set<ConnectionListener>();

export const subscribeConnectionStatus = (listener: ConnectionListener) => {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
};

export const notifyConnectionStatus = (connected: boolean, healthInfo?: HealthCheckResult) => {
  connectionListeners.forEach((fn) => fn(connected, healthInfo));
};

api.interceptors.response.use(
  (response) => {
    notifyConnectionStatus(true);
    return response;
  },
  (error) => {
    if (error.response) {
      notifyConnectionStatus(true);
    }
    return Promise.reject(error);
  }
);

export const checkHealth = async (): Promise<HealthCheckResult> => {
  try {
    const response = await axios.get<HealthCheckResult>(`${API_BASE_URL}/api/health`, { timeout: 10000 });
    notifyConnectionStatus(true, response.data);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    notifyConnectionStatus(false);
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
  onTrial?: (trial: any) => void,
  existingTests?: string,
  targetMissingLines?: string
): Promise<GenerateTestsResult> => {
  try {
    const url = `${API_BASE_URL}/api/generate-tests-stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, framework, coverageTarget, filename, existingTests, targetMissingLines })
    });

    if (!response.ok) {
      console.warn(`Stream request failed with status ${response.status}. Falling back to standard API...`);
      return await generateTests(code, language, framework, coverageTarget, filename);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return await generateTests(code, language, framework, coverageTarget, filename);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: GenerateTestsResult | null = null;
    let eventType = '';
    let dataLines: string[] = [];

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) {
        if (dataLines.length > 0) {
          const fullDataStr = dataLines.join('\n');
          try {
            const parsed = JSON.parse(fullDataStr);
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
        eventType = '';
        dataLines = [];
        return;
      }

      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep trailing line snippet

      for (const line of lines) {
        processLine(line);
      }
    }

    // Process any remaining trailing buffer lines
    if (buffer) {
      processLine(buffer);
      processLine(''); // flush last event
    }

    if (!finalResult) {
      console.warn('SSE stream completed without finalResult payload. Falling back to standard POST API...');
      return await generateTests(code, language, framework, coverageTarget, filename);
    }

    return finalResult;
  } catch (error: any) {
    console.warn('Stream processing encountered error:', error?.message, '--> Triggering standard API fallback...');
    return await generateTests(code, language, framework, coverageTarget, filename);
  }
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
