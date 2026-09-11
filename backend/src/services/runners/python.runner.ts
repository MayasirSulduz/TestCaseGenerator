import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

export class PythonRunner implements ITestRunner {
  async runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    _framework: string
  ): Promise<CoverageResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'py_test_gen_'));

    try {
      const baseName = filename.replace(/\.py$/i, '').replace(/-/g, '_');
      const sourceFile = path.join(tempDir, `${baseName}.py`);
      const testFile = path.join(tempDir, `test_${baseName}.py`);

      fs.writeFileSync(sourceFile, sourceCode, 'utf-8');
      fs.writeFileSync(testFile, testCode, 'utf-8');

      const cmd = `python3 -m pytest test_${baseName}.py --cov=${baseName} --cov-report=term-missing`;

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

      const covMatch =
        combinedOutput.match(
          new RegExp(`${baseName}\\.py\\s+\\d+\\s+\\d+\\s+(\\d+)%\\s*(.*)`)
        ) || combinedOutput.match(/TOTAL\s+\d+\s+\d+\s+(\d+)%/);

      if (covMatch) {
        const coverage = parseInt(covMatch[1], 10);
        const missingLines = covMatch[2]?.trim() || 'None';

        const lines = combinedOutput.split('\n');
        const tableLines: string[] = [];
        let capturing = false;

        for (const line of lines) {
          if (line.includes('Name') && line.includes('Stmts') && line.includes('Cover')) {
            capturing = true;
          }
          if (capturing) {
            tableLines.push(line);
            if (line.includes('TOTAL') || line.includes('===')) {
              if (tableLines.length > 2) break;
            }
          }
        }

        return {
          success: true,
          coverage,
          missing_lines: missingLines.length ? missingLines : 'None',
          coverage_table: tableLines.length ? tableLines.join('\n') : combinedOutput.slice(0, 500),
          test_passed: testPassed,
          stdout,
          stderr
        };
      }

      return {
        success: false,
        coverage: 0,
        error: 'Failed to parse pytest coverage output.',
        stdout,
        stderr
      };
    } catch (error: any) {
      return {
        success: false,
        coverage: 0,
        error: error?.message || 'Python runner execution error'
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
