import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Code2, Copy, Download, RefreshCw, Sparkles, Terminal, Zap } from 'lucide-react';
import { CodeViewerProps } from '../types';
import { downloadFile, getTestFileName } from '../utils/fileHelpers';

const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  fileName,
  framework,
  language,
  isLoading = false,
  statusPhase
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [displayedCode, setDisplayedCode] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Typewriter Streaming Animation Effect
  useEffect(() => {
    if (!code) {
      setDisplayedCode('');
      setIsTyping(false);
      return;
    }

    if (code.startsWith('// Real-time')) {
      setDisplayedCode(code);
      setIsTyping(false);
      return;
    }

    // Split preserving whitespace and tokens
    const tokens = code.split(/(\s+)/);
    let tokenIndex = 0;
    setIsTyping(true);

    const interval = setInterval(() => {
      tokenIndex += 3; // Advance 3 tokens per 16ms tick
      if (tokenIndex >= tokens.length) {
        setDisplayedCode(code);
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
  }, [code]);

  const lineNumbers = useMemo(() => {
    const activeText = displayedCode || code || '';
    if (!activeText) return '1';
    const lines = activeText.split('\n');
    return lines.map((_, index) => index + 1).join('\n');
  }, [displayedCode, code]);

  useEffect(() => {
    const codeContainer = codeContainerRef.current;
    const lineNumbersDiv = lineNumbersRef.current;

    if (!codeContainer || !lineNumbersDiv) return;

    const handleScroll = () => {
      lineNumbersDiv.scrollTop = codeContainer.scrollTop;
    };

    codeContainer.addEventListener('scroll', handleScroll);
    return () => codeContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const testFileName = getTestFileName(fileName, framework);
    downloadFile(code, testFileName);
  };

  // Determine active status badge
  const activePhase = statusPhase || (isLoading ? (displayedCode && isTyping ? 'generating' : 'thinking') : 'complete');

  return (
    <div className="flex flex-col bg-slate-900/80 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl h-full w-full">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-950/90 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
            <Code2 className="h-4 w-4" />
            <span>Generated {framework} Unit Tests</span>
          </div>

          {/* Tab Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-mono font-medium text-slate-200 shadow-inner">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span>{getTestFileName(fileName, framework)}</span>
          </div>

          {/* Dynamic AI Status Badges */}
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
            title="Download test file"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex flex-1 h-full relative font-mono text-xs leading-relaxed overflow-hidden bg-[#070a12]">
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
            <code>{displayedCode || code}</code>
            {isTyping && <span className="inline-block w-2 h-4 ml-0.5 bg-indigo-400 animate-pulse vertical-bottom">▌</span>}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;
