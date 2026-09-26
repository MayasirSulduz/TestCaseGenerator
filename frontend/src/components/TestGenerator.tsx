import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
  ChevronRight,
  Sliders
} from 'lucide-react';
import { toast } from 'sonner';
import { detectFramework, generateTests } from '../services/api';
import { CoverageReport } from '../types';
import CodeViewer from './CodeViewer';
import CoverageSlider from './CoverageSlider';
import FileUpload from './FileUpload';
import FrameworkSelector from './FrameworkSelector';
import CoverageGauge from './CoverageGauge';
import TerminalConsole, { LogEntry } from './TerminalConsole';

interface TestGeneratorProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

const TestGenerator: React.FC<TestGeneratorProps> = ({ sidebarOpen = true, setSidebarOpen }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceCode, setSourceCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('JavaScript');
  const [framework, setFramework] = useState<string>('Jest');
  const [availableFrameworks, setAvailableFrameworks] = useState<string[]>(['Jest', 'Mocha', 'Jasmine']);
  const [coverageTarget, setCoverageTarget] = useState<number>(80);
  const [generatedTests, setGeneratedTests] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (tag: LogEntry['tag'], text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        tag,
        text,
        timestamp
      }
    ]);
  };

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setSourceCode('');
      return;
    }

    setSelectedFile(file);
    setError('');
    setLoading(true);

    try {
      const text = await file.text();
      setSourceCode(text);

      const data = await detectFramework(file.name);
      if (data.status === 'success') {
        setLanguage(data.language);
        setFramework(data.framework);
        setAvailableFrameworks(data.availableFrameworks);
        setSuccess(`Detected: ${data.language} (${data.framework})`);
        addLog('INFRA', `Detected language: ${data.language}, framework: ${data.framework}`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError('Failed to process file: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!sourceCode) {
      setError('Please upload or select a source file first');
      return;
    }

    // Auto-fold sidebar as soon as Generate Test Suite is clicked
    if (setSidebarOpen) {
      setSidebarOpen(false);
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      setGeneratedTests('');
      setCoverageReport(null);
      setModelUsed('');

      const filename = selectedFile ? selectedFile.name : 'module';

      // Log initial sandbox setup
      addLog('INFRA', `Initializing local test runner sandbox for ${language}...`);
      addLog('TEST', `Target source code file: ${filename}`);
      addLog('STATUS', `Setting coverage goal: ${coverageTarget}% using ${framework}`);

      const result = await generateTests(sourceCode, language, framework, coverageTarget, filename);

      if (result.status === 'success' && result.tests) {
        setGeneratedTests(result.tests);
        setCoverageReport(result.coverageReport || null);
        setModelUsed(result.modelUsed || '');

        addLog('TEST', `Successfully generated test suite (${result.tests.length} bytes).`);

        if (result.coverageReport) {
          addLog('STATUS', `Execution runner command: ${result.coverageReport.runCommand}`);
          addLog('STATUS', `Coverage achieved: ${result.coverageReport.totalCoverage}% / ${coverageTarget}% Target`);

          if (result.coverageReport.missingLines && result.coverageReport.missingLines !== 'None') {
            addLog('AUTO-REPAIR', `Uncovered lines detected: ${result.coverageReport.missingLines}`);
            addLog('AUTO-REPAIR', `🤖 AI Auto-Repair Agent triggered: fixing failing assertions & execution errors`);
            addLog('AUTO-REPAIR', `Ensure mock implementations match component interfaces`);
          }
        }

        // Toast notifications for model fallback
        if (result.fallbackUsed) {
          toast.warning(`Switched to backup model: ${result.modelUsed}`, {
            description: result.fallbackReason || 'Primary model was unavailable',
            duration: 6000
          });
        } else {
          toast.success(`Tests generated using ${result.modelUsed || 'AI'}`, {
            duration: 3000
          });
        }

        setSuccess('Test suite generated successfully with local coverage analysis!');
      } else {
        setError(result.message || 'Failed to generate tests');
        addLog('ERROR', `Generation failed: ${result.message || 'Unknown error'}`);
        toast.error('Test generation failed', {
          description: result.message || 'Check your API keys and try again',
          duration: 8000
        });
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || String(err);
      setError('Error: ' + errMsg);
      addLog('ERROR', `Execution error: ${errMsg}`);
      toast.error('Test generation error', {
        description: errMsg,
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner Alert Notifications */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
        {/* Left Sidebar Config Panel (Collapsible) */}
        {sidebarOpen && (
          <div className="lg:col-span-4 xl:col-span-3 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 flex flex-col gap-6 shadow-2xl backdrop-blur-xl transition-all duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-400" /> Controls & Config
              </span>
              {setSidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-800 hover:border-slate-700"
                >
                  Fold ✕
                </button>
              )}
            </div>

            <FileUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />

            <hr className="border-slate-800/80 my-0.5" />

            <FrameworkSelector
              language={language}
              framework={framework}
              availableFrameworks={availableFrameworks}
              onFrameworkChange={setFramework}
            />

            <hr className="border-slate-800/80 my-0.5" />

            <CoverageSlider value={coverageTarget} onChange={setCoverageTarget} />

            <button
              onClick={handleGenerateTests}
              disabled={loading || !sourceCode}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-2 ${
                loading || !sourceCode
                  ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/40'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Running Iterative LLM...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-white" />
                  <span>Generate Test Suite</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Main Dashboard Workspace (Expands dynamically when sidebar folds) */}
        <div className={`${sidebarOpen ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} flex flex-col gap-6 w-full transition-all duration-300`}>
          {/* If sidebar is closed, provide a subtle toggle button at top */}
          {!sidebarOpen && (
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-2.5 backdrop-blur-xl">
              <button
                onClick={() => setSidebarOpen && setSidebarOpen(true)}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-2"
              >
                <Sliders className="h-4 w-4" /> Open Configuration Sidebar
              </button>
              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                <span>File: <strong className="text-slate-300">{selectedFile ? selectedFile.name : 'module'}</strong></span>
                <span>•</span>
                <span>Target: <strong className="text-indigo-400">{coverageTarget}%</strong></span>
              </div>
            </div>
          )}

          {generatedTests || loading ? (
            /* 4-PANEL DASHBOARD GRID (2x2 on desktop, stacked on mobile) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
              {/* PANEL 1 (Top-Left): Code Viewer */}
              <div className="w-full flex flex-col">
                <CodeViewer
                  code={generatedTests || '// Generating test suite...'}
                  fileName={selectedFile ? selectedFile.name : 'module'}
                  framework={framework}
                  language={language}
                />
              </div>

              {/* PANEL 2 (Top-Right): Interactive Coverage Gauge */}
              <div className="w-full flex flex-col">
                <CoverageGauge
                  coverage={coverageReport ? coverageReport.totalCoverage : 0}
                  targetCoverage={coverageTarget}
                  testPassed={coverageReport ? coverageReport.totalCoverage >= coverageTarget : false}
                  executionTimeSec={coverageReport?.executionTimeSec}
                  linesCoveredText={coverageReport?.totalCoverage ? `${coverageReport.totalCoverage}% Covered` : undefined}
                  isLoading={loading}
                />
              </div>

              {/* PANEL 3 (Bottom-Left): Local Sandbox Runner Terminal Console */}
              <div className="w-full flex flex-col">
                <TerminalConsole
                  logs={logs}
                  onClearLogs={() => setLogs([])}
                  isLoading={loading}
                />
              </div>

              {/* PANEL 4 (Bottom-Right): Real Execution Metrics & Uncovered Lines */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between h-full min-h-[300px] w-full">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Real Coverage Execution Metrics
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {coverageReport?.executionTimeSec && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 flex items-center gap-1">
                        ⏱️ {coverageReport.executionTimeSec}s
                      </span>
                    )}
                    {modelUsed && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        {modelUsed}
                      </span>
                    )}
                    <span
                      className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-xl border ${
                        (coverageReport?.totalCoverage || 0) >= coverageTarget
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      }`}
                    >
                      {coverageReport ? coverageReport.totalCoverage : 0}% / {coverageTarget}% Target
                    </span>
                  </div>
                </div>

                {/* Content Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3 text-xs">
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                      <Terminal className="h-3 w-3 text-indigo-400" /> Runner Command:
                    </span>
                    <code className="text-indigo-300 font-mono bg-slate-900 p-2 rounded-xl border border-slate-850 overflow-x-auto select-all text-[11px]">
                      {coverageReport?.runCommand || `python3 -m pytest test.py --cov`}
                    </code>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-amber-400" /> Missing / Uncovered Lines:
                    </span>
                    <span className="text-amber-300 font-mono bg-slate-900 p-2 rounded-xl border border-slate-850 text-[11px]">
                      {coverageReport?.missingLines || 'None'}
                    </span>
                  </div>
                </div>

                {/* Execution Table / Output */}
                {coverageReport?.summaryTable && coverageReport.summaryTable !== 'N/A' && (
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col gap-1.5 text-xs font-mono overflow-hidden my-1">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 font-sans">
                      <Terminal className="h-3 w-3 text-emerald-400" /> Execution Report Table:
                    </span>
                    <pre className="text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-850 overflow-x-auto text-[10px] leading-relaxed max-h-24">
                      {coverageReport.summaryTable}
                    </pre>
                  </div>
                )}

                {/* Iterative Feedback Loop Summary */}
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-xs flex flex-col gap-1.5 mt-auto">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Iterative Feedback Loop Summary:
                  </span>
                  <ul className="space-y-1 text-slate-400 text-[11px]">
                    {coverageReport?.suggestions && coverageReport.suggestions.length > 0 ? (
                      coverageReport.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-400">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex items-start gap-1.5">
                          <span className="text-indigo-400">•</span>
                          <span>🤖 AI Auto-Repair Agent triggered: fixing failing assertions & execution errors</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-indigo-400">•</span>
                          <span>Ensure mock implementations match component interfaces</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            /* INITIAL EMPTY STATE HERO CARD */
            <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 sm:p-14 flex flex-col items-center justify-center text-center gap-6 min-h-[520px] backdrop-blur-xl">
              <div className="relative flex items-center justify-center">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-indigo-600/20 to-cyan-400/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-2xl">
                  <Code2 className="h-10 w-10 text-cyan-400" />
                </div>
                <Sparkles className="h-6 w-6 text-amber-400 absolute -top-2 -right-2 animate-bounce" />
              </div>

              <div className="max-w-md">
                <h3 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                  Automated Unit Testing & Real Coverage Studio
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Upload your code on the left sidebar to automatically run local test sandbox runners (`pytest`, `jest`, `nyc`, `jacoco`), measure coverage line gaps, and iteratively refine tests.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-4">
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-left">
                  <Terminal className="h-4 w-4 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-200">Local Sandbox</p>
                    <p className="text-[10px] text-slate-500">pytest, jest, mocha</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-left">
                  <GitBranch className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-200">Refinement Loop</p>
                    <p className="text-[10px] text-slate-500">Auto-fixes line gaps</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-left">
                  <Cpu className="h-4 w-4 text-cyan-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-200">Multi-Model AI</p>
                    <p className="text-[10px] text-slate-500">Auto-fallback chain</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestGenerator;
