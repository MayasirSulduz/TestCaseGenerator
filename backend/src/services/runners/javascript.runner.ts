import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

export class JavaScriptRunner implements ITestRunner {
  async runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    framework: string
  ): Promise<CoverageResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js_test_gen_'));

    try {
      const cleanName = filename.replace(/\.(js|jsx)$/i, '');
      const sourceFile = path.join(tempDir, `${cleanName}.js`);
      const testFile = path.join(tempDir, `${cleanName}.test.js`);

      fs.writeFileSync(sourceFile, sourceCode, 'utf-8');
      fs.writeFileSync(testFile, testCode, 'utf-8');

      // Write temp package.json
      const pkgJson = {
        name: 'temp-js-test',
        version: '1.0.0',
        private: true,
        scripts: {
          test: framework === 'Jest' ? 'jest --coverage --json --outputFile=jest-results.json' : 'nyc mocha *.test.js'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');

      let cmd = 'npx jest --coverage';
      if (framework === 'Mocha') {
        cmd = 'npx nyc mocha *.test.js';
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

      // Extract coverage percentages (Lines % / All files %)
      const lineCovMatch =
        combinedOutput.match(/Lines\s*:\s*([\d.]+)%/) ||
        combinedOutput.match(/All files\s*\|\s*([\d.]+)/) ||
        combinedOutput.match(/Stmts\s*\|\s*([\d.]+)/);

      const coverage = lineCovMatch ? Math.round(parseFloat(lineCovMatch[1])) : 0;

      // Extract uncovered line numbers e.g. "myFile.js | 80 | 10-12,15"
      const uncoveredMatch = combinedOutput.match(new RegExp(`${cleanName}\\.js\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*(.+)`));
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
        error: error?.message || 'JavaScript runner execution error'
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
