import { execSync } from 'child_process';
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

function astValidate(code: string): { ok: boolean; error?: string } {
  try {
    execSync('python3 -c "import ast, sys; ast.parse(sys.stdin.read())"', {
      input: code,
      encoding: 'utf8',
      timeout: 5000
    });
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err.stderr || err.stdout || err.message || 'Python AST validation failed.'
    };
  }
}

function normalizeModelCode(text: string): string {
  return (text || '')
    .replace(/^```(?:python)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function looksTruncated(code: string): boolean {
  const trimmed = (code || '').trimEnd();
  return (
    trimmed.length === 0 ||
    /(?:["']|\(|\[|\{|\\)$/.test(trimmed) ||
    /\bdef\s+\w+\([^)]*$/.test(trimmed)
  );
}

function extractFailureBlock(stdout: string, nodeId: string): string {
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^_{5,}\\s*${escaped.replace(/.*?\.py::/, '')}[\\s\\S]*?(?=^_{5,}|^={5,}|^FAILED\\s|\\Z)`,
    'm'
  );
  const match = stdout.match(pattern);
  if (match) {
    return match[0].trim();
  }
  const failedLine = stdout
    .split('\n')
    .find((line) => line.startsWith(`FAILED ${nodeId}`));
  return failedLine ?? `No detailed failure block found for ${nodeId}`;
}

function validateRepairFunction(
  candidateFunction: string,
  expectedName: string
): { ok: boolean; error?: string } {
  const allowedStart =
    candidateFunction.startsWith(`def ${expectedName}(`) ||
    candidateFunction.startsWith(`@pytest.mark.asyncio\nasync def ${expectedName}(`) ||
    candidateFunction.startsWith(`@pytest.mark.asyncio\ndef ${expectedName}(`) ||
    candidateFunction.includes(`def ${expectedName}(`);

  if (!allowedStart) {
    return {
      ok: false,
      error: `Candidate must define only ${expectedName}.`
    };
  }

  if (candidateFunction.includes('asyncio.run(')) {
    return {
      ok: false,
      error: 'Async repair must not use asyncio.run().'
    };
  }

  if (looksTruncated(candidateFunction)) {
    return {
      ok: false,
      error: 'Repair output appears truncated.'
    };
  }

  return astValidate(candidateFunction);
}

function testNameFromNodeId(nodeId: string): string {
  const match = nodeId.match(/::([A-Za-z_]\w*)$/);
  if (!match) {
    throw new Error(`Invalid pytest node ID: ${nodeId}`);
  }
  return match[1];
}

