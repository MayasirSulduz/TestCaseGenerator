// chanhed to ts 
import axios from 'axios';
import {
  FrameworkDetectionResult,
  GenerateTestsResult,
  HealthCheckResult
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes for full test & coverage generation
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
