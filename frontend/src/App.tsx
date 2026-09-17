import React, { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import TestGenerator from './components/TestGenerator';
import { checkHealth } from './services/api';
import { HealthCheckResult } from './types';

const App: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [healthInfo, setHealthInfo] = useState<HealthCheckResult | null>(null);

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    setBackendStatus('checking');
    try {
      const response = await checkHealth();
      setHealthInfo(response);
      if (response.status === 'success' || response.status === 'ok') {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-50 w-full bg-[#0b0f19]/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 lg:px-12 py-3.5 flex items-center justify-between shadow-2xl">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[15px] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                TestCraft AI
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full">
                v2.0 TS
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI-Driven Multi-Language Unit Test Generation & Coverage Engine
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3">
          {healthInfo?.runtime_environment && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] font-medium text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>
                Python: {healthInfo.runtime_environment.python ? '✓' : '✗'} | Node:{' '}
                {healthInfo.runtime_environment.node ? '✓' : '✗'}
              </span>
            </div>
          )}

          {backendStatus === 'checking' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full animate-pulse">
              <Activity className="h-3.5 w-3.5 animate-spin" /> Checking Backend...
            </span>
          )}

          {backendStatus === 'connected' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full shadow-sm shadow-emerald-950">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Backend Connected
            </span>
          )}

          {backendStatus === 'error' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-full">
              <AlertCircle className="h-3.5 w-3.5" /> Disconnected
            </span>
          )}
        </div>
      </header>

      {/* Main Full-Width Content Container */}
      <main className="w-full flex-1 px-4 sm:px-8 lg:px-12 py-6">
        {backendStatus === 'error' ? (
          <div className="w-full max-w-xl mx-auto my-16 p-8 bg-slate-900/80 border border-red-500/20 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col items-center text-center gap-5">
            <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 shadow-lg">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Backend Connection Failed</h2>
              <p className="text-sm text-slate-400 mt-1">
                Make sure the Node.js TypeScript server is running on port 5000:
              </p>
            </div>
            <div className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-indigo-400 font-mono text-xs text-center select-all">
              npm run dev
            </div>
            <button
              onClick={checkBackendHealth}
              className="mt-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Retry Connection
            </button>
          </div>
        ) : backendStatus === 'connected' ? (
          <TestGenerator />
        ) : (
          <div className="flex flex-col items-center justify-center my-32 gap-4">
            <div className="relative flex items-center justify-center">
              <div className="h-12 w-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
              <Zap className="h-5 w-5 text-indigo-400 absolute" />
            </div>
            <p className="text-xs font-medium text-slate-400">Connecting to AI execution engine...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 px-4 sm:px-8 lg:px-12 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>Iterative Code Coverage & Test Generation Engine</span>
        </div>
        <div>Engineered with Node.js TypeScript, Express & React</div>
      </footer>
    </div>
  );
};

// Wrap with Toaster provider
const AppWithToaster: React.FC = () => (
  <>
    <Toaster
      richColors
      position="top-right"
      theme="dark"
      toastOptions={{
        style: {
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(51, 65, 85, 0.6)',
          backdropFilter: 'blur(12px)',
          fontSize: '13px'
        }
      }}
    />
    <App />
  </>
);

export default AppWithToaster;
