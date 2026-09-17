import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[\d+;\d+m/g, '')
    .replace(/\[\d+m/g, '');
}

function autoStubRelativeModules(tempDir: string, sourceCode: string, testCode: string, targetCleanName: string) {
  const combined = sourceCode + '\n' + testCode;
  const importRegex = /(?:import|from|require\()\s*['"](\.[^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(combined)) !== null) {
    const relPath = match[1];
    const baseClean = path.basename(relPath).replace(/\.[^/.]+$/, '');
    if (baseClean === targetCleanName || relPath.endsWith('.css') || relPath.endsWith('.scss') || relPath.endsWith('.svg')) continue;

    const resolvedPath = path.join(tempDir, relPath);
    const dir = path.dirname(resolvedPath);
    try {
      fs.mkdirSync(dir, { recursive: true });
      const extensions = ['.tsx', '.ts', '.jsx', '.js'];
      const exists = extensions.some(
        (ext) => fs.existsSync(resolvedPath + ext) || fs.existsSync(resolvedPath) || fs.existsSync(path.join(resolvedPath, 'index' + ext))
      );
      if (!exists) {
        fs.writeFileSync(
          resolvedPath + '.tsx',
          `import React from 'react'; export default function DummyComponent() { return null; } export const dummy = {};`,
          'utf-8'
        );
      }
    } catch {}
  }
}

export class TypeScriptRunner implements ITestRunner {
  async runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    framework: string
  ): Promise<CoverageResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts_test_gen_'));

    try {
      const isTsx = /\.tsx$/i.test(filename) || /<\w+/.test(sourceCode) || /testing-library|react/i.test(testCode);
      const ext = isTsx ? 'tsx' : 'ts';
      const cleanName = filename.replace(/\.(ts|tsx)$/i, '').replace(/-/g, '_');
      const sourceFile = path.join(tempDir, `${cleanName}.${ext}`);
      const testFile = path.join(tempDir, `${cleanName}.test.${ext}`);

      fs.writeFileSync(sourceFile, sourceCode, 'utf-8');
      fs.writeFileSync(testFile, testCode, 'utf-8');

      // Auto-stub relative imported sub-components
      autoStubRelativeModules(tempDir, sourceCode, testCode, cleanName);

      // Create dummy empty module for CSS / Asset imports
      const emptyModulePath = path.join(tempDir, 'emptyModule.js');
      fs.writeFileSync(emptyModulePath, 'module.exports = {};', 'utf-8');

      const backendDir = path.resolve(__dirname, '../../..');
      const backendNodeModules = path.join(backendDir, 'node_modules');

      let tsJestPath = 'ts-jest';
      try {
        tsJestPath = require.resolve('ts-jest', { paths: [backendNodeModules, backendDir] });
      } catch {
        tsJestPath = 'ts-jest';
      }

      const tsConfig = {
        compilerOptions: {
          target: 'es2020',
          module: 'commonjs',
          jsx: 'react-jsx',
          allowJs: true,
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
          types: ['jest', 'node', '@testing-library/jest-dom']
        }
      };
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2), 'utf-8');

      const jestConfig = {
        transform: {
          '^.+\\.(ts|tsx|js|jsx)$': [tsJestPath, { diagnostics: false, tsconfig: path.join(tempDir, 'tsconfig.json') }]
        },
        moduleNameMapper: {
          '\\.(css|less|scss|sass|svg|png|jpg|jpeg|gif|webp|woff|woff2)$': emptyModulePath
        },
        testEnvironment: isTsx ? 'jsdom' : 'node',
        collectCoverage: true,
        moduleDirectories: ['node_modules', tempDir, backendNodeModules]
      };
      fs.writeFileSync(path.join(tempDir, 'jest.config.json'), JSON.stringify(jestConfig, null, 2), 'utf-8');
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'temp-ts-test', private: true }), 'utf-8');

      let cmd = 'npx jest --config=jest.config.json --coverage';
      if (framework === 'Mocha') {
        cmd = 'npx nyc mocha -r ts-node/register *.test.*';
      }

      let stdout = '';
      let stderr = '';
      let testPassed = true;

      try {
        const result = await execAsync(cmd, {
          cwd: tempDir,
          timeout: 30000,
          env: { ...process.env, NODE_PATH: backendNodeModules }
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        testPassed = false;
        stdout = err.stdout || '';
        stderr = err.stderr || '';
      }

      const combinedOutput = stdout + '\n' + stderr;
      const cleanCombined = stripAnsi(combinedOutput);

      const fileCovMatch = cleanCombined.match(new RegExp(`${cleanName}\\.(ts|tsx|js|jsx)\\s*\\|\\s*([\\d.]+)`));
      const allFilesMatch = cleanCombined.match(/All files\s*\|\s*([\d.]+)/);
      const linesCovMatch = cleanCombined.match(/Lines\s*:\s*([\d.]+)%/);
      const stmtsCovMatch = cleanCombined.match(/Stmts\s*\|\s*([\d.]+)/);

      const parsedCovString = fileCovMatch?.[2] || allFilesMatch?.[1] || linesCovMatch?.[1] || stmtsCovMatch?.[1];
      const coverage = parsedCovString ? Math.round(parseFloat(parsedCovString)) : 0;

      const uncoveredMatch = cleanCombined.match(new RegExp(`${cleanName}\\.(ts|tsx|js|jsx)\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*([^|\\n]+)`));
      const missingLines = uncoveredMatch ? uncoveredMatch[1].trim() : 'None';

      const hasPass = cleanCombined.includes('PASS');
      const hasFail = cleanCombined.includes('FAIL');
      const isOverallPassed = hasPass && !hasFail;

      return {
        success: coverage > 0 || isOverallPassed,
        coverage,
        missing_lines: missingLines.length ? missingLines : 'None',
        coverage_table: cleanCombined.slice(0, 1500),
        test_passed: isOverallPassed,
        stdout: cleanCombined,
        stderr: cleanCombined
      };
    } catch (error: any) {
      return {
        success: false,
        coverage: 0,
        error: error?.message || 'TypeScript runner execution error'
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
