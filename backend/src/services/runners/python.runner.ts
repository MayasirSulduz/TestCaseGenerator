import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

function printErrorContext(code: string, lineNumber: number, radius = 8): string {
  const lines = code.split('\n');
  const start = Math.max(0, lineNumber - radius - 1);
  const end = Math.min(lines.length, lineNumber + radius);

  return lines
    .slice(start, end)
    .map((line, index) => {
      const actualLine = start + index + 1;
      const mark = actualLine === lineNumber ? '>>' : '  ';
      return `${mark} ${String(actualLine).padStart(4)} | ${line}`;
    })
    .join('\n');
}

/**
 * conftest.py that auto-mocks any missing third-party imports so the source
 * module can always be imported in the sandbox — even if it uses flask,
 * requests, sqlalchemy, etc. that aren't installed locally.
 */
const CONFTEST_PY = `
import sys
import types
import inspect
import asyncio
import pytest
from unittest.mock import MagicMock

class _AutoMockImporter:
    """Meta path finder that auto-mocks any missing module."""

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
        'pytest', '_pytest', 'coverage', 'pluggy',
    }

    def find_module(self, fullname, path=None):
        top = fullname.split('.')[0]
        if top in self._STDLIB:
            return None
        try:
            __import__(fullname)
            return None
        except ImportError:
            return self

    def load_module(self, fullname):
        if fullname in sys.modules:
            return sys.modules[fullname]
        mod = types.ModuleType(fullname)
        mod.__path__ = []
        mod.__loader__ = self
        mod.__getattr__ = lambda name: MagicMock()
        sys.modules[fullname] = mod
        return mod

sys.meta_path.insert(0, _AutoMockImporter())

@pytest.hookimpl(tryfirst=True)
def pytest_pyfunc_call(pyfuncitem):
    if inspect.iscoroutinefunction(pyfuncitem.obj):
        sig = inspect.signature(pyfuncitem.obj)
        kwargs = {}
        for param in sig.parameters:
            if param in pyfuncitem.funcargs:
                kwargs[param] = pyfuncitem.funcargs[param]
        asyncio.run(pyfuncitem.obj(**kwargs))
        return True

def pytest_configure(config):
    config.option.asyncio_default_fixture_loop_scope = "function"
`;export type PytestSummary = {
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  collected: number;
};

export function extractFailedTestIds(output: string): string[] {
  const ids = new Set<string>();
  for (const match of output.matchAll(/^FAILED\s+([^\s]+(?:\.py::[^\s]+)?)/gm)) {
    ids.add(match[1].trim());
  }
  return [...ids];
}

export function parsePytestSummary(output: string): PytestSummary {
  const summary: PytestSummary = {
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    collected: 0,
  };

  const collectedMatch = output.match(/collected\s+(\d+)\s+items?/i);
  if (collectedMatch) {
    summary.collected = Number(collectedMatch[1]);
  }

  const finalLine = output
    .split('\n')
    .find((line) =>
      /\b(?:passed|failed|error|skipped)\b/.test(line) &&
      /\bin\s+\d+(?:\.\d+)?s\b/.test(line)
    );

  if (!finalLine) {
    const pMatch = output.match(/(\d+)\s+passed/i);
    const fMatch = output.match(/(\d+)\s+failed/i);
    const sMatch = output.match(/(\d+)\s+skipped/i);
    const eMatch = output.match(/(\d+)\s+error/i);
    if (pMatch) summary.passed = Number(pMatch[1]);
    if (fMatch) summary.failed = Number(fMatch[1]);
    if (sMatch) summary.skipped = Number(sMatch[1]);
    if (eMatch) summary.errors = Number(eMatch[1]);
    return summary;
  }

  const getCount = (name: string) => {
    const match = finalLine.match(new RegExp(`(\\d+)\\s+${name}`, 'i'));
    return match ? Number(match[1]) : 0;
  };

  summary.passed = getCount('passed');
  summary.failed = getCount('failed');
  summary.skipped = getCount('skipped');
  summary.errors = getCount('error');

  return summary;
}

export function parseFullPytestOutput(stdout: string, stderr: string) {
  const output = `${stdout}\n${stderr}`;
  return {
    failedTests: extractFailedTestIds(output),
    summary: parsePytestSummary(output),
  };
}

