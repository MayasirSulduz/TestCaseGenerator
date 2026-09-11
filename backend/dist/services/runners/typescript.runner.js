"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class TypeScriptRunner {
    async runCoverage(sourceCode, testCode, filename, framework) {
        const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'ts_test_gen_'));
        try {
            const cleanName = filename.replace(/\.(ts|tsx)$/i, '');
            const sourceFile = path_1.default.join(tempDir, `${cleanName}.ts`);
            const testFile = path_1.default.join(tempDir, `${cleanName}.test.ts`);
            fs_1.default.writeFileSync(sourceFile, sourceCode, 'utf-8');
            fs_1.default.writeFileSync(testFile, testCode, 'utf-8');
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
            fs_1.default.writeFileSync(path_1.default.join(tempDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2), 'utf-8');
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
            }
            catch (err) {
                testPassed = false;
                stdout = err.stdout || '';
                stderr = err.stderr || '';
            }
            const combinedOutput = stdout + '\n' + stderr;
            const lineCovMatch = combinedOutput.match(/Lines\s*:\s*([\d.]+)%/) ||
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
        }
        catch (error) {
            return {
                success: false,
                coverage: 0,
                error: error?.message || 'TypeScript runner execution error'
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
exports.TypeScriptRunner = TypeScriptRunner;
