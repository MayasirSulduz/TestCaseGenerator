"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTestsWithCoverage = generateTestsWithCoverage;
const env_config_1 = require("../config/env.config");
const codeParser_1 = require("../utils/codeParser");
const chunker_service_1 = require("./chunker.service");
const llm_service_1 = require("./llm.service");
const javascript_runner_1 = require("./runners/javascript.runner");
const java_runner_1 = require("./runners/java.runner");
const python_runner_1 = require("./runners/python.runner");
const typescript_runner_1 = require("./runners/typescript.runner");
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function getRunnerForLanguage(language) {
    switch (language) {
        case 'Python':
            return new python_runner_1.PythonRunner();
        case 'JavaScript':
            return new javascript_runner_1.JavaScriptRunner();
        case 'TypeScript':
            return new typescript_runner_1.TypeScriptRunner();
        case 'Java':
            return new java_runner_1.JavaRunner();
        default:
            return null;
    }
}
function truncateCodeForPrompt(code, maxLines = 250) {
    if (!code)
        return '';
    const lines = code.split('\n');
    if (lines.length <= maxLines)
        return code;
    return lines.slice(0, maxLines).join('\n') + `\n\n... [truncated ${lines.length - maxLines} lines for model context safety]`;
}
function generateSuggestions(currentCoverage, targetCoverage, testPassed) {
    const suggestions = [];
    if (testPassed && currentCoverage >= targetCoverage) {
        suggestions.push(`✓ Target coverage ${targetCoverage}% achieved and all tests passed!`);
        suggestions.push('Consider adding integration tests for real-world scenarios');
        suggestions.push('Review test quality and add edge case assertions');
    }
    else if (!testPassed) {
        suggestions.push('🤖 AI Auto-Repair Agent triggered: fixing failing assertions & execution errors');
        suggestions.push('Ensure mock implementations match component interfaces');
    }
    else {
        suggestions.push(`Current coverage is ${currentCoverage}%, below target ${targetCoverage}%`);
        suggestions.push('Review uncovered branch conditions in source code');
        suggestions.push('Ensure test data handles empty, null, and boundary conditions');
    }
    return suggestions;
}
// ── Prompt Builders ───────────────────────────────────────────────────────────
function buildInitialPrompt(sourceCode, language, framework, coverageTarget, filename, moduleName) {
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
function buildRepairPrompt(sourceCode, testCode, errOutput, language, framework, filename) {
    const moduleName = filename.replace(/\.(py|java|js|ts|jsx|tsx)$/i, '').replace(/-/g, '_');
    const safeErr = (errOutput || '').length > 3000 ? (errOutput || '').slice(-3000) : (errOutput || '');
    const safeSource = truncateCodeForPrompt(sourceCode, 350);
    return `The generated ${framework} test suite for ${language} failed during local execution.

Module name: ${moduleName}
Filename: ${filename}

Source Code (Reference Implementation):
\`\`\`${language.toLowerCase()}
${safeSource}
\`\`\`

Test Execution Error Output:
\`\`\`
${safeErr}
\`\`\`

Current Failing Test Code:
\`\`\`${language.toLowerCase()}
${testCode}
\`\`\`

CRITICAL INSTRUCTIONS:
1. Compare the assertions in failing tests against the actual Source Code implementation above.
2. FIX all assertion errors, return value mismatches, wrong function signatures, and wrong arguments.
3. For Python: Ensure imports include: from ${moduleName} import * and import ${moduleName}
4. Look at the error output carefully — fix the EXACT issue described in each failed test.
5. Return ONLY the complete corrected test file with ALL tests. No markdown formatting, no explanations.
`;
}
function extractMissingLinesContext(sourceCode, missingLinesStr) {
    if (!missingLinesStr || missingLinesStr === 'None') {
        return truncateCodeForPrompt(sourceCode, 350);
    }
    const lines = sourceCode.split('\n');
    const targetLineSet = new Set();
    const parts = missingLinesStr.split(',');
    for (const part of parts) {
        const range = part.trim().split('-');
        if (range.length === 2) {
            const start = parseInt(range[0], 10);
            const end = parseInt(range[1], 10);
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++)
                    targetLineSet.add(i);
            }
        }
        else if (range.length === 1) {
            const lineNum = parseInt(range[0], 10);
            if (!isNaN(lineNum))
                targetLineSet.add(lineNum);
        }
    }
    if (targetLineSet.size === 0) {
        return truncateCodeForPrompt(sourceCode, 350);
    }
    const includedLines = new Set();
    for (const lineNum of targetLineSet) {
        for (let i = Math.max(1, lineNum - 15); i <= Math.min(lines.length, lineNum + 15); i++) {
            includedLines.add(i);
        }
    }
    const sortedNums = Array.from(includedLines).sort((a, b) => a - b);
    const resultLines = [];
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
function buildEnhancementPrompt(sourceCode, testCode, currentCoverage, targetCoverage, missingLines, language, moduleName) {
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
// ── Chunked Generation ────────────────────────────────────────────────────────
async function generateTestsForChunks(sourceCode, language, framework, coverageTarget, filename, moduleName) {
    const chunks = (0, chunker_service_1.chunkCode)(sourceCode, language, 7);
    console.log(`📦 Large file detected — splitting into ${chunks.length} chunks (7 parts)`);
    const chunkResults = [];
    let lastLLMResult = null;
    const allFailures = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`  📝 Part ${i + 1}/${chunks.length}: ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})`);
        const chunkPrompt = buildInitialPrompt(chunk.code, language, framework, coverageTarget, filename, moduleName);
        const result = await (0, llm_service_1.callLLMWithFallback)(chunkPrompt, 3500);
        if (!result) {
            console.warn(`  ⚠ Part ${i + 1} failed — skipping`);
            allFailures.push(`Part ${i + 1} (${chunk.name}): all fallback models failed`);
            continue;
        }
        lastLLMResult = result;
        let code = (0, codeParser_1.sanitizeTestImports)((0, codeParser_1.extractCodeFromMarkdown)(result.content));
        if (language === 'Python') {
            code = (0, codeParser_1.fixPythonImports)(code, moduleName);
        }
        chunkResults.push(code);
        console.log(`  ✓ Part ${i + 1}/${chunks.length} testcases generated and appended successfully!`);
        // Pause between chunks — Gemini free tier has low RPM, Groq has low TPM.
        // 10s gap balances rate limit recovery with total generation time.
        if (i < chunks.length - 1) {
            const waitSec = 4;
            console.log(`  ⏳ Waiting ${waitSec}s before next part (rate limit cooldown)...`);
            await delay(waitSec * 1000);
        }
    }
    if (chunkResults.length === 0 || !lastLLMResult) {
        return null;
    }
    let mergedCode = (0, chunker_service_1.mergeTestChunks)(chunkResults, language);
    if (language === 'Python') {
        mergedCode = (0, codeParser_1.fixPythonImports)(mergedCode, moduleName);
    }
    console.log(`  ✅ All ${chunks.length} parts generated and merged into complete test suite!`);
    return { testCode: mergedCode, llmResult: lastLLMResult, allFailures };
}
// ── Main Entry Point ──────────────────────────────────────────────────────────
async function generateTestsWithCoverage(request) {
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
    let testCode;
    let modelUsed = 'Unknown';
    let fallbackUsed = false;
    let fallbackReason;
    if ((0, chunker_service_1.shouldChunk)(sourceCode)) {
        console.log('📦 Source code exceeds chunk threshold — using chunked generation...');
        const chunkedResult = await generateTestsForChunks(sourceCode, language, framework, coverageTarget, filename, moduleName);
        if (!chunkedResult) {
            return {
                status: 'error',
                message: (0, llm_service_1.buildAllModelsFailedMessage)('All models exhausted during chunked generation. Check backend logs for per-model details.')
            };
        }
        testCode = chunkedResult.testCode;
        modelUsed = chunkedResult.llmResult.modelUsed;
        fallbackUsed = chunkedResult.llmResult.fallbackUsed;
        fallbackReason = chunkedResult.llmResult.fallbackReason;
    }
    else {
        console.log('Calling LLM for initial test generation...');
        const initialPrompt = buildInitialPrompt(sourceCode, language, framework, coverageTarget, filename, moduleName);
        const llmResult = await (0, llm_service_1.callLLMWithFallback)(initialPrompt, 3000);
        if (!llmResult) {
            return {
                status: 'error',
                message: (0, llm_service_1.buildAllModelsFailedMessage)('All models failed for single-shot generation. Check backend logs for per-model details.')
            };
        }
        modelUsed = llmResult.modelUsed;
        fallbackUsed = llmResult.fallbackUsed;
        fallbackReason = llmResult.fallbackReason;
        testCode = (0, codeParser_1.sanitizeTestImports)((0, codeParser_1.extractCodeFromMarkdown)(llmResult.content));
        if (language === 'Python') {
            testCode = (0, codeParser_1.fixPythonImports)(testCode, moduleName);
        }
    }
    // ── Step 2: Iterative coverage loop ─────────────────────────────────────
    const runner = getRunnerForLanguage(language);
    let coverageResult = null;
    let iteration = 1;
    const maxIterations = env_config_1.envConfig.maxIterations;
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
                    console.log(`⚠️ Test execution failed. Triggering AI Auto-Repair Agent...`);
                    const fullErr = coverageResult.stderr || coverageResult.stdout || coverageResult.error || 'Test suite failed execution';
                    const errOutput = fullErr.length > 3000 ? fullErr.slice(-3000) : fullErr;
                    nextPrompt = buildRepairPrompt(sourceCode, testCode, errOutput, language, framework, filename);
                }
                else {
                    console.log(`Coverage ${currentCoverage}% < ${coverageTarget}%. Triggering Coverage Enhancement Agent...`);
                    const missingLines = coverageResult.missing_lines || 'All lines';
                    nextPrompt = buildEnhancementPrompt(sourceCode, testCode, currentCoverage, coverageTarget, missingLines, language, moduleName);
                }
                // Brief cooldown before hitting LLM again for refinement pass
                await delay(4000);
                const improvedResult = await (0, llm_service_1.callLLMWithFallback)(nextPrompt, 3000);
                if (improvedResult) {
                    if (improvedResult.fallbackUsed && !fallbackUsed) {
                        fallbackUsed = true;
                        fallbackReason = improvedResult.fallbackReason;
                    }
                    modelUsed = improvedResult.modelUsed;
                    let newCode = (0, codeParser_1.sanitizeTestImports)((0, codeParser_1.extractCodeFromMarkdown)(improvedResult.content));
                    if (language === 'Python') {
                        newCode = (0, codeParser_1.fixPythonImports)(newCode, moduleName);
                    }
                    // Always merge new/repaired test blocks into testCode to PRESERVE all previously passing tests!
                    testCode = (0, chunker_service_1.mergeTestChunks)([testCode, newCode], language);
                }
                else {
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
    }
    else if (language === 'JavaScript') {
        runCommand = framework === 'Jest' ? `npx jest ${moduleName}.test.js --coverage` : `npx nyc mocha ${moduleName}.test.js`;
    }
    else if (language === 'TypeScript') {
        runCommand = framework === 'Jest' ? `npx jest ${moduleName}.test.ts --coverage` : `npx nyc mocha -r ts-node/register ${moduleName}.test.ts`;
    }
    else if (language === 'Java') {
        runCommand = 'mvn clean test';
    }
    const finalCoverage = coverageResult ? (coverageResult.coverage || 0) : 0;
    const missingLines = coverageResult ? (coverageResult.missing_lines || 'None') : 'All lines';
    const summaryTable = coverageResult
        ? (coverageResult.coverage_table || coverageResult.error || coverageResult.stderr || 'No execution table available')
        : 'Test runner unavailable';
    const finalTestPassed = coverageResult ? Boolean(coverageResult.test_passed) : false;
    const coverageReport = {
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
