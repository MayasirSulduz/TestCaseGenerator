import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Cpu,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react';
import { detectFramework, generateTests } from '../services/api';
import { CoverageReport } from '../types';
import CodeViewer from './CodeViewer';
import CoverageSlider from './CoverageSlider';
import FileUpload from './FileUpload';
import FrameworkSelector from './FrameworkSelector';

const TestGenerator: React.FC = () => {
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

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      setGeneratedTests('');
      setCoverageReport(null);

      const filename = selectedFile ? selectedFile.name : 'module';

      const result = await generateTests(sourceCode, language, framework, coverageTarget, filename);

      if (result.status === 'success' && result.tests) {
        setGeneratedTests(result.tests);
        setCoverageReport(result.coverageReport || null);
        setSuccess('Test suite generated successfully with local coverage analysis!');
      } else {
        setError(result.message || 'Failed to generate tests');
      }
    } catch (err: any) {
      setError('Error: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Notifications */}
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

      {/* Main Full-Width Grid (3 Cols Sidebar, 9 Cols Workspace) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        {/* Left Sidebar Config Panel */}
        <div className="lg:col-span-4 xl:col-span-3 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex flex-col gap-6 shadow-2xl backdrop-blur-xl">
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

        {/* Right Main Editor Workspace (Full Screen Width Expansion) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6 w-full">
          {generatedTests ? (
            <>
              <CodeViewer
                code={generatedTests}
                fileName={selectedFile ? selectedFile.name : 'module'}
                framework={framework}
                language={language}
              />

              {coverageReport && (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Real Coverage Execution Metrics
                      </h4>
                    </div>
                    <span
                      className={`text-sm font-black font-mono px-3 py-1 rounded-xl border ${
                        coverageReport.totalCoverage >= coverageTarget
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      }`}
                    >
                      {coverageReport.totalCoverage}% / {coverageTarget}% Target
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-indigo-400" /> Terminal Runner Command:
                      </span>
                      <code className="text-indigo-300 font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-800 overflow-x-auto select-all">
                        {coverageReport.runCommand}
                      </code>
                    </div>

                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-amber-400" /> Missing / Uncovered Lines:
                      </span>
                      <span className="text-amber-300 font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        {coverageReport.missingLines}
                      </span>
                    </div>
                  </div>

                  {coverageReport.suggestions && coverageReport.suggestions.length > 0 && (
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-xs flex flex-col gap-2">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-400" /> Iterative Feedback Loop Summary:
                      </span>
                      <ul className="space-y-1.5 text-slate-400">
                        {coverageReport.suggestions.map((suggestion, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs">
                            <span className="text-indigo-400">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Studio Hero Empty State */
            <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 sm:p-14 flex flex-col items-center justify-center text-center gap-6 min-h-[520px] backdrop-blur-xl">
              <div className="relative flex items-center justify-center">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-indigo-600/20 to-cyan-400/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-2xl">
                  <Code2 className="h-10 w-10 text-cyan-400" />
                </div>
                <Sparkles className="h-6 w-6 text-amber-400 absolute -top-2 -right-2 animate-bounce-slow" />
              </div>

              <div className="max-w-md">
                <h3 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                  Automated Unit Testing & Real Coverage Studio
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Upload your code on the left sidebar to automatically run local test sandbox runners (`pytest`, `jest`, `nyc`, `jacoco`), measure coverage line gaps, and iteratively refine tests using Llama 3.3.
                </p>
              </div>

              {/* Feature Badge Cards */}
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
                    <p className="text-[11px] font-bold text-slate-200">Multi-Language</p>
                    <p className="text-[10px] text-slate-500">Python, JS, TS, Java</p>
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