export class PythonRunner implements ITestRunner {
  async runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    _framework: string,
    isFinalMeasurement = false
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

      // ── Pre-flight AST & Runtime Sanitization ──
      try {
        const sanitizeScript = `import ast, sys, traceback

file_path = sys.argv[1]
temp_dir = sys.argv[2]
sys.path.insert(0, temp_dir)

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

lines = code.split('\\n')
modified = False

def comment_line(l, tag="Sanitized"):
    leading = len(l) - len(l.lstrip())
    indent = l[:leading]
    content = l[leading:]
    return f"{indent}pass  # [{tag}] {content}"

# Pass 0: Fix top-level function indentation & convert def -> async def if block contains await
in_class = False
class_indent = 0
i = 0
while i < len(lines):
    line_str = lines[i]
    stripped = line_str.strip()
    if stripped.startswith('class '):
        in_class = True
        class_indent = len(line_str) - len(line_str.lstrip())
    elif in_class:
        curr_indent = len(line_str) - len(line_str.lstrip())
        if curr_indent <= class_indent and stripped and not stripped.startswith('#'):
            in_class = False
    
    if not in_class and stripped.startswith(('def test_', 'async def test_')):
        leading_spaces = len(line_str) - len(line_str.lstrip())
        if 1 <= leading_spaces <= 3:
            lines[i] = stripped
            modified = True
            line_str = stripped

    if stripped.startswith('def ') and '(' in stripped:
        indent = len(line_str) - len(line_str.lstrip())
        has_await = False
        j = i + 1
        while j < len(lines):
            lj = lines[j]
            lj_strip = lj.strip()
            if lj_strip and not lj_strip.startswith('#'):
                j_indent = len(lj) - len(lj.lstrip())
                if j_indent <= indent and lj_strip.startswith(('def ', 'async def ', 'class ')):
                    break
                if 'await ' in lj_strip:
                    has_await = True
                    break
            j += 1
        if has_await:
            lines[i] = line_str.replace('def ', 'async def ', 1)
            modified = True
    i += 1

for idx in range(len(lines)):
    if 'nonlocal ' in lines[idx]:
        lines[idx] = comment_line(lines[idx], "nonlocal")
        modified = True

for attempt in range(200):
    try:
        ast.parse('\\n'.join(lines))
        break
    except SyntaxError as e:
        modified = True
        err_idx = (e.lineno - 1) if (e.lineno and 1 <= e.lineno <= len(lines)) else (len(lines) - 1)

        func_start = err_idx
        while func_start > 0:
            l_str = lines[func_start]
            l_strip = l_str.strip()
            if (len(l_str) - len(l_str.lstrip()) == 0) and (
                l_strip.startswith(('def ', 'async def ', 'class ')) or l_strip.startswith('@')
            ):
                break
            func_start -= 1

        func_end = func_start + 1
        while func_end < len(lines):
            l_str = lines[func_end]
            l_strip = l_str.strip()
            if l_strip and not l_strip.startswith('#'):
                if (len(l_str) - len(l_str.lstrip()) == 0) and (
                    l_strip.startswith(('def ', 'async def ', 'class ')) or l_strip.startswith('@')
                ):
                    break
            func_end += 1

        changed_any = False
        for k in range(func_start, func_end):
            if lines[k].strip() and not lines[k].strip().startswith('#'):
                lines[k] = comment_line(lines[k], "Failing Block")
                changed_any = True

        if not changed_any and 0 <= err_idx < len(lines):
            lines[err_idx] = comment_line(lines[err_idx], "Line Salvage")

guard = 0
while guard < 10000:
    try:
        ast.parse('\\n'.join(lines))
        break
    except SyntaxError as e:
        err_idx = (e.lineno - 1) if (e.lineno and 1 <= e.lineno <= len(lines)) else -1
        if not (0 <= err_idx < len(lines)):
            break
        modified = True
        lines[err_idx] = comment_line(lines[err_idx], "Sanitized")
        guard += 1

for attempt in range(20):
    current_code = '\\n'.join(lines)
    try:
        exec_globals = {'__name__': '__main__'}
        exec(compile(current_code, file_path, 'exec'), exec_globals)
        break
    except Exception as e:
        if type(e).__name__ in ('AssertionError', 'KeyboardInterrupt', 'SystemExit'):
            break
        tb = traceback.extract_tb(sys.exc_info()[2])
        err_line = None
        for frame in tb:
            if frame.filename == file_path:
                err_line = frame.lineno
                break
        if err_line and err_line <= len(lines):
            modified = True
            lines[err_line - 1] = comment_line(lines[err_line - 1], "Sanitized")
        else:
            break

if modified:
    guard = 0
    while guard < 10000:
        try:
            ast.parse('\\n'.join(lines))
            break
        except SyntaxError as e:
            err_idx = (e.lineno - 1) if (e.lineno and 1 <= e.lineno <= len(lines)) else -1
            if not (0 <= err_idx < len(lines)):
                break
            target = lines[err_idx].strip()
            if not target or target.startswith('#'):
                break
            lines[err_idx] = comment_line(lines[err_idx], "Sanitized")
            guard += 1

    cleaned = '\\n'.join(lines)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)
    print("AST_CLEANED")
`;
        const sanitizePyPath = path.join(tempDir, '_sanitize.py');
        fs.writeFileSync(sanitizePyPath, sanitizeScript, 'utf-8');
        const astCheck = await execAsync(`python3 _sanitize.py test_${baseName}.py "${tempDir}"`, { cwd: tempDir, timeout: 15000 });
        if (astCheck.stdout.includes('AST_CLEANED')) {
          testCode = fs.readFileSync(testFile, 'utf-8');
          console.log(`  [PythonRunner] 🧹 Fixed AST syntax errors & commented out broken top-level statements in test_${baseName}.py`);
        }
      } catch (astErr: any) {
        console.log(`  [PythonRunner] AST sanitization warning: ${astErr?.message || astErr}`);
      }

