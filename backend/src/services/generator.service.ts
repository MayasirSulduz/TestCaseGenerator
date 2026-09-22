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
1. For Python:
   - Output ONLY valid, parseable Python syntax.
   - All \`def test_*():\` functions MUST be placed at the top level (column 0, zero indentation).
   - Use 4 spaces for function/class body indentation, NEVER use tabs.
   - The import statements MUST be: \`from ${moduleName} import *\` and \`import ${moduleName}\`.
   - Minimal, non-duplicate imports placed cleanly at the top of the file.
2. For Java: Match class names exactly from the source code.
3. For JavaScript/TypeScript: Use proper module imports/exports.
4. For React Testing Library: Use \`import '@testing-library/jest-dom';\` (DO NOT use '@testing-library/jest-dom/extend-expect').
5. Write tests that cover ALL functions, methods, classes, and branches.
6. Mock external dependencies if needed.
7. Return ONLY the raw code content. Do NOT include markdown code block fences or explanations.

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
  const moduleName = filename.replace(/\.(py|java|js|ts|jsx|tsx)$/i, '').replace(/-/g, '_');
  const safeErr = (errOutput || '').length > 3000 ? (errOutput || '').slice(-3000) : (errOutput || '');
  const safeSource = truncateCodeForPrompt(sourceCode, 350);

  return `You are an expert AI Auto-Repair Agent. The generated ${framework} test suite for ${language} failed during local execution / AST parsing.

Module name: ${moduleName}
Filename: ${filename}

Source Code (Reference Implementation):
\`\`\`${language.toLowerCase()}
${safeSource}
\`\`\`

Test Execution / AST Error Output:
\`\`\`
${safeErr}
\`\`\`

Current Failing Test Code:
\`\`\`${language.toLowerCase()}
${testCode}
\`\`\`

CRITICAL REPAIR INSTRUCTIONS:
1. Fix all SyntaxError, IndentationError, unexpected unindent, and AST parsing errors.
2. For Python:
   - Ensure all \`def test_*():\` functions are at the top level (column 0, zero indentation).
   - Use 4 spaces for body indentation, NEVER tabs.
   - Ensure imports include: \`from ${moduleName} import *\` and \`import ${moduleName}\`.
   - Keep imports minimal and non-duplicated at the top of the file.
3. Fix all assertion errors and argument mismatches by looking at the Source Code implementation.
4. If a test function cannot be fixed, remove or comment it out rather than outputting invalid syntax.
5. Return ONLY the complete corrected test file with ALL tests. Do NOT include markdown code block fences or explanations.
`;
}

function extractMissingLinesContext(sourceCode: string, missingLinesStr: string): string {
  if (!missingLinesStr || missingLinesStr === 'None') {
    return truncateCodeForPrompt(sourceCode, 350);
  }

  const lines = sourceCode.split('\n');
  const targetLineSet = new Set<number>();

  const parts = missingLinesStr.split(',');
  for (const part of parts) {
    const range = part.trim().split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) targetLineSet.add(i);
      }
    } else if (range.length === 1) {
      const lineNum = parseInt(range[0], 10);
      if (!isNaN(lineNum)) targetLineSet.add(lineNum);
    }
  }

  if (targetLineSet.size === 0) {
    return truncateCodeForPrompt(sourceCode, 350);
  }

  const includedLines = new Set<number>();
  for (const lineNum of targetLineSet) {
    for (let i = Math.max(1, lineNum - 15); i <= Math.min(lines.length, lineNum + 15); i++) {
      includedLines.add(i);
    }
  }

  const sortedNums = Array.from(includedLines).sort((a, b) => a - b);
  const resultLines: string[] = [];
  let prev = 0;

  for (const num of sortedNums) {
    if (prev > 0 && num > prev + 1) {
      resultLines.push(`... [lines ${prev + 1}-${num - 1} skipped] ...`);
    }
    resultLines.push(`Line ${num}: ${lines[num - 1]}`);
    prev = num;
  }

  return resultLines.join('\n');
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
  const safeSource = extractMissingLinesContext(sourceCode, missingLines);
  const safeTests = truncateCodeForPrompt(testCode, 300);

  return `The current test coverage is ${currentCoverage}%, but we need ${targetCoverage}%.

Missing/Uncovered Lines: ${missingLines}

Source Code Context (focused around missing lines):
\`\`\`${language.toLowerCase()}
${safeSource}
\`\`\`

Current Tests Excerpt:
\`\`\`${language.toLowerCase()}
${safeTests}
\`\`\`

CRITICAL: For Python - Your imports MUST use: from ${moduleName} import * and import ${moduleName}
CRITICAL: For React Testing Library - Use import '@testing-library/jest-dom'; (DO NOT use '@testing-library/jest-dom/extend-expect')

Generate ADDITIONAL unit test functions to specifically cover missing lines ${missingLines}.

Requirements:
- Write new test functions to execute lines: ${missingLines}
- Test edge cases, error paths, and boundary conditions
- Return ONLY valid test code with ALL tests (existing + new)
`;
}

import { execSync } from 'child_process';

