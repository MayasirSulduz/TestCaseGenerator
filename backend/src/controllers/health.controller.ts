import { Request, Response } from 'express';
import { envConfig } from '../config/env.config';
import { checkRuntimeEnvironment } from '../utils/systemEnv';

export function handleHealthCheck(_req: Request, res: Response): void {
  const env = checkRuntimeEnvironment();

  res.json({
    status: 'success',
    message: 'Node.js TypeScript Test Generator Backend is running',
    version: '1.0.0',
    groq_api_key_set: Boolean(envConfig.groqApiKey),
    runtime_environment: env
  });
}