      // Fast-fail AST check: verify test code is valid Python before running Pytest
      try {
        await execAsync(`python3 -c "import ast; ast.parse(open('test_${baseName}.py', encoding='utf-8').read())"`, { cwd: tempDir, timeout: 10000 });
      } catch (syntaxErr: any) {
        const syntaxMsg = syntaxErr.stderr || syntaxErr.stdout || syntaxErr.message || 'SyntaxError during Python AST parse';
        console.log(`  [PythonRunner] ❌ Fast-fail: Generated test code has AST syntax errors. Skipping Pytest execution.`);

        const lineMatch = syntaxMsg.match(/line (\d+)/i);
        if (lineMatch) {
          const errLineNum = parseInt(lineMatch[1], 10);
          console.log(`\n  ── AST Syntax Error Location (Line ${errLineNum}) ──`);
          console.log(printErrorContext(testCode, errLineNum));
          console.log(`  ── End Syntax Error Context ──\n`);
        }

        return {
          success: false,
          coverage: 0,
          test_passed: false,
          error: `AST SyntaxError: Generated test file is not valid Python. Traceback:\n${syntaxMsg}`,
          stdout: syntaxMsg,
          stderr: syntaxMsg,
          collectionError: true
        };
      }

      // ── Pre-flight: check if the source module can be imported ──
      try {
        await execAsync(
          `python3 -c "import sys; sys.path.insert(0,'.'); import ${baseName}"`,
          { cwd: tempDir, timeout: 15000, env: { ...process.env, PYTHONPATH: tempDir } }
        );
        console.log(`  [PythonRunner] Source module '${baseName}' imported OK`);
      } catch (importErr: any) {
        const importErrMsg = (importErr.stderr || importErr.stdout || '').slice(0, 300);
        console.log(`  [PythonRunner] Source module import warning: ${importErrMsg}`);
      }

      // Write pytest.ini to eliminate deprecation warnings and configure asyncio mode
      fs.writeFileSync(
        path.join(tempDir, 'pytest.ini'),
        `[pytest]\nasyncio_mode = auto\nasyncio_default_fixture_loop_scope = function\n`,
        'utf-8'
      );

      // ── Run pytest with json & term coverage ──
      const cmd = isFinalMeasurement
        ? `python3 -m pytest test_${baseName}.py -rA --cov=${baseName} --cov-report=json:coverage.json --cov-report=term-missing`
        : `python3 -m pytest test_${baseName}.py -q --tb=short -rA --maxfail=10 --disable-warnings --cov=${baseName} --cov-report=json:coverage.json --cov-report=term-missing`;

      let stdout = '';
      let stderr = '';
      let testPassed = true;

