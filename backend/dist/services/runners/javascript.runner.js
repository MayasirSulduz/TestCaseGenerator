"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaScriptRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function stripAnsi(text) {
    return text
        .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/\[\d+;\d+m/g, '')
        .replace(/\[\d+m/g, '');
}
function autoStubRelativeModules(tempDir, sourceCode, testCode, targetCleanName) {
    const combined = sourceCode + '\n' + testCode;
    const importRegex = /(?:import|from|require\()\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(combined)) !== null) {
        const relPath = match[1];
        const baseClean = path_1.default.basename(relPath).replace(/\.[^/.]+$/, '');
        if (baseClean === targetCleanName || relPath.endsWith('.css') || relPath.endsWith('.scss') || relPath.endsWith('.svg'))
            continue;
        const resolvedPath = path_1.default.join(tempDir, relPath);
        const dir = path_1.default.dirname(resolvedPath);
        try {
            fs_1.default.mkdirSync(dir, { recursive: true });
            const extensions = ['.jsx', '.js', '.tsx', '.ts'];
            const exists = extensions.some((ext) => fs_1.default.existsSync(resolvedPath + ext) || fs_1.default.existsSync(resolvedPath) || fs_1.default.existsSync(path_1.default.join(resolvedPath, 'index' + ext)));
            if (!exists) {
                fs_1.default.writeFileSync(resolvedPath + '.jsx', `import React from 'react'; export default function DummyComponent() { return null; } export const dummy = {};`, 'utf-8');
            }
        }
        catch { }
    }
}
class JavaScriptRunner {
    async runCoverage(sourceCode, testCode, filename, framework) {
        const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'js_test_gen_'));
        try {
            const isJsx = /\.jsx$/i.test(filename) || /<\w+/.test(sourceCode) || /testing-library|react/i.test(testCode);
            const ext = isJsx ? 'jsx' : 'js';
            const cleanName = filename.replace(/\.(js|jsx)$/i, '').replace(/-/g, '_');
            const sourceFile = path_1.default.join(tempDir, `${cleanName}.${ext}`);
            const testFile = path_1.default.join(tempDir, `${cleanName}.test.${ext}`);
            fs_1.default.writeFileSync(sourceFile, sourceCode, 'utf-8');
            fs_1.default.writeFileSync(testFile, testCode, 'utf-8');
            autoStubRelativeModules(tempDir, sourceCode, testCode, cleanName);
            const emptyModulePath = path_1.default.join(tempDir, 'emptyModule.js');
            fs_1.default.writeFileSync(emptyModulePath, 'module.exports = {};', 'utf-8');
            const backendDir = path_1.default.resolve(__dirname, '../../..');
            const backendNodeModules = path_1.default.join(backendDir, 'node_modules');
            const pkgJson = {
                name: 'temp-js-test',
                version: '1.0.0',
                private: true
            };
            fs_1.default.writeFileSync(path_1.default.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');
            const jestConfig = {
                testEnvironment: isJsx ? 'jsdom' : 'node',
                collectCoverage: true,
                moduleNameMapper: {
                    '\\.(css|less|scss|sass|svg|png|jpg|jpeg|gif|webp|woff|woff2)$': emptyModulePath
                },
                moduleDirectories: ['node_modules', tempDir, backendNodeModules]
            };
            fs_1.default.writeFileSync(path_1.default.join(tempDir, 'jest.config.json'), JSON.stringify(jestConfig, null, 2), 'utf-8');
            let cmd = 'npx jest --config=jest.config.json --coverage';
            if (framework === 'Mocha') {
                cmd = 'npx nyc mocha *.test.js';
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
            }
            catch (err) {
                testPassed = false;
                stdout = err.stdout || '';
                stderr = err.stderr || '';
            }
            const combinedOutput = stdout + '\n' + stderr;
            const cleanCombined = stripAnsi(combinedOutput);
            const fileCovMatch = cleanCombined.match(new RegExp(`${cleanName}\\.(js|jsx|ts|tsx)\\s*\\|\\s*([\\d.]+)`));
            const allFilesMatch = cleanCombined.match(/All files\s*\|\s*([\d.]+)/);
            const linesCovMatch = cleanCombined.match(/Lines\s*:\s*([\d.]+)%/);
            const stmtsCovMatch = cleanCombined.match(/Stmts\s*\|\s*([\d.]+)/);
            const parsedCovString = fileCovMatch?.[2] || allFilesMatch?.[1] || linesCovMatch?.[1] || stmtsCovMatch?.[1];
            const coverage = parsedCovString ? Math.round(parseFloat(parsedCovString)) : 0;
            const uncoveredMatch = cleanCombined.match(new RegExp(`${cleanName}\\.(js|jsx|ts|tsx)\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*([^|\\n]+)`));
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
        }
        catch (error) {
            return {
                success: false,
                coverage: 0,
                error: error?.message || 'JavaScript runner execution error'
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
exports.JavaScriptRunner = JavaScriptRunner;
