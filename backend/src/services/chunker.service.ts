import { estimateTokenCount } from './llm.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CodeChunk {
  code: string;
  startLine: number;
  endLine: number;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Token threshold above which source code is split into chunks (~750 lines). */
const CHUNK_TOKEN_THRESHOLD = 3000;

/** Target token count per chunk (~500 lines of code). */
const TARGET_CHUNK_TOKENS = 2000;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the source code is large enough to benefit from chunking.
 */
export function shouldChunk(sourceCode: string): boolean {
  return estimateTokenCount(sourceCode) > CHUNK_TOKEN_THRESHOLD;
}

/**
 * Split source code into logical chunks by grouping functions/classes.
 * Target chunk size is ~2000 tokens (~500 lines).
 */
export function chunkCode(sourceCode: string, language: string, numChunks = 7): CodeChunk[] {
  const lines = sourceCode.split('\n');

  // Detect logical boundaries per language
  const boundaries = detectBoundaries(lines, language);

  if (boundaries.length < numChunks) {
    // No sufficient boundaries found — fall back to line-based splitting into numChunks parts
    return splitByLines(lines, numChunks);
  }

  return splitByBoundaries(lines, boundaries, numChunks);
}

/**
 * Merge multiple test code strings into a single combined test file.
 * Deduplicates import/require statements and combines test blocks.
 */
export function mergeTestChunks(
  chunks: string[],
  language: string
): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0];

  const imports = new Set<string>();
  const testBodies: string[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const bodyLines: string[] = [];

    for (const line of lines) {
      if (isImportLine(line, language)) {
        imports.add(line.trim());
      } else {
        bodyLines.push(line);
      }
    }

    const body = bodyLines.join('\n').trim();
    if (body) {
      testBodies.push(body);
    }
  }

  const sortedImports = [...imports].sort();

  // For Python: safely combine imports at top and append test blocks cleanly
  if (language.toLowerCase() === 'python') {
    return mergePythonTests(sortedImports, testBodies);
  }

  return [
    ...sortedImports,
    '',
    ...testBodies
  ].join('\n\n');
}

/**
 * Python-specific merge: gather imports at the top, deduplicate function definitions,
 * and filter out incomplete/truncated function stubs caused by LLM token limits.
 */
function mergePythonTests(initialImports: string[], chunks: string[]): string {
  const finalImports = new Set<string>(initialImports);
  const functionMap = new Map<string, string>(); // funcName -> fullCode
  const otherStatements: string[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    let currentDecorators: string[] = [];
    let currentFuncName: string | null = null;
    let currentFuncLines: string[] = [];

    const flushCurrentFunc = () => {
      if (currentFuncName && currentFuncLines.length > 0) {
        const fullFuncCode = [...currentDecorators, ...currentFuncLines].join('\n');
        
        // Validate if function is complete (has at least 1 indented statement or valid body line)
        const bodyLines = currentFuncLines.slice(1).filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
        const hasBody = bodyLines.length > 0 && bodyLines.some(l => l.startsWith(' ') || l.startsWith('\t'));
        const lastLine = currentFuncLines[currentFuncLines.length - 1].trim();
        const isTruncated = lastLine.endsWith('def') || lastLine.endsWith('(') || lastLine.endsWith('=') || lastLine.endsWith(',') || !hasBody;

        if (!isTruncated) {
          const existing = functionMap.get(currentFuncName);
          // Keep the existing complete function or overwrite if new version is longer/more complete
          if (!existing || fullFuncCode.length >= existing.length) {
            functionMap.set(currentFuncName, fullFuncCode);
          }
        }
      }
      currentDecorators = [];
      currentFuncName = null;
      currentFuncLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (isImportLine(line, 'python')) {
        finalImports.add(trimmed);
        continue;
      }

      if (trimmed.startsWith('@')) {
        if (currentFuncName) flushCurrentFunc();
        currentDecorators.push(line);
        continue;
      }

      const defMatch = line.match(/^(\s*)(async\s+)?(def|class)\s+(\w+)/);
      if (defMatch && defMatch[1].length === 0) { // Top-level def or class
        if (currentFuncName) flushCurrentFunc();
        currentFuncName = defMatch[4];
        currentFuncLines.push(line);
        continue;
      }

      if (currentFuncName) {
        if (line.startsWith(' ') || line.startsWith('\t') || trimmed === '') {
          currentFuncLines.push(line);
        } else {
          flushCurrentFunc();
          if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('=')) {
            otherStatements.push(line);
          }
        }
      } else {
        if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('=')) {
          otherStatements.push(line);
        }
      }
    }
    flushCurrentFunc();
  }

  const sortedImports = Array.from(finalImports).sort();
  const sortedFunctions = Array.from(functionMap.values());

  return [
    ...sortedImports,
    '',
    '',
    ...(otherStatements.length ? [otherStatements.join('\n'), ''] : []),
    sortedFunctions.join('\n\n')
  ].join('\n');
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

