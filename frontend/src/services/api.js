// import axios from 'axios';

// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// const api = axios.create({
//   baseURL: API_BASE_URL,
//   timeout: 60000, // 60 seconds for AI generation
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Health check
// export const checkHealth = async () => {
//   try {
//     const response = await api.get('/api/health');
//     return response.data;
//   } catch (error) {
//     console.error('Health check failed:', error);
//     throw error;
//   }
// };

// // Detect framework from filename
// export const detectFramework = async (filename) => {
//   try {
//     const response = await api.post('/api/detect-framework', { filename });
//     return response.data;
//   } catch (error) {
//     console.error('Framework detection failed:', error);
//     throw error;
//   }
// };

// // Generate test cases
// export const generateTests = async (code, language, framework, coverageTarget) => {
//   try {
//     const response = await api.post('/api/generate-tests', {
//       code,
//       language,
//       framework,
//       coverageTarget,
//     });
//     return response.data;
//   } catch (error) {
//     console.error('Test generation failed:', error);
//     throw error;
//   }
// };

// // Fix test cases
// export const fixTests = async (testCode, errorMessage, sourceCode, framework, language) => {
//   try {
//     const response = await api.post('/api/fix-tests', {
//       testCode,
//       errorMessage,
//       sourceCode,
//       framework,
//       language,
//     });
//     return response.data;
//   } catch (error) {
//     console.error('Test fixing failed:', error);
//     throw error;
//   }
// };

// // Analyze coverage
// export const analyzeCoverage = async (code, tests) => {
//   try {
//     const response = await api.post('/api/analyze-coverage', {
//       code,
//       tests,
//     });
//     return response.data;
//   } catch (error) {
//     console.error('Coverage analysis failed:', error);
//     throw error;
//   }
// };

// export default api;


















import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for AI generation
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error Response:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('API No Response:', error.request);
    } else {
      // Error in request setup
      console.error('API Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Health check
export const checkHealth = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Detect framework from filename
export const detectFramework = async (filename) => {
  try {
    console.log('Detecting framework for:', filename); // Debug log
    const response = await api.post('/api/detect-framework', { filename });
    console.log('Detection response:', response.data); // Debug log
    return response.data;
  } catch (error) {
    console.error('Framework detection failed:', error);
    // Return a fallback response instead of throwing
    return {
      status: 'error',
      framework: 'Jest',
      language: 'JavaScript',
      availableFrameworks: ['Jest'],
      error: error.message
    };
  }
};

// Generate test cases
export const generateTests = async (code, language, framework, coverageTarget) => {
  try {
    console.log('Generating tests with:', { language, framework, coverageTarget }); // Debug
    const response = await api.post('/api/generate-tests', {
      code,
      language,
      framework,
      coverageTarget,
    });
    return response.data;
  } catch (error) {
    console.error('Test generation failed:', error);
    throw error;
  }
};

// Fix test cases
export const fixTests = async (testCode, errorMessage, sourceCode, framework, language) => {
  try {
    const response = await api.post('/api/fix-tests', {
      testCode,
      errorMessage,
      sourceCode,
      framework,
      language,
    });
    return response.data;
  } catch (error) {
    console.error('Test fixing failed:', error);
    throw error;
  }
};

// Analyze coverage
export const analyzeCoverage = async (code, tests, language, framework) => {
  try {
    const response = await api.post('/api/analyze-coverage', {
      code,
      tests,
      language,
      framework,
    });
    return response.data;
  } catch (error) {
    console.error('Coverage analysis failed:', error);
    throw error;
  }
};

// Get coverage report (for the new endpoint)
export const getCoverageReport = async (code, tests, language, framework, filename) => {
  try {
    const response = await api.post('/api/get-coverage-report', {
      code,
      tests,
      language,
      framework,
      filename,
    });
    return response.data;
  } catch (error) {
    console.error('Coverage report failed:', error);
    throw error;
  }
};

export default api;

