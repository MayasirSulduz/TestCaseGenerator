import { envConfig } from '../config/env.config';
import {
  CoverageReportDTO,
  CoverageResult,
  GenerateTestsRequestDTO,
  GenerateTestsResponseDTO
} from '../types';
import { extractCodeFromMarkdown, fixPythonImports, sanitizeTestImports } from '../utils/codeParser';
import { chunkCode, mergeTestChunks, shouldChunk } from './chunker.service';
import { buildAllModelsFailedMessage, callLLMWithFallback, LLMCallResult } from './llm.service';
import { ITestRunner } from './runners/base.runner';
import { JavaScriptRunner } from './runners/javascript.runner';
import { JavaRunner } from './runners/java.runner';
import { PythonRunner } from './runners/python.runner';
import { TypeScriptRunner } from './runners/typescript.runner';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getRunnerForLanguage(language: string): ITestRunner | null {
  switch (language) {
    case 'Python':
      return new PythonRunner();
    case 'JavaScript':
      return new JavaScriptRunner();
    case 'TypeScript':
      return new TypeScriptRunner();
    case 'Java':
      return new JavaRunner();
    default:
      return null;
  }
}

function truncateCodeForPrompt(code: string, maxLines: number = 250): string {
  if (!code) return '';
  const lines = code.split('\n');
  if (lines.length <= maxLines) return code;
  return lines.slice(0, maxLines).join('\n') + `\n\n... [truncated ${lines.length - maxLines} lines for model context safety]`;
}

function generateSuggestions(currentCoverage: number, targetCoverage: number, testPassed: boolean): string[] {
  const suggestions: string[] = [];

  if (testPassed && currentCoverage >= targetCoverage) {
    suggestions.push(`✓ Target coverage ${targetCoverage}% achieved and all tests passed!`);
    suggestions.push('Consider adding integration tests for real-world scenarios');
    suggestions.push('Review test quality and add edge case assertions');
  } else if (!testPassed) {
    suggestions.push('🤖 AI Auto-Repair Agent triggered: fixing failing assertions & execution errors');
    suggestions.push('Ensure mock implementations match component interfaces');
  } else {
    suggestions.push(`Current coverage is ${currentCoverage}%, below target ${targetCoverage}%`);
    suggestions.push('Review uncovered branch conditions in source code');
    suggestions.push('Ensure test data handles empty, null, and boundary conditions');
  }

  return suggestions;
}

// ── Prompt Builders ───────────────────────────────────────────────────────────

function buildInitialPrompt(
  sourceCode: string,
  language: string,
  framework: string,
  coverageTarget: number,
  filename: string,
  moduleName: string
): string {
  return `Generate comprehensive unit tests using ${framework} for ${language}.

Target Coverage: ${coverageTarget}%

Source Code (filename: ${filename}):
\`\`\`${language.toLowerCase()}
${sourceCode}
\`\`\`

CRITICAL REQUIREMENTS:
1. For Python: The import statement MUST be: from ${moduleName} import *
2. For Java: Match the class names exactly from the source code
3. For JavaScript/TypeScript: Use proper module imports/exports (e.g. const { ... } = require('./${moduleName}'))
4. Write tests that cover ALL functions, methods, classes, and branches
5. Include edge cases, error handling, and boundary conditions
6. Use descriptive test names following ${framework} conventions
7. For React Testing Library: Use import '@testing-library/jest-dom'; (DO NOT use '@testing-library/jest-dom/extend-expect')
8. Mock external dependencies and sub-components if needed (for Jest relative path mocks, include virtual option e.g. jest.mock('./path', () => ..., { virtual: true }))
9. Return ONLY the test code, no markdown formatting, no explanations

IMPORTANT: The module/class name is "${moduleName}" - use this exact name in imports!

Generate the complete test file:
`;
}

function buildRepairPrompt(
  sourceCode: string,
  testCode: string,
  errOutput: string,
  language: string,
  framework: string,
  filename: string
): string {
  const safeSource = truncateCodeForPrompt(sourceCode, 200);
  const safeTests = truncateCodeForPrompt(testCode, 250);
  const safeErr = (errOutput || '').slice(0, 1200);

  return `The generated ${framework} test suite failed during local execution.

Test Execution Error Output:
\`\`\`
${safeErr}
\`\`\`

Source Code Excerpt (filename: ${filename}):
\`\`\`${language.toLowerCase()}
${safeSource}
\`\`\`

Current Failing Tests Excerpt:
\`\`\`${language.toLowerCase()}
${safeTests}
\`\`\`

CRITICAL: FIX the test code so that ALL tests pass cleanly with ZERO errors!
- Fix broken assertions, component mocks, syntax errors, and missing imports.
- Make sure all test cases pass.
- Return ONLY the complete corrected test file with no markdown formatting.
`;
}