function extractTestFunction(source: string, functionName: string): string {
  const pattern = new RegExp(
    `^(?:@[^\\n]+\\n)*def\\s+${functionName}\\s*\\([^\\n]*\\):[\\s\\S]*?(?=^(?:@[^\\n]+\\n)*def\\s+|\\Z)`,
    'm'
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Could not find test function: ${functionName}`);
  }
  return match[0].trimEnd();
}

function replaceTestFunction(
  suiteSource: string,
  functionName: string,
  replacement: string
): string {
  const pattern = new RegExp(
    `^(?:@[^\\n]+\\n)*def\\s+${functionName}\\s*\\([^\\n]*\\):[\\s\\S]*?(?=^(?:@[^\\n]+\\n)*def\\s+|\\Z)`,
    'm'
  );
  if (!pattern.test(suiteSource)) {
    throw new Error(`Cannot replace missing function: ${functionName}`);
  }
  return suiteSource.replace(pattern, `${replacement.trimEnd()}\n\n`);
}

function buildSingleTestRepairPrompt(input: {
  testName: string;
  failureOutput: string;
  currentTest: string;
  relevantAppSource: string;
}): string {
  return `
Repair exactly ONE pytest test function.

Return only valid Python code for this one function:
${input.testName}

Rules:
- Begin exactly with: def ${input.testName}( (or @pytest.mark.asyncio\nasync def ${input.testName}( if async)
- Do not return imports, markdown, explanation, fixtures, classes, helpers, or other tests.
- Do not modify app.py.
- Use the actual app.py behavior and constructor signatures provided.
- The function must parse with ast.parse.
- Do not use asyncio.run().
- If this is an async test, use @pytest.mark.asyncio and await the coroutine.

PYTEST FAILURE:
${input.failureOutput}

CURRENT TEST:
${input.currentTest}

RELEVANT app.py SOURCE:
${input.relevantAppSource}
`.trim();
}

function candidateImproved(
  baseline: CoverageResult,
  candidate: CoverageResult,
  repairedNodeId: string
): boolean {
  const candidateFailedTests = candidate.failedTests || [];
  const targetStillFails = candidateFailedTests.includes(repairedNodeId);
  const candidateFailedCount = candidate.failedCount ?? (candidate.test_passed ? 0 : 999);
  const baselineFailedCount = baseline.failedCount ?? (baseline.test_passed ? 0 : 999);
  const introducedFailures = candidateFailedCount > baselineFailedCount;

  return (
    !candidate.collectionError &&
    !targetStillFails &&
    !introducedFailures &&
    (candidateFailedCount < baselineFailedCount || Boolean(candidate.test_passed))
  );
}

function validatePython(code: string): { valid: boolean; error?: string } {
  const result = astValidate(code);
  return { valid: result.ok, error: result.error };
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

  // ── Step 2: Transactional Candidate-Based Iterative Loop ─────────────────

  const runner = getRunnerForLanguage(language);
  let coverageResult: CoverageResult | null = null;
  let iteration = 1;
  const maxIterations = envConfig.maxIterations;

  let lastKnownGoodTestCode = testCode;
  let lastExecutableCoverage = 0;
  let lastPassingCoverage = 0;

  if (runner) {
    while (iteration <= maxIterations) {
      console.log(`\n------------------------------------------------------------`);
      console.log(`Iteration ${iteration}/${maxIterations}: Running local test sandbox & coverage analysis...`);
      console.log(`------------------------------------------------------------`);

      coverageResult = await runner.runCoverage(sourceCode, lastKnownGoodTestCode, filename, framework);

      const currentCoverage = coverageResult.coverage || 0;
      const testPassed = Boolean(coverageResult.test_passed);

      if (currentCoverage > 0) {
        lastExecutableCoverage = Math.max(lastExecutableCoverage, currentCoverage);
      }
      if (testPassed) {
        lastPassingCoverage = Math.max(lastPassingCoverage, currentCoverage);
      }

      console.log(`Current Coverage: ${currentCoverage}% | Max Executable Coverage: ${lastExecutableCoverage}% | Tests Passed: ${testPassed}`);

      if (!testPassed) {
        const fullErr = (coverageResult.stderr || coverageResult.stdout || coverageResult.error || '');
        const errTail = fullErr.length > 2500 ? '... [truncated top] ...\n' + fullErr.slice(-2500) : fullErr;
        console.log(`\n  ── Pytest Output Summary ──`);
        console.log(errTail);
        console.log(`  ── End Output Summary ──\n`);
      }

      if (testPassed && currentCoverage >= coverageTarget) {
        console.log(`✓ Target coverage ${coverageTarget}% achieved and all tests passed!`);
        break;
      }

      if (iteration < maxIterations) {
        if (!testPassed) {
          const isSyntaxErr = (coverageResult.error || '').includes('AST SyntaxError');
          if (isSyntaxErr) {
            console.log(`⚠️ Syntax Error detected. Triggering Syntax Repair Attempt ${iteration}/${maxIterations}...`);
          } else {
            console.log(`⚠️ Test assertions failed. Triggering Test Execution Iteration ${iteration}/${maxIterations}...`);
          }

          const fullErr = [coverageResult.stdout, coverageResult.stderr, coverageResult.error].filter(Boolean).join('\n');
          
          if (language === 'Python' && !isSyntaxErr) {
            // Targeted node-ID based single-function repair loop
            const failedNodeIds = (coverageResult.failedTests && coverageResult.failedTests.length > 0)
              ? coverageResult.failedTests
              : [...fullErr.matchAll(/^FAILED\s+(.+?)(?:\s+-\s+.*)?$/gm)].map(m => m[1].trim()).filter(Boolean);

            if (failedNodeIds.length > 0) {
              console.log(`  🎯 Targeted repair for failed pytest node IDs: ${failedNodeIds.join(', ')}`);
              let currentBaseline = coverageResult;

              for (const nodeId of failedNodeIds) {
                let testName: string;
                try {
                  testName = testNameFromNodeId(nodeId);
                } catch {
                  continue;
                }

                let currentFuncCode = '';
                try {
                  currentFuncCode = extractTestFunction(lastKnownGoodTestCode, testName);
                } catch (err: any) {
                  console.warn(`  ⚠️ Could not extract function ${testName}: ${err.message}`);
                  continue;
                }

                const failureBlock = extractFailureBlock(
                  `${currentBaseline.stdout || ''}\n${currentBaseline.stderr || ''}`,
                  nodeId
                );

                const prompt = buildSingleTestRepairPrompt({
                  testName,
                  failureOutput: failureBlock,
                  currentTest: currentFuncCode,
                  relevantAppSource: extractMissingLinesContext(sourceCode, 'All lines')
                });

                await delay(2000);
                const rawRes = await callLLMWithFallback(prompt, 1200);
                if (!rawRes || !rawRes.content) {
                  console.warn(`  ❌ Repair attempt for ${testName} returned empty response.`);
                  continue;
                }

                const repairedFunc = normalizeModelCode(rawRes.content);
                const funcValidation = validateRepairFunction(repairedFunc, testName);

                if (!funcValidation.ok) {
                  console.warn(`  ❌ Rejected ${testName}: ${funcValidation.error}`);
                  continue;
                }

                let candidateSuite: string;
                try {
                  candidateSuite = replaceTestFunction(lastKnownGoodTestCode, testName, repairedFunc);
                } catch (err: any) {
                  console.warn(`  ❌ Rejected ${testName}: replace failed (${err.message})`);
                  continue;
                }

                const suiteSyntax = astValidate(candidateSuite);
                if (!suiteSyntax.ok) {
                  console.warn(`  ❌ Rejected ${testName}: merged candidate suite failed AST parse (${suiteSyntax.error?.slice(0, 100)}).`);
                  continue;
                }

                // Run candidate in sandbox
                const candidateRun = await runner.runCoverage(sourceCode, candidateSuite, filename, framework);

                if (!candidateImproved(currentBaseline, candidateRun, nodeId)) {
                  console.warn(`  ❌ Rejected candidate for ${testName}: no verified improvement (baseline failed: ${currentBaseline.failedCount ?? 0}, candidate failed: ${candidateRun.failedCount ?? 0}).`);
                  continue;
                }

                console.log(`  ✓ Promoted repair for ${testName}! Remaining failures: ${candidateRun.failedCount ?? 0}`);
                lastKnownGoodTestCode = candidateSuite;
                currentBaseline = candidateRun;

                if (candidateRun.coverage > 0) {
                  lastExecutableCoverage = Math.max(lastExecutableCoverage, candidateRun.coverage);
                }
                if (candidateRun.test_passed) {
                  lastPassingCoverage = Math.max(lastPassingCoverage, candidateRun.coverage);
                  break;
                }
              }
            } else {
              // Full file repair fallback with candidate validation gate & candidateImproved check
              await delay(3000);
              const nextPrompt = buildRepairPrompt(sourceCode, lastKnownGoodTestCode, fullErr.slice(-3000), language, framework, filename);
              const improvedResult = await callLLMWithFallback(nextPrompt, 3000);
              if (improvedResult && improvedResult.content) {
                let candidateCode = sanitizeTestImports(extractCodeFromMarkdown(improvedResult.content));
                candidateCode = fixPythonImports(candidateCode, moduleName);

                const suiteSyntax = astValidate(candidateCode);
                if (looksTruncated(candidateCode)) {
                  console.warn(`  ❌ Repair candidate rejected: model output appears truncated.`);
                } else if (!suiteSyntax.ok) {
                  console.warn(`  ❌ Repair candidate rejected: AST validation failed (${suiteSyntax.error?.slice(0, 100)}).`);
                } else {
                  const candidateRun = await runner.runCoverage(sourceCode, candidateCode, filename, framework);
                  if (!candidateRun.collectionError && candidateRun.coverage >= lastExecutableCoverage) {
                    console.log(`  ✓ Full-suite repair candidate promoted.`);
                    lastKnownGoodTestCode = candidateCode;
                  } else {
                    console.warn(`  ❌ Full-suite repair candidate rejected: did not improve run.`);
                  }
                }
              }
            }
          } else {
            // General repair pass
            await delay(3000);
            const nextPrompt = buildRepairPrompt(sourceCode, lastKnownGoodTestCode, fullErr.slice(-3000), language, framework, filename);
            const improvedResult = await callLLMWithFallback(nextPrompt, 3000);
            if (improvedResult && improvedResult.content) {
              let candidateCode = sanitizeTestImports(extractCodeFromMarkdown(improvedResult.content));
              if (language === 'Python') candidateCode = fixPythonImports(candidateCode, moduleName);

              if (language === 'Python' && !astValidate(candidateCode).ok) {
                console.warn(`  ❌ Repair candidate rejected: AST validation failed.`);
              } else {
                lastKnownGoodTestCode = candidateCode;
              }
            }
          }
        } else {
          console.log(`Coverage ${currentCoverage}% < ${coverageTarget}%. Triggering Coverage Expansion Iteration ${iteration}/${maxIterations}...`);
          const missingLines = coverageResult.missing_lines || 'All lines';
          const nextPrompt = buildEnhancementPrompt(
            sourceCode, lastKnownGoodTestCode, currentCoverage, coverageTarget, missingLines, language, moduleName
          );

          await delay(3000);
          const improvedResult = await callLLMWithFallback(nextPrompt, 3000);
          if (improvedResult && improvedResult.content) {
            let newCode = sanitizeTestImports(extractCodeFromMarkdown(improvedResult.content));
            if (language === 'Python') newCode = fixPythonImports(newCode, moduleName);

            const candidateCode = mergeTestChunks([lastKnownGoodTestCode, newCode], language);
            if (language === 'Python' && !validatePython(candidateCode).valid) {
              console.warn(`  ❌ Expansion candidate rejected: AST validation failed.`);
            } else {
              lastKnownGoodTestCode = candidateCode;
            }
          }
        }
      }

      iteration++;
    }
  }

  // ── Step 3: Run final measurement pass without --maxfail for full suite score ──
  if (runner && language === 'Python') {
    console.log(`\n📊 Running final full-suite measurement pass (without --maxfail limits)...`);
    const finalRun = await runner.runCoverage(sourceCode, lastKnownGoodTestCode, filename, framework, true);
    if (!finalRun.collectionError) {
      coverageResult = finalRun;
      if (finalRun.coverage > 0) {
        lastExecutableCoverage = Math.max(lastExecutableCoverage, finalRun.coverage);
      }
      if (finalRun.test_passed) {
        lastPassingCoverage = Math.max(lastPassingCoverage, finalRun.coverage);
      }
    }
  }

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

  const finalCoverage = Math.max(lastExecutableCoverage, lastPassingCoverage, coverageResult?.coverage || 0);
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
    tests: lastKnownGoodTestCode.trim(),
    coverageReport,
    modelUsed,
    fallbackUsed,
    fallbackReason
  };
}