function validatePython(code: string): { valid: boolean; error?: string } {
  try {
    execSync('python3 -c "import ast,sys; ast.parse(sys.stdin.read())"', {
      input: code,
      encoding: 'utf8',
      timeout: 5000
    });
    return { valid: true };
  } catch (err: any) {
    const errorMsg = err.stderr || err.stdout || err.message || 'SyntaxError during Python AST parse';
    return { valid: false, error: errorMsg };
  }
}

function cleanModelOutput(raw: string): string {
  let text = (raw || '')
    .replace(/```python/gi, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '    ')
    .trim();

  const lines = text.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (/^(import |from.+ import )/.test(trimmed)) return false;
    if (/^(Here('|')s|Explanation:|Test cases:|Notes?:|Summary:)/i.test(trimmed)) return false;
    if (trimmed.startsWith('```')) return false;
    return true;
  });

  let cleaned = filtered.join('\n').trim();

  // Strip invalid placeholder test_func
  if (/\bdef\s+test_func\s*\(/.test(cleaned) || /\btest_func\.\w+/.test(cleaned)) {
    cleaned = cleaned.replace(/def\s+test_func\s*\([^)]*\)[\s\S]*?(?=\ndef|\nclass|$)/g, '').trim();
  }

  return cleaned;
}

function buildChunkPrompt(
  chunkCode: string,
  moduleName: string
): string {
  return `You generate pytest unit tests for the provided Python source-code chunk.

Return ONLY Python test function definitions.

Hard rules:
1. Output zero or more complete top-level functions named test_*.
2. Every "def test_*" MUST begin at column 0.
3. Use exactly 4 spaces for nested code; never use tabs.
4. Do NOT generate imports.
5. Do NOT generate classes, decorators, markdown fences, prose, headings, comments, or explanations.
6. Do NOT use placeholder functions such as test_func.
7. Every test function must be independently complete and must end before another test begins.
8. Do not repeat tests from prior chunks.
9. If a valid test cannot be written for this chunk, return an empty response.

SOURCE MODULE NAME: ${moduleName}
SOURCE CHUNK:
\`\`\`python
${chunkCode}
\`\`\`
`;
}

