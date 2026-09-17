import { estimateTokenCount } from './llm.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CodeChunk {
  code: string;
  startLine: number;
  endLine: number;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Token threshold above which we split the source code into chunks. */
const CHUNK_TOKEN_THRESHOLD = 4000;

/** Approximate max tokens per chunk (target, not hard limit). */
const MAX_CHUNK_TOKENS = 3500;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the source code is large enough to benefit from chunking.
 */
export function shouldChunk(sourceCode: string): boolean {
  return estimateTokenCount(sourceCode) > CHUNK_TOKEN_THRESHOLD;
}

/**
 * Split source code into logical chunks by function/class boundaries.
 * Falls back to line-based splitting if no boundaries are detected.
 */
export function chunkCode(sourceCode: string, language: string): CodeChunk[] {
  const lines = sourceCode.split('\n');

  // Detect logical boundaries per language
  const boundaries = detectBoundaries(lines, language);

  if (boundaries.length <= 1) {
    // No meaningful boundaries found — fall back to line-based splitting
    return splitByLines(lines);
  }

  return splitByBoundaries(lines, boundaries);
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
        imports.add(line);
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
  return [
    ...sortedImports,
    '',
    ...testBodies
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
      // Extract the function/class name from the last captured group
      const name = match[match.length - 1] || match[0];
      boundaries.push({ line: i, name: typeof name === 'string' ? name : `block_${i}` });
    }
  }

  return boundaries;
}

function splitByBoundaries(lines: string[], boundaries: Boundary[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // Collect any file-level imports/header before the first boundary
  const headerEnd = boundaries[0].line;
  const header = headerEnd > 0 ? lines.slice(0, headerEnd).join('\n') : '';

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].line;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].line : lines.length;
    let chunkCode = lines.slice(start, end).join('\n');

    // Prepend header (imports) to each chunk so the LLM has full context
    if (header) {
      chunkCode = header + '\n\n' + chunkCode;
    }

    // Check if this chunk is too large; if so, merge with adjacent
    const tokens = estimateTokenCount(chunkCode);
    if (tokens > MAX_CHUNK_TOKENS && chunks.length > 0) {
      // Try to merge small chunks together
      const prev = chunks[chunks.length - 1];
      const mergedTokens = estimateTokenCount(prev.code + '\n' + chunkCode);
      if (mergedTokens <= MAX_CHUNK_TOKENS * 1.5) {
        chunks[chunks.length - 1] = {
          code: prev.code + '\n' + lines.slice(start, end).join('\n'),
          startLine: prev.startLine,
          endLine: end,
          name: `${prev.name} + ${boundaries[i].name}`
        };
        continue;
      }
    }

    chunks.push({
      code: chunkCode,
      startLine: start + 1,
      endLine: end,
      name: boundaries[i].name
    });
  }

  // If chunking produced only 1 chunk, it means the file is essentially one big block.
  // Return as-is — the fallback engine will handle it.
  return chunks;
}

function splitByLines(lines: string[]): CodeChunk[] {
  const linesPerChunk = 250;
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const end = Math.min(i + linesPerChunk, lines.length);
    chunks.push({
      code: lines.slice(i, end).join('\n'),
      startLine: i + 1,
      endLine: end,
      name: `lines_${i + 1}_to_${end}`
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
