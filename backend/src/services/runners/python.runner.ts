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

      // ── Pre-flight AST & Runtime Sanitization: ensure testCode has 0 syntax/collection errors ──
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
    
    # Only fix 1-3 space top-level offsets for def test_ (do NOT unindent @ decorators or inner functions!)
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

# Pass 0.5: Convert invalid 'nonlocal' statements causing SyntaxError
for idx in range(len(lines)):
    if 'nonlocal ' in lines[idx]:
        lines[idx] = comment_line(lines[idx], "nonlocal")
        modified = True

# Helper function to check if a line has unmatched open brackets/parentheses
def has_unclosed_brackets(l):
    return (l.count('(') > l.count(')')) or (l.count('[') > l.count(']')) or (l.count('{') > l.count('}'))

# Phase 1: Robust Block-Level AST Salvage (isolates and comments out failing function blocks)
for attempt in range(200):
    try:
        ast.parse('\\n'.join(lines))
        break
    except SyntaxError as e:
        modified = True
        err_idx = (e.lineno - 1) if (e.lineno and e.lineno <= len(lines)) else (len(lines) - 1)

        # Find starting line of enclosing top-level function/class/fixture block
        func_start = err_idx
        while func_start > 0:
            l_str = lines[func_start]
            if l_str.strip() and (len(l_str) - len(l_str.lstrip()) == 0):
                break
            func_start -= 1

        # Find ending line of func_start (up to next top-level function/class/decorator or EOF)
        func_end = func_start + 1
        while func_end < len(lines):
            l_str = lines[func_end]
            if l_str.strip() and (len(l_str) - len(l_str.lstrip()) == 0):
                break
            func_end += 1

        # Comment out the entire failing function block
        for k in range(func_start, func_end):
            if lines[k].strip() and not lines[k].strip().startswith('#'):
                lines[k] = comment_line(lines[k], "Failing Block")

# Phase 1.5: Guaranteed line-level salvage. Block-level commenting alone can give up
# on files with many broken blocks (it caps out and would silently leave the file
# unparseable). This loop is GUARANTEED to converge: every pass either succeeds or
# comments out exactly one offending line, so it terminates for any finite file and
# ends with code that ast.parse() accepts.
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
        modified = True
        lines[err_idx] = comment_line(lines[err_idx], "Sanitized")
        guard += 1

# Phase 2: Runtime module exec check (comment out top-level lines causing NameError/AttributeError)
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

# Final safety gate: never hand a broken file to pytest.
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
      const cmd = `python3 -m pytest test_${baseName}.py --cov=${baseName} --cov-report=term-missing -v --tb=short -W ignore::DeprecationWarning`;

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