function buildEnhancementPrompt(
  sourceCode: string,
  testCode: string,
  currentCoverage: number,
  targetCoverage: number,
  missingLines: string,
  language: string,
  moduleName: string
): string {
  const safeSource = truncateCodeForPrompt(sourceCode, 200);
  const safeTests = truncateCodeForPrompt(testCode, 250);

  return `The current test coverage is ${currentCoverage}%, but we need ${targetCoverage}%.

Missing/Uncovered Lines: ${missingLines}

Source Code Excerpt:
\`\`\`${language.toLowerCase()}
${safeSource}
\`\`\`

Current Tests Excerpt:
\`\`\`${language.toLowerCase()}
${safeTests}
\`\`\`

CRITICAL: For Python - Your imports MUST use: from ${moduleName} import *
CRITICAL: For React Testing Library - Use import '@testing-library/jest-dom'; (DO NOT use '@testing-library/jest-dom/extend-expect')

Generate ADDITIONAL test cases to cover the missing lines.

Requirements:
- Focus on lines: ${missingLines}
- Add new test functions (don't duplicate existing ones)
- Test edge cases, error paths, and boundary conditions
- Mock external dependencies if needed
- Return ONLY the COMPLETE test file with ALL tests (existing + new)
`;
}

// ── Chunked Generation ────────────────────────────────────────────────────────

