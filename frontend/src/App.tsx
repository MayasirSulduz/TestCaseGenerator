import React, { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sliders,
  Zap
} from 'lucide-react';
import TestGenerator from './components/TestGenerator';
import { checkHealth, subscribeConnectionStatus } from './services/api';
import { HealthCheckResult } from './types';

const App: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('connected');
  const [healthInfo, setHealthInfo] = useState<HealthCheckResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  useEffect(() => {
    checkBackendHealth();
    const unsubscribe = subscribeConnectionStatus((connected, health) => {
      if (connected) {
        setBackendStatus('connected');
        if (health) setHealthInfo(health);
      }
    });
    return () => unsubscribe();
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
      <header className="sticky top-0 z-50 w-full bg-[#0b0f19]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-2xl">
        {/* Brand & Menu Toggle */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
              sidebarOpen
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
            title="Toggle setup controls sidebar (=)"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[15px] flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
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
        {backendStatus === 'error' && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center justify-between shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Backend server is connecting or offline. If running locally, start server with <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[11px]">npm run dev</code> in <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[11px]">backend</code> directory.
              </span>
            </div>
            <button
              onClick={checkBackendHealth}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-xl font-semibold flex items-center gap-1.5 text-[11px] transition-all shrink-0 ml-3"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        <TestGenerator sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
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
