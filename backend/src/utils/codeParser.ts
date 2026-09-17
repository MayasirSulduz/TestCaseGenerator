export function extractCodeFromMarkdown(text: string): string {
  let cleaned = text.replace(/^```[\w]*\n/gm, '');
  cleaned = cleaned.replace(/\n```$/gm, '');
  cleaned = cleaned.trim();

  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    const lines = cleaned.split('\n');
    cleaned = lines.slice(1, -1).join('\n');
  }

  return cleaned;
}

export function sanitizeTestImports(testCode: string): string {
  let cleaned = testCode;
  // Replace deprecated @testing-library/jest-dom/extend-expect sub-path with modern @testing-library/jest-dom
  cleaned = cleaned.replace(/@testing-library\/jest-dom\/extend-expect/g, '@testing-library/jest-dom');
  return cleaned;
}

export function fixPythonImports(testCode: string, correctModuleName: string): string {
  const wrongPatterns = [
    /from your_module import/gi,
    /from module import/gi,
    /from source import/gi,
    /from app import/gi,
    /from main import/gi,
    /import your_module/gi,
    /import module/gi
  ];

  let formatted = testCode;
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
