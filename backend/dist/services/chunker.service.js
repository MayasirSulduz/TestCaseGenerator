"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldChunk = shouldChunk;
exports.chunkCode = chunkCode;
exports.mergeTestChunks = mergeTestChunks;
const llm_service_1 = require("./llm.service");
// ── Constants ─────────────────────────────────────────────────────────────────
/** Token threshold above which source code is split into chunks (~750 lines). */
const CHUNK_TOKEN_THRESHOLD = 3000;
/** Target token count per chunk (~500 lines of code). */
const TARGET_CHUNK_TOKENS = 2000;
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Returns true if the source code is large enough to benefit from chunking.
 */
function shouldChunk(sourceCode) {
    return (0, llm_service_1.estimateTokenCount)(sourceCode) > CHUNK_TOKEN_THRESHOLD;
}
/**
 * Split source code into logical chunks by grouping functions/classes.
 * Target chunk size is ~2000 tokens (~500 lines).
 */
function chunkCode(sourceCode, language) {
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
function mergeTestChunks(chunks, language) {
    if (chunks.length === 0)
        return '';
    if (chunks.length === 1)
        return chunks[0];
    const imports = new Set();
    const testBodies = [];
    for (const chunk of chunks) {
        const lines = chunk.split('\n');
        const bodyLines = [];
        for (const line of lines) {
            if (isImportLine(line, language)) {
                imports.add(line);
            }
            else {
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
function detectBoundaries(lines, language) {
    const boundaries = [];
    const lang = language.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match = null;
        if (lang === 'python') {
            // Match top-level def/class (no leading whitespace)
            match = line.match(/^(def|class)\s+(\w+)/);
        }
        else if (lang === 'java') {
            // Match class declarations and public/private/protected methods
            match = line.match(/^\s*(public|private|protected)?\s*(static\s+)?(class|interface|enum)\s+(\w+)/)
                || line.match(/^\s*(public|private|protected)\s+(static\s+)?\w+[\w<>\[\],\s]*\s+(\w+)\s*\(/);
        }
        else {
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
 * Group consecutive boundaries into optimal chunk sizes (~2000 tokens / 500 lines).
 */
function splitByBoundaries(lines, boundaries) {
    const chunks = [];
    // File-level imports/header before first boundary
    const headerEnd = boundaries[0].line;
    const header = headerEnd > 0 ? lines.slice(0, headerEnd).join('\n') : '';
    let currentStartLine = boundaries[0].line;
    let currentNames = [];
    let currentLines = [];
    for (let i = 0; i < boundaries.length; i++) {
        const start = boundaries[i].line;
        const end = i + 1 < boundaries.length ? boundaries[i + 1].line : lines.length;
        const blockLines = lines.slice(start, end);
        currentNames.push(boundaries[i].name);
        currentLines.push(...blockLines);
        const candidateCode = header ? header + '\n\n' + currentLines.join('\n') : currentLines.join('\n');
        const tokenCount = (0, llm_service_1.estimateTokenCount)(candidateCode);
        const isLast = i === boundaries.length - 1;
        if (tokenCount >= TARGET_CHUNK_TOKENS || isLast) {
            const firstName = currentNames[0];
            const lastName = currentNames[currentNames.length - 1];
            const chunkName = currentNames.length > 1 ? `${firstName} to ${lastName}` : firstName;
            chunks.push({
                code: candidateCode,
                startLine: currentStartLine + 1,
                endLine: end,
                name: chunkName
            });
            // Reset for next chunk
            currentStartLine = end;
            currentNames = [];
            currentLines = [];
        }
    }
    return chunks.length > 0 ? chunks : splitByLines(lines);
}
function splitByLines(lines) {
    const linesPerChunk = 450; // ~1800 tokens per chunk
    const chunks = [];
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
function isImportLine(line, language) {
    const trimmed = line.trim();
    if (!trimmed)
        return false;
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
