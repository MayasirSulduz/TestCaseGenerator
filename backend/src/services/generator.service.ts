import { envConfig } from '../config/env.config';
import {
  CoverageReportDTO,
  CoverageResult,
  GenerateTestsRequestDTO,
  GenerateTestsResponseDTO
} from '../types';
import { extractCodeFromMarkdown, fixPythonImports } from '../utils/codeParser';
import { callGroqApi } from './llm.service';
import { ITestRunner } from './runners/base.runner';
import { JavaScriptRunner } from './runners/javascript.runner';
import { JavaRunner } from './runners/java.runner';
import { PythonRunner } from './runners/python.runner';
import { TypeScriptRunner } from './runners/typescript.runner';

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

function generateSuggestions(currentCoverage: number, targetCoverage: number): string[] {
  const suggestions: string[] = [];

  if (currentCoverage >= targetCoverage) {
    suggestions.push(`✓ Target coverage ${targetCoverage}% achieved!`);
    suggestions.push('Consider adding integration tests for real-world scenarios');
    suggestions.push('Review test quality and add edge case assertions');
  } else {
    suggestions.push(`Coverage is currently ${currentCoverage}%, targeting ${targetCoverage}%`);
    suggestions.push('Review uncovered branch conditions in the source code');
    suggestions.push('Ensure mock data covers empty, null, and outlier inputs');
  }

  return suggestions;
}

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

  const initialPrompt = `Generate comprehensive unit tests using ${framework} for ${language}.

Target Coverage: ${coverageTarget}%

Source Code (filename: ${filename}):
\`\`\`${language.toLowerCase()}
${sourceCode}
\`\`\`

CRITICAL REQUIREMENTS:
1. For Python: The import statement MUST be: from ${moduleName} import *
2. For Java: Match the class names exactly from the source code
3. For JavaScript/TypeScript: Use proper module imports/exports
4. Write tests that cover ALL functions, methods, classes, and branches
5. Include edge cases, error handling, and boundary conditions
6. Use descriptive test names following ${framework} conventions
7. Mock external dependencies if needed
8. Return ONLY the test code, no markdown formatting, no explanations

IMPORTANT: The module/class name is "${moduleName}" - use this exact name in imports!

Generate the complete test file:
`;

  console.log('Calling Groq API for initial test generation...');
  let rawTestCode = await callGroqApi(initialPrompt, undefined, 6000);

  if (!rawTestCode) {
    return {
      status: 'error',
      message: 'LLM failed to generate tests. Please check your GROQ_API_KEY.'
    };
  }

  let testCode = extractCodeFromMarkdown(rawTestCode);
  if (language === 'Python') {
    testCode = fixPythonImports(testCode, moduleName);
  }

  const runner = getRunnerForLanguage(language);
  let coverageResult: CoverageResult | null = null;
  let iteration = 1;
  const maxIterations = envConfig.maxIterations;

  if (runner) {
    while (iteration <= maxIterations) {
      console.log(`\n------------------------------------------------------------`);
      console.log(`Iteration ${iteration}/${maxIterations}: Running coverage analysis...`);
      console.log(`------------------------------------------------------------`);

      coverageResult = await runner.runCoverage(sourceCode, testCode, filename, framework);

      if (!coverageResult.success && coverageResult.error) {
        console.warn(`Coverage analysis attempt failed: ${coverageResult.error}`);
      }

      const currentCoverage = coverageResult.coverage;
      console.log(`Current Coverage: ${currentCoverage}%`);

      if (currentCoverage >= coverageTarget) {
        console.log(`Target coverage ${coverageTarget}% achieved!`);
        break;
      }

      if (iteration < maxIterations) {
        console.log(
          `Coverage ${currentCoverage}% < ${coverageTarget}%. Prompting LLM for additional tests...`
        );
        const missingLines = coverageResult.missing_lines || 'Unknown';

        const improvePrompt = `The current test coverage is ${currentCoverage}%, but we need ${coverageTarget}%.

Missing/Uncovered Lines: ${missingLines}

Source Code (filename: ${filename}):
\`\`\`${language.toLowerCase()}
${sourceCode}
\`\`\`

Current Tests:
\`\`\`${language.toLowerCase()}
${testCode}
\`\`\`

CRITICAL: For Python - Your imports MUST use: from ${moduleName} import *

Generate ADDITIONAL test cases to cover the missing lines.

Requirements:
- For Python: Use the correct import: from ${moduleName} import *
- Focus on lines: ${missingLines}
- Add new test functions (don't duplicate existing ones)
- Test edge cases, error paths, and boundary conditions
- Mock external dependencies if needed
- Return ONLY the COMPLETE test file with ALL tests (existing + new)

Generate the improved test file:
`;

        const improvedRaw = await callGroqApi(improvePrompt, undefined, 6000);
        if (improvedRaw) {
          testCode = extractCodeFromMarkdown(improvedRaw);
          if (language === 'Python') {
            testCode = fixPythonImports(testCode, moduleName);
          }
        } else {
          console.warn('Failed to generate additional tests from LLM');
          break;
        }
      }

      iteration++;
    }
  }

  let coverageReport: CoverageReportDTO;

  if (coverageResult && (coverageResult.success || coverageResult.coverage > 0)) {
    const finalCoverage = coverageResult.coverage;
    let runCommand = '';

    if (language === 'Python') {
      runCommand = `python3 -m pytest test_${moduleName}.py --cov=${moduleName} --cov-report=term-missing`;
    } else if (language === 'JavaScript') {
      runCommand = framework === 'Jest' ? `npx jest ${filename}.test.js --coverage` : `npx nyc mocha ${filename}.test.js`;
    } else if (language === 'TypeScript') {
      runCommand = framework === 'Jest' ? `npx jest ${filename}.test.ts --coverage` : `npx nyc mocha -r ts-node/register ${filename}.test.ts`;
    } else if (language === 'Java') {
      runCommand = 'mvn clean test';
    }

    coverageReport = {
      totalCoverage: finalCoverage,
      runCommand,
      summaryTable: coverageResult.coverage_table || 'N/A',
      missingLines: coverageResult.missing_lines || 'None',
      suggestions: generateSuggestions(finalCoverage, coverageTarget),
      testPassed: coverageResult.test_passed
    };
  } else {
    coverageReport = {
      totalCoverage: 0,
      runCommand: `Coverage execution unavailable for ${language}`,
      summaryTable: coverageResult?.error || `Coverage runner skipped or unavailable`,
      missingLines: 'N/A',
      suggestions: [
        'Ensure runtime dependencies (pytest, jest, mocha, mvn) are installed locally',
        'Verify source code is free from syntax errors'
      ]
    };
  }

  return {
    status: 'success',
    tests: testCode.trim(),
    coverageReport
  };
}
