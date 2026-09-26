import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Code2, Copy, Download, Terminal } from 'lucide-react';
import { CodeViewerProps } from '../types';
import { downloadFile, getTestFileName } from '../utils/fileHelpers';

const CodeViewer: React.FC<CodeViewerProps> = ({ code, fileName, framework, language }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lineNumbers = useMemo(() => {
    if (!code) return '';
    const lines = code.split('\n');
    return lines.map((_, index) => index + 1).join('\n');
  }, [code]);

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

  return (
    <div className="flex flex-col bg-slate-900/80 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl h-full min-h-[300px]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/90 border-b border-slate-800">
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
      <div className="flex relative font-mono text-xs leading-relaxed h-[260px] overflow-hidden bg-[#070a12]">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="select-none py-4 px-3.5 text-right text-slate-600 bg-slate-900/30 border-r border-slate-850 overflow-hidden font-mono min-w-[50px]"
        >
          <pre>{lineNumbers}</pre>
        </div>

        {/* Code Content */}
        <div
          ref={codeContainerRef}
          className="py-4 px-5 overflow-auto w-full text-slate-200 selection:bg-indigo-500 selection:text-white"
        >
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;
