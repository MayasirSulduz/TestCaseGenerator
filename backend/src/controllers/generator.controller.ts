import { Request, Response } from 'express';
import { detectFramework } from '../services/detector.service';
import { generateTestsWithCoverage } from '../services/generator.service';
import { callLLMWithFallback } from '../services/llm.service';
import { DetectFrameworkRequestDTO, GenerateTestsRequestDTO } from '../types';
import { extractCodeFromMarkdown } from '../utils/codeParser';

export async function handleGenerateTests(req: Request, res: Response): Promise<void> {
  try {
    const dto: GenerateTestsRequestDTO = req.body || {};

    if (!dto.code || !dto.code.trim()) {
      res.status(400).json({
        status: 'error',
        message: 'No source code provided'
      });
      return;
    }

    const result = await generateTestsWithCoverage(dto);

    if (result.status === 'error') {
      res.status(500).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error in handleGenerateTests:', error);
    res.status(500).json({
      status: 'error',
      message: error?.message || 'Internal Server Error'
    });
  }
}

export async function handleGenerateTestsStream(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const dto: GenerateTestsRequestDTO = req.body || {};

    if (!dto.code || !dto.code.trim()) {
      sendEvent('error', { message: 'No source code provided' });
      res.end();
      return;
    }

    const onLog = (tag: string, text: string) => {
      sendEvent('log', { tag, text });
    };

    const onTrial = (trial: any) => {
      sendEvent('trial', trial);
    };

    const result = await generateTestsWithCoverage(dto, onLog, onTrial);

    sendEvent('done', result);
    sendEvent('result', result);
    res.end();
  } catch (error: any) {
    console.error('Error in handleGenerateTestsStream:', error);
    sendEvent('error', { message: error?.message || 'Internal Server Error' });
    res.end();
  }
}

export function handleDetectFramework(req: Request, res: Response): void {
  try {
    const dto: DetectFrameworkRequestDTO = req.body || {};
    const filename = dto.filename || '';

    const result = detectFramework(filename);
    res.json(result);
  } catch (error: any) {
    console.error('Error in handleDetectFramework:', error);
    res.status(500).json({
      status: 'error',
      message: error?.message || 'Failed to detect framework'
    });
  }
}

export async function handleFixTests(req: Request, res: Response): Promise<void> {
  try {
    const { testCode, errorMessage, sourceCode, framework, language } = req.body || {};

    const prompt = `Fix the following ${framework} test code for ${language} that failed with an error.

Source Code:
\`\`\`${language?.toLowerCase() || ''}
${sourceCode || ''}
\`\`\`

Failing Test Code:
\`\`\`${language?.toLowerCase() || ''}
${testCode || ''}
\`\`\`

Error Message:
${errorMessage || ''}

Return ONLY the corrected test code with no markdown formatting or commentary.`;

    const llmResult = await callLLMWithFallback(prompt, 3000);
    if (!llmResult) {
      res.status(500).json({ status: 'error', message: 'All AI models failed to fix test code. Please check your API keys.' });
      return;
    }

    res.json({
      status: 'success',
      tests: extractCodeFromMarkdown(llmResult.content),
      modelUsed: llmResult.modelUsed,
      fallbackUsed: llmResult.fallbackUsed,
      fallbackReason: llmResult.fallbackReason
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Failed to fix test code' });
  }
}

export async function handleAnalyzeCoverage(req: Request, res: Response): Promise<void> {
  try {
    const { code, language, framework, filename } = req.body || {};
    const result = await generateTestsWithCoverage({
      code,
      language: language || 'JavaScript',
      framework: framework || 'Jest',
      filename: filename || 'app'
    });

    res.json({
      status: 'success',
      coverageReport: result.coverageReport
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Failed to analyze coverage' });
  }
}
