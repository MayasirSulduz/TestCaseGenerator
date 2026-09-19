/**
 * Extract code from LLM response that may be wrapped in markdown code fences.
 * Handles: ```python\n...\n```, ```\n...\n```, and bare code.
 */
export function extractCodeFromMarkdown(text: string): string {
  if (!text) return '';

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

export function sanitizeTestImports(testCode: string): string {
  let cleaned = testCode;
  // Replace deprecated @testing-library/jest-dom/extend-expect sub-path with modern @testing-library/jest-dom
  cleaned = cleaned.replace(/@testing-library\/jest-dom\/extend-expect/g, '@testing-library/jest-dom');
  return cleaned;
}

export function fixPythonImports(testCode: string, correctModuleName: string): string {
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

  const hasImport =
    formatted.includes(`from ${correctModuleName} import`) ||
    formatted.includes(`import ${correctModuleName}`);

  if (!hasImport) {
    const lines = formatted.split('\n');
    let importIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        importIndex = i + 1;
      }
    }
    lines.splice(importIndex, 0, `from ${correctModuleName} import *`);
    formatted = lines.join('\n');
  }

  return formatted;
}