      try {
        const result = await execAsync(cmd, {
          cwd: tempDir,
          timeout: 90000,             // 90s for large files
          maxBuffer: 10 * 1024 * 1024, // 10MB
          env: { ...process.env, PYTHONPATH: tempDir, PYTHONDONTWRITEBYTECODE: '1' }
        });
        stdout = result.stdout;
        stderr = result.stderr;
        testPassed = true;
      } catch (err: any) {
        testPassed = false;
        stdout = err.stdout || '';
        stderr = err.stderr || '';
      }

      const parsedEvidence = parseFullPytestOutput(stdout, stderr);
      const failedTestIds = parsedEvidence.failedTests;
      const summary = parsedEvidence.summary;

      const executedCount = summary.passed + summary.failed + summary.skipped + summary.errors;
      const passRate = executedCount === 0 ? 0 : (summary.passed / executedCount) * 100;

      const isCollectionError =
        /ERROR collecting|ImportError|SyntaxError|ModuleNotFoundError/i.test(`${stdout}\n${stderr}`);

      console.log(`  [PythonRunner] Pytest exit code: ${testPassed ? 0 : 1}`);
      console.log(`  [PythonRunner] Metrics | Collected: ${summary.collected} | Executed: ${executedCount} | Passed: ${summary.passed} | Failed: ${summary.failed} | Pass Rate: ${passRate.toFixed(1)}%`);
      console.log(`  [PythonRunner] Failed test IDs (${failedTestIds.length}): ${failedTestIds.join(', ') || 'none'}`);
      
      if (!testPassed) {
        console.log(`---- pytest stdout ----`);
        console.log(stdout.length > 4000 ? '... [truncated top] ...\n' + stdout.slice(-4000) : stdout);
        console.log(`---- pytest stderr ----`);
        console.log(stderr.length > 2000 ? stderr.slice(-2000) : stderr);
      }

      // ── Parse machine-readable coverage.json report if available ──
      const jsonCovPath = path.join(tempDir, 'coverage.json');
      let jsonCoverage: number | null = null;
      let jsonMissingLines = 'None';
      let jsonReportFound = false;

      if (fs.existsSync(jsonCovPath)) {
        try {
          const covJson = JSON.parse(fs.readFileSync(jsonCovPath, 'utf-8'));
          const totalPct = covJson.totals?.percent_covered;
          if (typeof totalPct === 'number') {
            jsonCoverage = Math.round(totalPct);
            jsonReportFound = true;
          }
          const filesMap = covJson.files || {};
          const matchedFileKey = Object.keys(filesMap).find(f => f.endsWith(`${baseName}.py`) || f === `${baseName}.py`);
          if (matchedFileKey && filesMap[matchedFileKey]?.missing_lines) {
            const missingArr = filesMap[matchedFileKey].missing_lines;
            if (Array.isArray(missingArr) && missingArr.length > 0) {
              jsonMissingLines = missingArr.join(', ');
            }
          }
        } catch {}
      }

      // ── Fallback term coverage parsing ──
      const combinedOutput = stdout + '\n' + stderr;
      const covMatch =
        combinedOutput.match(
          new RegExp(`${baseName}\\.py\\s+\\d+\\s+\\d+\\s+(\\d+)%\\s*(.*)`)
        ) || combinedOutput.match(/TOTAL\s+\d+\s+\d+\s+(\d+)%/);

      const coverage = jsonReportFound
        ? (jsonCoverage ?? 0)
        : (covMatch ? parseInt(covMatch[1], 10) : 0);
      const missingLines = jsonReportFound ? jsonMissingLines : (covMatch?.[2]?.trim() || 'None');

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
        success: !isCollectionError,
        coverage,
        missing_lines: missingLines,
        coverage_table: tableLines.length ? tableLines.join('\n') : combinedOutput.slice(0, 500),
        test_passed: testPassed,
        stdout,
        stderr,
        failedTests: failedTestIds,
        failedCount: summary.failed,
        passedTests: summary.passed,
        skippedCount: summary.skipped,
        errorCount: summary.errors,
        collectedCount: summary.collected,
        executedCount,
        passRate,
        collectionError: isCollectionError
      };
    } catch (error: any) {
      return {
        success: false,
        coverage: 0,
        error: error?.message || 'Python runner execution error',
        collectionError: true
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
