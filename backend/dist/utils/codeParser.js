"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCodeFromMarkdown = extractCodeFromMarkdown;
exports.sanitizeTestImports = sanitizeTestImports;
exports.fixPythonImports = fixPythonImports;
/**
 * Extract code from LLM response that may be wrapped in markdown code fences.
 * Handles: ```python\n...\n```, ```\n...\n```, and bare code.
 */
function extractCodeFromMarkdown(text) {
    if (!text)
        return '';
    // Try to extract from fenced code blocks (```python ... ``` or ``` ... ```)
    const fenceMatch = text.match(/```[\w]*\s*\n([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }
    // Remove any remaining isolated ``` markers
    let cleaned = text.replace(/^```[\w]*\s*$/gm, '');
    cleaned = cleaned.replace(/^```\s*$/gm, '');
    cleaned = cleaned.trim();
    return cleaned;
}
function sanitizeTestImports(testCode) {
    let cleaned = testCode;
    // Replace deprecated @testing-library/jest-dom/extend-expect sub-path with modern @testing-library/jest-dom
    cleaned = cleaned.replace(/@testing-library\/jest-dom\/extend-expect/g, '@testing-library/jest-dom');
    return cleaned;
}
function fixPythonImports(testCode, correctModuleName) {
    let formatted = testCode;
    // 1. Fix function definitions with spaces in name (e.g. `def test_foo bar(` -> `def test_foo_bar(`)
    formatted = formatted.replace(/^(\s*def\s+test_[\w\s]+?)\s+(\w+)\s*\(/gm, (_match, prefix, rest) => {
        return prefix.replace(/\s+/g, '_') + '_' + rest + '(';
    });
    const wrongPatterns = [
        /from your_module import/gi,
        /from module import/gi,
        /from source import/gi,
        /import your_module/gi,
        /import module/gi
    ];
    for (const pattern of wrongPatterns) {
        formatted = formatted.replace(pattern, `from ${correctModuleName} import`);
    }
    // Ensure BOTH `from <module> import *` AND `import <module>` exist
    const hasFromStar = new RegExp(`from\\s+${correctModuleName}\\s+import`, 'i').test(formatted);
    const hasImportModule = new RegExp(`import\\s+${correctModuleName}\\b`, 'i').test(formatted);
    const lines = formatted.split('\n');
    let importIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
            importIndex = i + 1;
        }
    }
    if (!hasImportModule) {
        lines.splice(importIndex, 0, `import ${correctModuleName}`);
    }
    if (!hasFromStar) {
        lines.splice(importIndex, 0, `from ${correctModuleName} import *`);
    }
    return lines.join('\n');
}
