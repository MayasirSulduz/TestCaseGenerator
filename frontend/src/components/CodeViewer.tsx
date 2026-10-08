import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Code2, Copy, Download, RefreshCw, Sparkles, Terminal, Zap, FileCode, Layers, ShieldCheck, Flame, CheckSquare, Square, Target, FolderTree, Package } from 'lucide-react';
import JSZip from 'jszip';
import { CodeViewerProps } from '../types';
import { downloadFile, getTestFileName } from '../utils/fileHelpers';

const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  fileName,
  framework,
  language,
  isLoading = false,
  statusPhase,
  sourceCode,
  missingLines,
  coverage = 0,
  onGenerateTargetedLines,
  projectTestFiles = [],
  isZipUpload = false,
  selectedFileIdx,
  onSelectFileIdx
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'heatmap'>('tests');
  const [copied, setCopied] = useState<boolean>(false);
  const [displayedCode, setDisplayedCode] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [selectedTestFileIdx, setSelectedTestFileIdx] = useState<number>(0);

  const effectiveSelectedIdx = selectedFileIdx !== undefined ? selectedFileIdx : selectedTestFileIdx;

  const handleSelectFile = (idx: number) => {
    setSelectedTestFileIdx(idx);
    if (onSelectFileIdx) {
      onSelectFileIdx(idx);
    }
  };

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Active code string based on selected test file in multi-file project tree
  const activeCodeString = useMemo(() => {
    if (projectTestFiles && projectTestFiles.length > 0 && effectiveSelectedIdx < projectTestFiles.length) {
      return projectTestFiles[effectiveSelectedIdx].content;
    }
    return code;
  }, [code, projectTestFiles, effectiveSelectedIdx]);

  // Active file display name
  const activeDisplayFileName = useMemo(() => {
    if (projectTestFiles && projectTestFiles.length > 0 && effectiveSelectedIdx < projectTestFiles.length) {
      return projectTestFiles[effectiveSelectedIdx].filename;
    }
    return getTestFileName(fileName, framework);
  }, [fileName, framework, projectTestFiles, effectiveSelectedIdx]);

  // Parse missing line string (e.g. "73, 74, 79, 132-140, 156") into Set<number>
  const missingLineSet = useMemo(() => {
    const missingSet = new Set<number>();
    if (!missingLines || missingLines === 'None' || missingLines === 'N/A' || missingLines === 'All lines') {
      return missingSet;
    }

    const cleaned = missingLines.replace(/^[^\d]*/, '').trim();
    const parts = cleaned.split(/[\s,]+/);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            missingSet.add(i);
          }
        }
      } else {
        const lineNum = parseInt(part, 10);
        if (!isNaN(lineNum)) {
          missingSet.add(lineNum);
        }
      }
    }
    return missingSet;
  }, [missingLines]);

  // Source lines array for Heatmap View
  const sourceLines = useMemo(() => {
    if (!sourceCode) return [];
    return sourceCode.split('\n');
  }, [sourceCode]);

  // Coverage statistics for Heatmap Summary
  const coverageStats = useMemo(() => {
    if (!sourceLines.length) return { covered: 0, missing: 0, total: 0 };
    let missing = 0;
    let covered = 0;

    sourceLines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return; // Skip blank or pure comment lines for stats
      }
      if (missingLineSet.has(lineNum)) {
        missing++;
      } else {
        covered++;
      }
    });

    return { covered, missing, total: covered + missing };
  }, [sourceLines, missingLineSet]);

  // Toggle selection of individual missing line
  const toggleLineSelection = (lineNum: number) => {
    const next = new Set(selectedLines);
    if (next.has(lineNum)) {
      next.delete(lineNum);
    } else {
      next.add(lineNum);
    }
    setSelectedLines(next);
  };

  // Select all missing lines at once
  const handleSelectAllMissing = () => {
    setSelectedLines(new Set(missingLineSet));
  };

  // Clear line selection
  const handleClearSelection = () => {
    setSelectedLines(new Set());
  };

  // Trigger targeted generation pass for selected lines
  const handleTriggerTargetedGeneration = () => {
    if (selectedLines.size === 0 || !onGenerateTargetedLines) return;
    const sortedLines = Array.from(selectedLines).sort((a, b) => a - b).join(', ');
    setActiveTab('tests');
    onGenerateTargetedLines(sortedLines);
  };

  // Typewriter Streaming Animation Effect
  useEffect(() => {
    const targetCode = activeCodeString;
    if (!targetCode) {
      setDisplayedCode('');
      setIsTyping(false);
      return;
    }

    if (targetCode.startsWith('// Real-time') || isZipUpload) {
      setDisplayedCode(targetCode);
      setIsTyping(false);
      return;
    }

    // Split preserving whitespace and tokens
    const tokens = targetCode.split(/(\s+)/);
    let tokenIndex = 0;
    setIsTyping(true);

    const interval = setInterval(() => {
      tokenIndex += 3; // Advance 3 tokens per 16ms tick
      if (tokenIndex >= tokens.length) {
        setDisplayedCode(targetCode);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        const nextChunk = tokens.slice(0, tokenIndex).join('');
        setDisplayedCode(nextChunk);

        if (codeContainerRef.current) {
          codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, [activeCodeString, isZipUpload]);

  const lineNumbers = useMemo(() => {
    const activeText = displayedCode || activeCodeString || '';
    if (!activeText) return '1';
    const lines = activeText.split('\n');
    return lines.map((_, index) => index + 1).join('\n');
  }, [displayedCode, activeCodeString]);

  useEffect(() => {
    const codeContainer = codeContainerRef.current;
    const lineNumbersDiv = lineNumbersRef.current;

    if (!codeContainer || !lineNumbersDiv) return;

    const handleScroll = () => {
      lineNumbersDiv.scrollTop = codeContainer.scrollTop;
    };

    codeContainer.addEventListener('scroll', handleScroll);
    return () => codeContainer.removeEventListener('scroll', handleScroll);
  }, [activeTab, selectedTestFileIdx]);

  const handleCopy = async () => {
    const targetText = activeTab === 'heatmap' ? (sourceCode || '') : activeCodeString;
    try {
      await navigator.clipboard.writeText(targetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = async () => {
    if (activeTab === 'heatmap') {
      downloadFile(sourceCode || '', fileName || 'source_file');
    } else if (isZipUpload || (projectTestFiles && projectTestFiles.length > 0)) {
      try {
        const zip = new JSZip();
        const testsFolder = zip.folder('tests') || zip;

        if (projectTestFiles && projectTestFiles.length > 0) {
          projectTestFiles.forEach((file) => {
            testsFolder.file(file.filename, file.content);
          });
        } else {
          testsFolder.file(activeDisplayFileName, activeCodeString);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tests.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        downloadFile(activeCodeString, activeDisplayFileName);
      }
    } else {
      downloadFile(activeCodeString, activeDisplayFileName);
    }
  };

  // Determine active status badge
  const activePhase = statusPhase || (isLoading ? (displayedCode && isTyping ? 'generating' : 'thinking') : 'complete');

  return (
    <div className="flex flex-col bg-slate-900/80 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl h-full w-full">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-950/90 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tab Switcher Pills */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center gap-1.5 ${
                activeTab === 'tests'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Generated Unit Tests</span>
            </button>

            {sourceCode && !isZipUpload && (
              <button
                onClick={() => setActiveTab('heatmap')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center gap-1.5 ${
                  activeTab === 'heatmap'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-amber-300" />
                <span>Source Coverage Heatmap</span>
                {coverage > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] border border-emerald-500/30">
                    {coverage}%
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Active File Name Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-mono font-medium text-slate-200 shadow-inner">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span>{activeTab === 'heatmap' ? fileName : activeDisplayFileName}</span>
          </div>

          {/* Dynamic AI Status Badges for Tests Tab */}
          {activeTab === 'tests' && (
            <>
              {activePhase === 'thinking' && (
                <span className="px-2.5 py-1 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-bold font-mono animate-pulse flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                  <span>🤖 AI Thinking & Analyzing AST...</span>
                </span>
              )}

              {(activePhase === 'generating' || isTyping) && (
                <span className="px-2.5 py-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[11px] font-bold font-mono flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400 animate-pulse" />
                  <span>⚡ Streaming Unit Testsuite...</span>
                </span>
              )}

              {activePhase === 'sandbox' && (
                <span className="px-2.5 py-1 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[11px] font-bold font-mono flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-sky-400 animate-spin" />
                  <span>🧪 Local Sandbox Executing...</span>
                </span>
              )}

              {activePhase === 'complete' && !isTyping && code && (
                <span className="px-2.5 py-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[11px] font-bold font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>✓ Complete & Verified</span>
                </span>
              )}
            </>
          )}

          {/* Heatmap Legend Badge & Batch Select Controls */}
          {activeTab === 'heatmap' && (
            <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                ✓ {coverageStats.covered} Lines Covered
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                ✗ {missingLineSet.size || coverageStats.missing} Missing Lines
              </span>

              {missingLineSet.size > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={handleSelectAllMissing}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 text-[10px] font-bold transition-all flex items-center gap-1"
                  >
                    <CheckSquare className="h-3 w-3" /> Select All Missing
                  </button>
                  {selectedLines.size > 0 && (
                    <button
                      onClick={handleClearSelection}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-[10px] transition-all"
                    >
                      Clear ({selectedLines.size})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
            title="Download code file"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Editor Area */}
      {activeTab === 'tests' ? (
        /* GENERATED UNIT TESTS VIEW */
        <div className="flex flex-1 h-full relative font-mono text-xs leading-relaxed overflow-hidden bg-[#070a12]">
          {/* Project File Tree Explorer Sidebar (Rendered when projectTestFiles are present) */}
          {projectTestFiles && projectTestFiles.length > 0 && (
            <div className="w-52 bg-slate-950/90 border-r border-slate-800 p-2 flex flex-col gap-1 shrink-0 font-mono text-xs overflow-y-auto custom-scrollbar select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center gap-1.5 border-b border-slate-800/80 mb-1">
                <FolderTree className="h-3.5 w-3.5 text-indigo-400" />
                <span>Test Suite Explorer</span>
              </span>
              {projectTestFiles.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectFile(idx)}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left transition-all flex items-center justify-between text-[11px] font-mono ${
                    effectiveSelectedIdx === idx
                      ? 'bg-indigo-600/30 border border-indigo-500/50 text-white font-bold ring-1 ring-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {file.isFixture ? (
                      <FileCode className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Code2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    )}
                    <span className="truncate">{file.filename}</span>
                  </span>
                  {file.coverage !== undefined && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-900 text-emerald-400 border border-slate-800 shrink-0">
                      {file.coverage}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Line Numbers */}
          <div
            ref={lineNumbersRef}
            className="select-none py-3.5 px-3.5 text-right text-slate-600 bg-slate-900/30 border-r border-slate-850 overflow-hidden font-mono min-w-[50px] h-full"
          >
            <pre>{lineNumbers}</pre>
          </div>

          {/* Code Content */}
          <div
            ref={codeContainerRef}
            className="py-3.5 px-5 overflow-auto w-full h-full text-slate-200 selection:bg-indigo-500 selection:text-white"
          >
            <pre>
              <code>{displayedCode || activeCodeString}</code>
              {isTyping && <span className="inline-block w-2 h-4 ml-0.5 bg-indigo-400 animate-pulse vertical-bottom">▌</span>}
            </pre>
          </div>
        </div>
      ) : (
        /* LINE-BY-LINE SOURCE COVERAGE HEATMAP VIEW WITH CHECKBOX SELECTION */
        <div className="flex flex-col flex-1 h-full relative font-mono text-xs leading-relaxed overflow-hidden bg-[#060810]">
          <div className="overflow-auto w-full h-full p-2 pb-16">
            {sourceLines.map((line, idx) => {
              const lineNum = idx + 1;
              const isMissing = missingLineSet.has(lineNum);
              const isSelected = selectedLines.has(lineNum);
              const trimmed = line.trim();
              const isBlankOrComment = !trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');

              return (
                <div
                  key={lineNum}
                  onClick={() => isMissing && toggleLineSelection(lineNum)}
                  className={`flex items-stretch font-mono text-xs transition-all rounded-md my-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/30 border-l-4 border-indigo-400 text-white ring-1 ring-indigo-500/50 shadow-md'
                      : isMissing
                      ? 'bg-red-500/15 border-l-4 border-red-500 text-red-200 font-semibold hover:bg-red-500/25'
                      : !isBlankOrComment
                      ? 'bg-emerald-500/5 border-l-4 border-emerald-500/40 text-slate-200'
                      : 'bg-slate-950/40 border-l-4 border-transparent text-slate-500'
                  }`}
                >
                  {/* Line Number & Checkbox Status Badge */}
                  <div className="select-none py-1 px-3 text-right text-slate-500 bg-slate-950/60 border-r border-slate-850 min-w-[90px] flex items-center justify-between gap-1.5 shrink-0 text-[10px]">
                    <span className="font-mono text-slate-600">{lineNum}</span>
                    {isMissing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleLineSelection(lineNum);
                          }}
                          className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className={`px-1 py-0.2 rounded border text-[9px] font-bold ${
                          isSelected ? 'bg-indigo-500/30 text-indigo-300 border-indigo-400/40' : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {isSelected ? '✓ Target' : '● Missing'}
                        </span>
                      </div>
                    ) : !isBlankOrComment ? (
                      <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                        ✓ Covered
                      </span>
                    ) : (
                      <span className="text-slate-700 text-[9px]">-</span>
                    )}
                  </div>

                  {/* Line Code Content */}
                  <div className="py-1 px-4 overflow-x-auto whitespace-pre w-full">
                    <code>{line || ' '}</code>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Action Bar for Selected Lines */}
          {selectedLines.size > 0 && onGenerateTargetedLines && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-20 px-4 py-2.5 bg-slate-950/95 border border-indigo-500/60 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold font-mono text-slate-100">
                  {selectedLines.size} Missing {selectedLines.size === 1 ? 'Line' : 'Lines'} Selected
                </span>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/30">
                  L{Array.from(selectedLines).sort((a, b) => a - b).slice(0, 4).join(', ')}{selectedLines.size > 4 ? '...' : ''}
                </span>
              </div>

              <button
                onClick={handleTriggerTargetedGeneration}
                disabled={isLoading}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/40 transition-all flex items-center gap-1.5 active:scale-95 font-mono"
              >
                <Zap className="h-3.5 w-3.5 fill-white" />
                <span>Generate Tests for Selected Lines</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeViewer;
