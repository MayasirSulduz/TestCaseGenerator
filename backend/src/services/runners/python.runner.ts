import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

/**
 * conftest.py that auto-mocks any missing third-party imports so the source
 * module can always be imported in the sandbox — even if it uses flask,
 * requests, sqlalchemy, etc. that aren't installed locally.
 */
const CONFTEST_PY = `
import sys
import types
from unittest.mock import MagicMock

class _AutoMockImporter:
    """Meta path finder that auto-mocks any missing module."""

    # Standard library modules we should NEVER mock (they're always available)
    _STDLIB = {
        'abc', 'argparse', 'ast', 'asyncio', 'base64', 'builtins',
        'collections', 'contextlib', 'copy', 'csv', 'dataclasses',
        'datetime', 'decimal', 'enum', 'functools', 'glob', 'hashlib',
        'heapq', 'hmac', 'html', 'http', 'importlib', 'inspect', 'io',
        'itertools', 'json', 'logging', 'math', 'multiprocessing', 'operator',
        'os', 'pathlib', 'pickle', 'pprint', 'random', 're', 'secrets',
        'shutil', 'signal', 'socket', 'sqlite3', 'statistics', 'string',
        'struct', 'subprocess', 'sys', 'tempfile', 'textwrap', 'threading',
        'time', 'traceback', 'types', 'typing', 'unittest', 'urllib',
        'uuid', 'warnings', 'weakref', 'xml', 'zipfile',
        # testing
        'pytest', '_pytest', 'coverage', 'pluggy',
    }

    def find_module(self, fullname, path=None):
        top = fullname.split('.')[0]
        if top in self._STDLIB:
            return None          # let normal import handle it
        try:
            __import__(fullname)
            return None          # already importable
        except ImportError:
            return self          # we'll mock it

    def load_module(self, fullname):
        if fullname in sys.modules:
            return sys.modules[fullname]
        mod = types.ModuleType(fullname)
        mod.__path__ = []
        mod.__loader__ = self
        # Make attribute access return MagicMocks so code like
        # "from flask import Flask" works seamlessly
        mod.__getattr__ = lambda name: MagicMock()
        sys.modules[fullname] = mod
        return mod

# Install the auto-mocker BEFORE anything else is imported
sys.meta_path.insert(0, _AutoMockImporter())
`;

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

      // Write source, test, and support files
      fs.writeFileSync(sourceFile, sourceCode, 'utf-8');
      fs.writeFileSync(testFile, testCode, 'utf-8');
      fs.writeFileSync(path.join(tempDir, '__init__.py'), '', 'utf-8');
      fs.writeFileSync(path.join(tempDir, 'conftest.py'), CONFTEST_PY, 'utf-8');

      // ── Pre-flight: check if the source module can be imported ──
      try {
        const importCheck = await execAsync(
          `python3 -c "import sys; sys.path.insert(0,'.'); import ${baseName}"`,
          { cwd: tempDir, timeout: 15000 }
        );
        console.log(`  [PythonRunner] Source module '${baseName}' imported OK`);
      } catch (importErr: any) {
        const importErrMsg = (importErr.stderr || importErr.stdout || '').slice(0, 300);
        console.log(`  [PythonRunner] Source module import warning: ${importErrMsg}`);
        // Continue anyway — conftest.py should handle missing deps
      }

      // ── Run pytest with coverage ──
      const cmd = `python3 -m pytest test_${baseName}.py --cov=${baseName} --cov-report=term-missing -v --tb=short`;

      let stdout = '';
      let stderr = '';
      let testPassed = true;

      try {
        const result = await execAsync(cmd, {
          cwd: tempDir,
          timeout: 90000,             // 90s for large files
          maxBuffer: 10 * 1024 * 1024, // 10MB
          env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        testPassed = false;
        stdout = err.stdout || '';
        stderr = err.stderr || '';
      }

      const combinedOutput = stdout + '\n' + stderr;

      console.log(`  [PythonRunner] stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
      console.log(`  [PythonRunner] test_passed: ${testPassed}`);

      // ── Parse coverage output ──
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

      // ── No coverage found — extract useful error info ──
      // Try to find passed/failed counts
      const passedMatch = combinedOutput.match(/(\d+) passed/);
      const failedMatch = combinedOutput.match(/(\d+) failed/);
      const errorMatch = combinedOutput.match(/(\d+) error/);

      let statusSummary = '';
      if (passedMatch) statusSummary += `${passedMatch[1]} passed `;
      if (failedMatch) statusSummary += `${failedMatch[1]} failed `;
      if (errorMatch) statusSummary += `${errorMatch[1]} errors `;

      return {
        success: false,
        coverage: 0,
        test_passed: false,
        error: statusSummary
          ? `Tests: ${statusSummary.trim()}. Coverage parsing failed.`
          : 'Failed to parse pytest coverage output.',
        stdout: combinedOutput.slice(0, 4000),
        stderr: combinedOutput.slice(0, 4000)
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
