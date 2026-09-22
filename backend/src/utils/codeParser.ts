/**
 * Extract code from LLM response that may be wrapped in markdown code fences.
 * Handles: ```python\n...\n```, ```\n...\n```, and bare code.
 */
export function extractCodeFromMarkdown(text: string): string {
  if (!text) return '';

  // Extract ALL fenced code blocks (```python ... ``` or ``` ... ```)
  const codeBlocks: string[] = [];
  const regex = /```[\w]*\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      codeBlocks.push(match[1].trim());
    }
  }

  if (codeBlocks.length > 0) {
    return codeBlocks.join('\n\n');
  }

  // Fallback: If no code blocks found, filter out markdown prose/bullets
  const lines = text.split('\n');
  const codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) continue;
    // Filter out conversational text lines starting with bullet points (-), questions (Wait, if...), or Markdown headers (# )
    if (
      /^\s*-\s+/.test(line) ||
      /^(Wait|Here|Note|In this|This test|For `|To test|\*|^#{1,6}\s+)/i.test(trimmed)
    ) {
      codeLines.push(`# [Prose Filtered] ${trimmed}`);
    } else {
      codeLines.push(line);
    }
  }

  return codeLines.join('\n').trim();
}

export function sanitizeTestImports(testCode: string): string {
  let cleaned = testCode;
  // Replace deprecated @testing-library/jest-dom/extend-expect sub-path with modern @testing-library/jest-dom
  cleaned = cleaned.replace(/@testing-library\/jest-dom\/extend-expect/g, '@testing-library/jest-dom');
  return cleaned;
}

export function fixPythonImports(testCode: string, correctModuleName: string): string {
  let formatted = testCode;

  // 0. Convert tabs to 4 spaces
  formatted = formatted.replace(/\t/g, '    ');

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

  // Strip top-level indentation for function definitions & decorators outside of classes
  const lineList = formatted.split('\n');
  let inClass = false;
  let classIndent = 0;

  for (let i = 0; i < lineList.length; i++) {
    const line = lineList[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('class ')) {
      inClass = true;
      classIndent = line.indexOf('class ');
      continue;
    }
    if (inClass) {
      const indent = line.search(/\S/);
      if (indent <= classIndent && trimmed.length > 0 && !trimmed.startsWith('#')) {
        inClass = false;
      }
    }

    if (!inClass) {
      if (/^\s+(async\s+)?def\s+test_/.test(line) || /^\s+@pytest\./.test(line)) {
        lineList[i] = trimmed;
      }
    }
  }
  formatted = lineList.join('\n');

  // Ensure BOTH `from <module> import *` AND `import <module>` exist
  const hasFromStar = new RegExp(`from\\s+${correctModuleName}\\s+import`, 'i').test(formatted);
  const hasImportModule = new RegExp(`import\\s+${correctModuleName}\\b`, 'i').test(formatted);

  const importSet = new Set<string>();
  const mockSymbols = new Set<string>();
  const bodyLines: string[] = [];

  for (const line of formatted.split('\n')) {
    const trimmed = line.trim();
    if (/^from\s+unittest\.mock\s+import\s+/.test(trimmed)) {
      const symbols = trimmed.replace(/^from\s+unittest\.mock\s+import\s+/, '').split(',');
      symbols.forEach(s => mockSymbols.add(s.trim()));
    } else if (/^(import |from \w)/.test(trimmed)) {
      importSet.add(trimmed);
    } else {
      bodyLines.push(line);
    }
  }

  if (mockSymbols.size > 0) {
    const sortedMocks = Array.from(mockSymbols).sort().join(', ');
    importSet.add(`from unittest.mock import ${sortedMocks}`);
  }

  if (!hasImportModule) {
    importSet.add(`import ${correctModuleName}`);
  }
  if (!hasFromStar) {
    importSet.add(`from ${correctModuleName} import *`);
  }

  const sortedImports = Array.from(importSet).sort();
  const cleanBody = bodyLines.join('\n').trim();

  return [
    ...sortedImports,
    '',
    '',
    cleanBody
  ].join('\n');
}
