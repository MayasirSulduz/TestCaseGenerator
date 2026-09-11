import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

export class TypeScriptRunner implements ITestRunner {
  async runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    framework: string
  ): Promise<CoverageResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts_test_gen_'));

    try {
      const cleanName = filename.replace(/\.(ts|tsx)$/i, '');
      const sourceFile = path.join(tempDir, `${cleanName}.ts`);
      const testFile = path.join(tempDir, `${cleanName}.test.ts`);

      fs.writeFileSync(sourceFile, sourceCode, 'utf-8');
      fs.writeFileSync(testFile, testCode, 'utf-8');

      // Write temp tsconfig.json
      const tsConfig = {
        compilerOptions: {
          target: 'es2020',
          module: 'commonjs',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true
        }
      };
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2), 'utf-8');

      let cmd = 'npx jest --coverage';
      if (framework === 'Mocha') {
        cmd = 'npx nyc mocha -r ts-node/register *.test.ts';
      }

      let stdout = '';
      let stderr = '';
      let testPassed = true;

      try {
        const result = await execAsync(cmd, { cwd: tempDir, timeout: 30000 });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        testPassed = false;
        stdout = err.stdout || '';
        stderr = err.stderr || '';
      }

      const combinedOutput = stdout + '\n' + stderr;

      const lineCovMatch =
        combinedOutput.match(/Lines\s*:\s*([\d.]+)%/) ||
        combinedOutput.match(/All files\s*\|\s*([\d.]+)/) ||
        combinedOutput.match(/Stmts\s*\|\s*([\d.]+)/);

      const coverage = lineCovMatch ? Math.round(parseFloat(lineCovMatch[1])) : 0;

      const uncoveredMatch = combinedOutput.match(new RegExp(`${cleanName}\\.ts\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*(.+)`));
      const missingLines = uncoveredMatch ? uncoveredMatch[1].trim() : 'None';

      return {
        success: coverage > 0 || combinedOutput.includes('PASS') || combinedOutput.includes('passing'),
        coverage,
        missing_lines: missingLines,
        coverage_table: combinedOutput.slice(0, 1000),
        test_passed: testPassed,
        stdout,
        stderr
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