interface Boundary {
  line: number;
  name: string;
}

function detectBoundaries(lines: string[], language: string): Boundary[] {
  const boundaries: Boundary[] = [];
  const lang = language.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpMatchArray | null = null;

    if (lang === 'python') {
      // Match top-level def/class (no leading whitespace)
      match = line.match(/^(def|class)\s+(\w+)/);
    } else if (lang === 'java') {
      // Match class declarations and public/private/protected methods
      match = line.match(/^\s*(public|private|protected)?\s*(static\s+)?(class|interface|enum)\s+(\w+)/)
        || line.match(/^\s*(public|private|protected)\s+(static\s+)?\w+[\w<>\[\],\s]*\s+(\w+)\s*\(/);
    } else {
      // JavaScript / TypeScript
      match = line.match(/^(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)/)
        || line.match(/^(export\s+)?(default\s+)?class\s+(\w+)/)
        || line.match(/^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/)
        || line.match(/^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?function/);
    }

    if (match) {
      const name = match[match.length - 1] || match[0];
      boundaries.push({ line: i, name: typeof name === 'string' ? name : `block_${i}` });
    }
  }

  return boundaries;
}

/**
 * Group consecutive boundaries into numChunks (default 7) parts.
 */
function splitByBoundaries(lines: string[], boundaries: Boundary[], numChunks = 7): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const totalLines = lines.length;
  const targetLinesPerChunk = Math.ceil(totalLines / numChunks);

  const headerEnd = boundaries[0].line;
  const header = headerEnd > 0 ? lines.slice(0, headerEnd).join('\n') : '';

  let currentStartLine = boundaries[0].line;
  let currentNames: string[] = [];
  let currentLines: string[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].line;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].line : totalLines;
    const blockLines = lines.slice(start, end);

    currentNames.push(boundaries[i].name);
    currentLines.push(...blockLines);

    const isLastBoundary = i === boundaries.length - 1;
    const chunkFull = currentLines.length >= targetLinesPerChunk;
    const haveReachedNumChunksLimit = chunks.length === numChunks - 1;

    if ((chunkFull && !haveReachedNumChunksLimit) || isLastBoundary) {
      const candidateCode = header ? header + '\n\n' + currentLines.join('\n') : currentLines.join('\n');
      const firstName = currentNames[0] || `Part ${chunks.length + 1}`;
      const lastName = currentNames[currentNames.length - 1] || firstName;
      const chunkName = currentNames.length > 1 ? `${firstName} to ${lastName}` : firstName;

      chunks.push({
        code: candidateCode,
        startLine: currentStartLine + 1,
        endLine: end,
        name: chunkName
      });

      currentStartLine = end;
      currentNames = [];
      currentLines = [];
    }
  }

  return chunks.length > 0 ? chunks : splitByLines(lines, numChunks);
}

function splitByLines(lines: string[], numChunks = 7): CodeChunk[] {
  const linesPerChunk = Math.max(1, Math.ceil(lines.length / numChunks));
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const end = Math.min(i + linesPerChunk, lines.length);
    const chunkNum = chunks.length + 1;
    chunks.push({
      code: lines.slice(i, end).join('\n'),
      startLine: i + 1,
      endLine: end,
      name: `Part ${chunkNum}/${numChunks} (lines ${i + 1}-${end})`
    });
  }

  return chunks;
}

function isImportLine(line: string, language: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const lang = language.toLowerCase();

  if (lang === 'python') {
    return /^(import |from \w)/.test(trimmed);
  }

  if (lang === 'java') {
    return /^(import |package )/.test(trimmed);
  }

  // JS/TS
  return /^(import |const \{.*\}\s*=\s*require|require\()/.test(trimmed)
    || /^import\s+['"]/.test(trimmed);
}