async function generateTestsForChunks(
  sourceCode: string,
  language: string,
  framework: string,
  coverageTarget: number,
  filename: string,
  moduleName: string
): Promise<{ testCode: string; llmResult: LLMCallResult; allFailures: string[] } | null> {
  const chunks = chunkCode(sourceCode, language);
  console.log(`📦 Large file detected — splitting into ${chunks.length} chunks`);

  const chunkResults: string[] = [];
  let lastLLMResult: LLMCallResult | null = null;
  const allFailures: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  📝 Chunk ${i + 1}/${chunks.length}: ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})`);

    const chunkPrompt = buildInitialPrompt(
      chunk.code,
      language,
      framework,
      coverageTarget,
      filename,
      moduleName
    );

    const result = await callLLMWithFallback(chunkPrompt, 2000);
    if (!result) {
      console.warn(`  ⚠ Chunk ${i + 1} failed — skipping`);
      allFailures.push(`Chunk ${i + 1} (${chunk.name}): all fallback models failed`);
      continue;
    }

    lastLLMResult = result;
    let code = sanitizeTestImports(extractCodeFromMarkdown(result.content));
    if (language === 'Python') {
      code = fixPythonImports(code, moduleName);
    }
    chunkResults.push(code);

    // Pause between chunks — Qwen OTPM resets per minute, so we wait
    // long enough for the output-token bucket to partially refill
    if (i < chunks.length - 1) {
      const waitSec = 8;
      console.log(`  ⏳ Waiting ${waitSec}s before next chunk (rate limit cooldown)...`);
      await delay(waitSec * 1000);
    }
  }

  if (chunkResults.length === 0 || !lastLLMResult) {
    return null;
  }

  const mergedCode = mergeTestChunks(chunkResults, language);
  return { testCode: mergedCode, llmResult: lastLLMResult, allFailures };
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function generateTestsWithCoverage(
  request: GenerateTestsRequestDTO
): Promise<GenerateTestsResponseDTO> {
  const sourceCode = (request.code || '').trim();
  const language = request.language || 'JavaScript';
  const framework = request.framework || 'Jest';
  const coverageTarget = request.coverageTarget || 80;
  const filename = request.filename || 'app';

  if (!sourceCode) {
    return {
      status: 'error',
      message: 'No source code provided'
    };
  }

  console.log(`\n============================================================`);
  console.log(`Target Coverage: ${coverageTarget}%`);
  console.log(`Language: ${language} | Framework: ${framework}`);
  console.log(`Filename: ${filename}`);
  console.log(`============================================================\n`);

  const moduleName = filename
    .replace(/\.(py|java|js|ts|jsx|tsx)$/i, '')
    .replace(/-/g, '_');

  // ── Step 1: Generate initial tests (chunked or single-shot) ─────────────

  let testCode: string;
  let modelUsed: string = 'Unknown';
  let fallbackUsed = false;
  let fallbackReason: string | undefined;

  if (shouldChunk(sourceCode)) {
    console.log('📦 Source code exceeds chunk threshold — using chunked generation...');
    const chunkedResult = await generateTestsForChunks(
      sourceCode, language, framework, coverageTarget, filename, moduleName
    );

    if (!chunkedResult) {
      return {
        status: 'error',
        message: buildAllModelsFailedMessage(
          'All models exhausted during chunked generation. Check backend logs for per-model details.'
        )
      };
    }

    testCode = chunkedResult.testCode;
    modelUsed = chunkedResult.llmResult.modelUsed;
    fallbackUsed = chunkedResult.llmResult.fallbackUsed;
    fallbackReason = chunkedResult.llmResult.fallbackReason;
  } else {
    console.log('Calling LLM for initial test generation...');
    const initialPrompt = buildInitialPrompt(
      sourceCode, language, framework, coverageTarget, filename, moduleName
    );

    const llmResult = await callLLMWithFallback(initialPrompt, 3000);

    if (!llmResult) {
      return {
        status: 'error',
        message: buildAllModelsFailedMessage(
          'All models failed for single-shot generation. Check backend logs for per-model details.'
        )
      };
    }

    modelUsed = llmResult.modelUsed;
    fallbackUsed = llmResult.fallbackUsed;
    fallbackReason = llmResult.fallbackReason;

    testCode = sanitizeTestImports(extractCodeFromMarkdown(llmResult.content));
    if (language === 'Python') {
      testCode = fixPythonImports(testCode, moduleName);
    }
  }

  // ── Step 2: Iterative coverage loop ─────────────────────────────────────

  const runner = getRunnerForLanguage(language);
  let coverageResult: CoverageResult | null = null;
  let iteration = 1;
  const maxIterations = envConfig.maxIterations;

  if (runner) {
    while (iteration <= maxIterations) {
      console.log(`\n------------------------------------------------------------`);
      console.log(`Iteration ${iteration}/${maxIterations}: Running local test sandbox & coverage analysis...`);
      console.log(`------------------------------------------------------------`);

      coverageResult = await runner.runCoverage(sourceCode, testCode, filename, framework);

      const currentCoverage = coverageResult.coverage || 0;
      const testPassed = Boolean(coverageResult.test_passed);
      console.log(`Current Coverage: ${currentCoverage}% | Tests Passed: ${testPassed}`);

      // Stop loop if target coverage achieved and all tests passed cleanly
      if (testPassed && currentCoverage >= coverageTarget) {
        console.log(`✓ Target coverage ${coverageTarget}% achieved and tests passed!`);
        break;
      }

      if (iteration < maxIterations) {
        let nextPrompt = '';

        if (!testPassed) {
          console.log(`⚠️ Test execution failed. Triggering AI Auto-Repair Agent...`);
          const errOutput = coverageResult.stderr || coverageResult.stdout || coverageResult.error || 'Test suite failed execution';
          nextPrompt = buildRepairPrompt(sourceCode, testCode, errOutput, language, framework, filename);
        } else {
          console.log(`Coverage ${currentCoverage}% < ${coverageTarget}%. Triggering Coverage Enhancement Agent...`);
          const missingLines = coverageResult.missing_lines || 'All lines';
          nextPrompt = buildEnhancementPrompt(
            sourceCode, testCode, currentCoverage, coverageTarget, missingLines, language, moduleName
          );
        }

        // Brief cooldown before hitting the LLM again for refinement
        await delay(5000);
        const improvedResult = await callLLMWithFallback(nextPrompt, 3000);
        if (improvedResult) {
          if (improvedResult.fallbackUsed && !fallbackUsed) {
            fallbackUsed = true;
            fallbackReason = improvedResult.fallbackReason;
          }
          modelUsed = improvedResult.modelUsed;

          testCode = sanitizeTestImports(extractCodeFromMarkdown(improvedResult.content));
          if (language === 'Python') {
            testCode = fixPythonImports(testCode, moduleName);
          }
        } else {
          console.warn('Failed to receive response from LLM during refinement pass');
          break;
        }
      }

      iteration++;
    }
  }

  // ── Step 3: Build response ──────────────────────────────────────────────

  let runCommand = '';
  if (language === 'Python') {
    runCommand = `python3 -m pytest test_${moduleName}.py --cov=${moduleName} --cov-report=term-missing`;
  } else if (language === 'JavaScript') {
    runCommand = framework === 'Jest' ? `npx jest ${moduleName}.test.js --coverage` : `npx nyc mocha ${moduleName}.test.js`;
  } else if (language === 'TypeScript') {
    runCommand = framework === 'Jest' ? `npx jest ${moduleName}.test.ts --coverage` : `npx nyc mocha -r ts-node/register ${moduleName}.test.ts`;
  } else if (language === 'Java') {
    runCommand = 'mvn clean test';
  }

  const finalCoverage = coverageResult ? (coverageResult.coverage || 0) : 0;
  const missingLines = coverageResult ? (coverageResult.missing_lines || 'None') : 'All lines';
  const summaryTable = coverageResult
    ? (coverageResult.coverage_table || coverageResult.error || coverageResult.stderr || 'No execution table available')
    : 'Test runner unavailable';
  const finalTestPassed = coverageResult ? Boolean(coverageResult.test_passed) : false;

  const coverageReport: CoverageReportDTO = {
    totalCoverage: finalCoverage,
    runCommand,
    summaryTable,
    missingLines,
    suggestions: generateSuggestions(finalCoverage, coverageTarget, finalTestPassed),
    testPassed: finalTestPassed
  };

  return {
    status: 'success',
    tests: testCode.trim(),
    coverageReport,
    modelUsed,
    fallbackUsed,
    fallbackReason
  };
}
