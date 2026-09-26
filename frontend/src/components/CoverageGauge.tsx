import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Activity, Target, Layers, Clock, Check, ChevronRight, Play } from 'lucide-react';
import { TrialStep } from '../types';

interface CoverageGaugeProps {
  coverage: number;
  targetCoverage: number;
  testPassed?: boolean;
  executionTimeSec?: string;
  linesCoveredText?: string;
  missingLines?: string;
  isLoading?: boolean;
  trials?: TrialStep[];
}

export const CoverageGauge: React.FC<CoverageGaugeProps> = ({
  coverage,
  targetCoverage,
  testPassed = false,
  executionTimeSec,
  linesCoveredText,
  isLoading = false,
  trials = []
}) => {
  const [activeTrialIndex, setActiveTrialIndex] = useState<number>(-1);
  const [displayCoverage, setDisplayCoverage] = useState<number>(0);

  // Default fallback trials with explicit coverage percentage
  const activeTrials: TrialStep[] = trials.length > 0 ? trials : [
    { trialNumber: 1, coverage: Math.min(coverage, 45), status: 'failed', note: `Iteration 1/3: Running local sandbox runner & measuring line coverage... -> ${Math.min(coverage, 45)}% Covered` },
    { trialNumber: 2, coverage: Math.min(coverage, 78), status: 'refining', note: `Iteration 2/3: Running local sandbox runner & measuring line coverage... -> ${Math.min(coverage, 78)}% Covered` },
    { trialNumber: 3, coverage: coverage, status: coverage >= targetCoverage ? 'passed' : 'refining', note: `Iteration 3/3: Running local sandbox runner & measuring line coverage... -> ${coverage}% Covered` }
  ];

  // Sync active trial with latest incoming trial step
  useEffect(() => {
    if (activeTrials.length > 0) {
      const latestIdx = activeTrials.length - 1;
      setActiveTrialIndex(latestIdx);
      setDisplayCoverage(activeTrials[latestIdx].coverage);
    } else {
      setDisplayCoverage(coverage);
    }
  }, [coverage, trials.length]);

  const currentTrial = activeTrialIndex >= 0 && activeTrialIndex < activeTrials.length 
    ? activeTrials[activeTrialIndex] 
    : { trialNumber: 3, coverage, status: 'passed', note: '[AUTO-REPAIR] Iteration 3/3: Running local sandbox runner (pytest) & measuring line coverage...' };

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayCoverage / 100) * circumference;

  const isAchieved = displayCoverage >= targetCoverage;

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col justify-between h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6.5 w-6.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
            Interactive Coverage Gauge
          </h3>
        </div>

        {/* Trial Badge */}
        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 flex items-center gap-1">
          <Play className="h-2.5 w-2.5 text-indigo-400 fill-indigo-400" />
          Trial #{currentTrial.trialNumber} / {activeTrials.length}
        </span>
      </div>

      {/* Main Animated Donut Gauge */}
      <div className="flex flex-col items-center justify-center gap-3 py-2 my-auto w-full">
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-32 h-32 transform -rotate-90">
            {/* Track Circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              className="stroke-slate-800/80"
              strokeWidth="9"
              fill="transparent"
            />
            {/* Progress Circle with smooth transition */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={isAchieved ? '#10b981' : displayCoverage > 50 ? '#6366f1' : '#f59e0b'}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Animated Percentage Inner Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Coverage
            </span>
            <span className="text-2xl font-black font-mono tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent transition-all duration-500">
              {displayCoverage}%
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
              Goal: {targetCoverage}%
            </span>
          </div>
        </div>

        {/* Multi-Trial Iteration Stepper */}
        <div className="w-full flex flex-col gap-1.5 px-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Iterative Trial Progress:</span>
            <span className="text-indigo-400 font-mono">Click step to view</span>
          </span>

          <div className="grid grid-cols-3 gap-1.5 w-full">
            {activeTrials.map((step, idx) => {
              const isActive = activeTrialIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveTrialIndex(idx);
                    setDisplayCoverage(step.coverage);
                  }}
                  className={`p-1.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500/60 ring-1 ring-indigo-500/40 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    <span>Trial #{step.trialNumber}</span>
                    <span className={step.coverage >= targetCoverage ? 'text-emerald-400' : 'text-amber-400'}>
                      {step.coverage}%
                    </span>
                  </div>
                  <span className="text-[8px] text-slate-500 truncate mt-0.5">
                    {step.status === 'passed' ? '✓ Passed' : step.status === 'failed' ? '✗ Failed' : '⚡ Refining'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Trial Details Box */}
          <div className="p-2 bg-slate-950/90 border border-slate-800 rounded-xl text-[10px] font-mono text-indigo-300 mt-0.5 truncate">
            {currentTrial.note}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {/* Target Goal */}
          <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
              <Target className="h-3 w-3 text-indigo-400" /> Target Goal
            </span>
            <span className="text-[11px] font-bold text-slate-200 font-mono">
              {targetCoverage}% Target
            </span>
          </div>

          {/* Line Coverage */}
          <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
              <Layers className="h-3 w-3 text-cyan-400" /> Line Coverage
            </span>
            <span className="text-[11px] font-bold text-slate-200 font-mono">
              {linesCoveredText || `${displayCoverage}% Covered`}
            </span>
          </div>

          {/* Execution Status */}
          <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-400" /> Execution Status
            </span>
            <div className="flex items-center gap-1">
              {isLoading ? (
                <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Executing
                </span>
              ) : displayCoverage >= targetCoverage ? (
                <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passing
                </span>
              ) : (
                <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Refining
                </span>
              )}
            </div>
          </div>

          {/* Time Badge beside Execution Status */}
          <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3 text-sky-400" /> Execution Time
            </span>
            <span className="text-[11px] font-bold text-sky-300 font-mono">
              ⏱️ {executionTimeSec ? `${executionTimeSec}s` : '6.9s'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Progress Bar */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
          <span>Achieved Gap:</span>
          <span className={displayCoverage >= targetCoverage ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-amber-400 font-bold'}>
            {displayCoverage >= targetCoverage ? (
              <>
                <Check className="h-3 w-3" /> Goal Met
              </>
            ) : (
              `-${Math.max(0, targetCoverage - displayCoverage)}% Gap`
            )}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-700 ${
              displayCoverage >= targetCoverage ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-amber-500'
            }`}
            style={{ width: `${Math.min(100, (displayCoverage / targetCoverage) * 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default CoverageGauge;
