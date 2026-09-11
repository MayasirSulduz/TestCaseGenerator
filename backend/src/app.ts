import cors from 'cors';
import express, { Application } from 'express';
import { envConfig } from './config/env.config';
import {
  handleAnalyzeCoverage,
  handleDetectFramework,
  handleFixTests,
  handleGenerateTests
} from './controllers/generator.controller';
import { handleHealthCheck } from './controllers/health.controller';

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || envConfig.corsOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.post('/api/generate-tests', handleGenerateTests);
  app.post('/api/detect-framework', handleDetectFramework);
  app.post('/api/fix-tests', handleFixTests);
  app.post('/api/analyze-coverage', handleAnalyzeCoverage);
  app.post('/api/get-coverage-report', handleAnalyzeCoverage);
  app.get('/api/health', handleHealthCheck);

  return app;
}
