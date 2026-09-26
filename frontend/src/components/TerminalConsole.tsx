import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface LogEntry {
  id: string;
  tag: 'TESTCRAFT AI' | 'INFRA' | 'TEST' | 'AUTO-REPAIR' | 'STATUS' | 'LOG' | 'ERROR';
  text: string;
  timestamp: string;
}

interface TerminalConsoleProps {
  logs: LogEntry[];
  onClearLogs?: () => void;
  isLoading?: boolean;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  logs,
  onClearLogs,
  isLoading = false
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopyLogs = () => {
    const rawText = logs.map(l => `[${l.timestamp}] [${l.tag}]: ${l.text}`).join('\n');
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    toast.success('Terminal logs copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getTagStyle = (tag: LogEntry['tag']) => {
    switch (tag) {
      case 'TESTCRAFT AI':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'INFRA':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      case 'TEST':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'AUTO-REPAIR':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'STATUS':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'ERROR':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between h-full min-h-[300px]">
      {/* Terminal Window Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Terminal className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Local Sandbox Runner
          </h3>
        </div>

        {/* Tab & Actions */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-indigo-300 rounded-xl border border-slate-700">
            Console Log
          </span>
          <button
            onClick={handleCopyLogs}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
            title="Copy logs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
              title="Clear logs"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Screen Container */}
      <div className="my-3 p-4 bg-slate-950/90 border border-slate-850 rounded-2xl font-mono text-[11px] leading-relaxed text-slate-300 h-52 overflow-y-auto space-y-2 select-text shadow-inner">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <Terminal className="h-6 w-6 text-slate-700 mb-1" />
            <span>Sandbox runner idle. Click Generate to start execution...</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 break-all">
              <span className="text-slate-600 text-[10px] shrink-0 font-sans mt-0.5">
                {log.timestamp}
              </span>
              <span
                className={`px-1.5 py-0.2 text-[9px] font-bold rounded border uppercase shrink-0 ${getTagStyle(
                  log.tag
                )}`}
              >
                [{log.tag}]
              </span>
              <span className="text-slate-200">{log.text}</span>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-indigo-400 text-xs animate-pulse pt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            <span>Running sandbox iteration...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Terminal Status Bar */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isLoading ? 'bg-amber-400 animate-ping' : logs.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'
            }`}
          ></span>
          <span>{isLoading ? 'Sandbox Active' : logs.length > 0 ? 'Execution Complete' : 'Sandbox Ready'}</span>
        </span>
        <span className="font-mono text-slate-500 text-[10px]">
          runner: pytest/jest/nyc
        </span>
      </div>
    </div>
  );
};

export default TerminalConsole;