function buildChunkRepairPrompt(
  brokenFragment: string,
  syntaxError: string,
  moduleName: string
): string {
  return `Repair the Python pytest test code below.

Output ONLY corrected Python code. Do not use markdown fences or explanations.

Rules:
- Return only complete top-level def test_*(): functions.
- Do not include imports.
- Each def test_* must start at column 0.
- Use four spaces for every nested block; no tabs.
- Do not create test_func placeholders.
- Preserve only tests that can be made syntactically valid.
- If a test is unclear, remove it rather than writing invalid Python.

SOURCE MODULE NAME: ${moduleName}
PYTHON SYNTAX ERROR:
${syntaxError}

BROKEN TEST FRAGMENT:
${brokenFragment}
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
  const chunks = chunkCode(sourceCode, language, 7);
  console.log(`📦 Large file detected — splitting into ${chunks.length} chunks (7 parts)`);

  const chunkResults: string[] = [];
  let lastLLMResult: LLMCallResult | null = null;
  const allFailures: string[] = [];

  const HEADER = `import pytest
from unittest.mock import MagicMock, patch, mock_open
import ${moduleName}
from ${moduleName} import *

`;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  📝 Part ${i + 1}/${chunks.length}: ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})`);

    const chunkPrompt = (language === 'Python')
      ? buildChunkPrompt(chunk.code, moduleName)
      : buildInitialPrompt(chunk.code, language, framework, coverageTarget, filename, moduleName);

    const result = await callLLMWithFallback(chunkPrompt, 3500);
    if (!result || !result.content) {
      console.warn(`  ⚠ Part ${i + 1} failed — skipping`);
      allFailures.push(`Part ${i + 1} (${chunk.name}): all fallback models failed`);
      continue;
    }

    lastLLMResult = result;

    if (language === 'Python') {
      let cleanedChunk = cleanModelOutput(result.content);
      if (!cleanedChunk) continue;

      let candidate = `${HEADER}${cleanedChunk}\n`;
      let validation = validatePython(candidate);

      if (!validation.valid) {
        console.warn(`  ⚠ Part ${i + 1} AST validation rejected: ${validation.error?.slice(0, 150)}`);
        console.log(`  🔧 Triggering small per-chunk repair agent for Part ${i + 1}...`);

        const repairPrompt = buildChunkRepairPrompt(cleanedChunk, validation.error || 'SyntaxError', moduleName);
        const repairedResult = await callLLMWithFallback(repairPrompt, 3000);

        if (repairedResult && repairedResult.content) {
          const repairedChunk = cleanModelOutput(repairedResult.content);
          const repairedCandidate = `${HEADER}${repairedChunk}\n`;
          const repairedValidation = validatePython(repairedCandidate);

          if (repairedValidation.valid) {
            console.log(`  ✓ Part ${i + 1}/${chunks.length} repaired & validated successfully!`);
            chunkResults.push(repairedChunk);
          } else {
            console.warn(`  ❌ Part ${i + 1} skipped after per-chunk repair failure.`);
          }
        } else {
          console.warn(`  ❌ Part ${i + 1} skipped — repair prompt returned empty.`);
        }
      } else {
        console.log(`  ✓ Part ${i + 1}/${chunks.length} testcases generated & validated successfully!`);
        chunkResults.push(cleanedChunk);
      }
    } else {
      let code = sanitizeTestImports(extractCodeFromMarkdown(result.content));
      chunkResults.push(code);
      console.log(`  ✓ Part ${i + 1}/${chunks.length} testcases generated and appended successfully!`);
    }

    if (i < chunks.length - 1) {
      await delay(1000);
    }
  }

  if (chunkResults.length === 0 || !lastLLMResult) {
    return null;
  }

  let mergedCode = (language === 'Python')
    ? `${HEADER}${chunkResults.join('\n\n')}\n`
    : mergeTestChunks(chunkResults, language);

  if (language === 'Python') {
    mergedCode = fixPythonImports(mergedCode, moduleName);
  }
  console.log(`  ✅ All ${chunks.length} parts generated, validated, and merged into complete test suite!`);
  return { testCode: mergedCode, llmResult: lastLLMResult, allFailures };
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function generateTestsWithCoverage(
  request: GenerateTestsRequestDTO
): Promise<GenerateTestsResponseDTO> {
  const startTime = Date.now();
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

      // ── Diagnostic: Log pytest output when tests fail ──
      if (!testPassed) {
        const fullErr = (coverageResult.stderr || coverageResult.stdout || coverageResult.error || '');
        // Extract the tail (last 2500 chars) where pytest prints exception tracebacks & syntax error line numbers
        const errTail = fullErr.length > 2500 ? '... [truncated top] ...\n' + fullErr.slice(-2500) : fullErr;
        console.log(`\n  ── Pytest Error Output ──`);
        console.log(errTail);
        console.log(`  ── End Pytest Error ──`);

        // Log first 15 lines of generated test code for diagnosis
        const testLines = testCode.split('\n').slice(0, 15).join('\n');
        console.log(`\n  ── Generated Test Code (first 15 lines) ──`);
        console.log(testLines);
        console.log(`  ── End Test Code Snippet ──\n`);
      }

      // Stop loop if target coverage achieved and all tests passed cleanly
      if (testPassed && currentCoverage >= coverageTarget) {
        console.log(`✓ Target coverage ${coverageTarget}% achieved and tests passed!`);
        break;
      }

      if (iteration < maxIterations) {
        let nextPrompt = '';

        if (!testPassed) {
          const isSyntaxErr = (coverageResult.error || '').includes('AST SyntaxError');
          if (isSyntaxErr) {
            console.log(`⚠️ AST Syntax Error detected. Triggering Syntax Repair Attempt ${iteration}/${maxIterations}...`);
          } else {
            console.log(`⚠️ Test execution failed. Triggering Test Execution Iteration ${iteration}/${maxIterations}...`);
          }

          const fullErr = [coverageResult.stdout, coverageResult.stderr, coverageResult.error].filter(Boolean).join('\n');
          const errOutput = fullErr.length > 3000 ? fullErr.slice(-3000) : fullErr;
          nextPrompt = buildRepairPrompt(sourceCode, testCode, errOutput, language, framework, filename);
        } else {
          console.log(`Coverage ${currentCoverage}% < ${coverageTarget}%. Triggering Coverage Expansion Iteration ${iteration}/${maxIterations}...`);
          const missingLines = coverageResult.missing_lines || 'All lines';
          nextPrompt = buildEnhancementPrompt(
            sourceCode, testCode, currentCoverage, coverageTarget, missingLines, language, moduleName
          );
        }

        // Brief cooldown before hitting LLM again for refinement pass
        await delay(4000);
        const improvedResult = await callLLMWithFallback(nextPrompt, 3000);
        if (improvedResult) {
          if (improvedResult.fallbackUsed && !fallbackUsed) {
            fallbackUsed = true;
            fallbackReason = improvedResult.fallbackReason;
          }
          modelUsed = improvedResult.modelUsed;

          let newCode = sanitizeTestImports(extractCodeFromMarkdown(improvedResult.content));
          if (language === 'Python') {
            newCode = fixPythonImports(newCode, moduleName);
          }

          if (!testPassed) {
            // Repair pass: replace testCode with the repaired version so broken tests aren't duplicated
            testCode = newCode;
          } else {
            // Coverage enhancement pass: merge new test blocks into existing test suite
            testCode = mergeTestChunks([testCode, newCode], language);
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

  const executionTimeMs = Date.now() - startTime;
  const executionTimeSec = (executionTimeMs / 1000).toFixed(1);
  console.log(`⏱️ Total processing completed in ${executionTimeSec}s`);

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
    testPassed: finalTestPassed,
    executionTimeSec
  };

  return {
    status: 'success',
    tests: testCode.trim(),
    coverageReport,
    modelUsed,
    fallbackUsed,
    fallbackReason,
    executionTimeSec
  };
}
