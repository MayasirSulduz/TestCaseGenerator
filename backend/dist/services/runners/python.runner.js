"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class PythonRunner {
    async runCoverage(sourceCode, testCode, filename, _framework) {
        const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'py_test_gen_'));
        try {
            const baseName = filename.replace(/\.py$/i, '').replace(/-/g, '_');
            const sourceFile = path_1.default.join(tempDir, `${baseName}.py`);
            const testFile = path_1.default.join(tempDir, `test_${baseName}.py`);
            fs_1.default.writeFileSync(sourceFile, sourceCode, 'utf-8');
            fs_1.default.writeFileSync(testFile, testCode, 'utf-8');
            const cmd = `python3 -m pytest test_${baseName}.py --cov=${baseName} --cov-report=term-missing`;
            let stdout = '';
            let stderr = '';
            let testPassed = true;
            try {
                const result = await execAsync(cmd, { cwd: tempDir, timeout: 30000 });
                stdout = result.stdout;
                stderr = result.stderr;
            }
            catch (err) {
                testPassed = false;
                stdout = err.stdout || '';
                stderr = err.stderr || '';
            }
            const combinedOutput = stdout + '\n' + stderr;
            const covMatch = combinedOutput.match(new RegExp(`${baseName}\\.py\\s+\\d+\\s+\\d+\\s+(\\d+)%\\s*(.*)`)) || combinedOutput.match(/TOTAL\s+\d+\s+\d+\s+(\d+)%/);
            if (covMatch) {
                const coverage = parseInt(covMatch[1], 10);
                const missingLines = covMatch[2]?.trim() || 'None';
                const lines = combinedOutput.split('\n');
                const tableLines = [];
                let capturing = false;
                for (const line of lines) {
                    if (line.includes('Name') && line.includes('Stmts') && line.includes('Cover')) {
                        capturing = true;
                    }
                    if (capturing) {
                        tableLines.push(line);
                        if (line.includes('TOTAL') || line.includes('===')) {
                            if (tableLines.length > 2)
                                break;
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
        }
        catch (error) {
            return {
                success: false,
                coverage: 0,
                error: error?.message || 'Python runner execution error'
            };
        }
        finally {
            try {
                fs_1.default.rmSync(tempDir, { recursive: true, force: true });
            }
            catch { }
        }
    }
}
exports.PythonRunner = PythonRunner;
