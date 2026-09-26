import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Clock } from 'lucide-react';

interface CoverageGaugeProps {
  coverage: number;
  targetCoverage: number;
  testPassed?: boolean;
  executionTimeSec?: string;
  linesCoveredText?: string;
  isLoading?: boolean;
}

export const CoverageGauge: React.FC<CoverageGaugeProps> = ({
  coverage,
  targetCoverage,
  testPassed = false,
  executionTimeSec,
  linesCoveredText,
  isLoading = false
}) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (coverage / 100) * circumference;

  const isAchieved = coverage >= targetCoverage && testPassed;

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between h-full min-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Interactive Coverage Gauge
          </h3>
        </div>

        {executionTimeSec && (
          <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 flex items-center gap-1">
            <Clock className="h-3 w-3 text-sky-400" />
            ⏱️ {executionTimeSec}s
          </span>
        )}
      </div>

      {/* Gauge Body */}
      <div className="flex flex-col items-center justify-center my-3 relative">
        <svg className="w-44 h-44 transform -rotate-90">
          {/* Track Circle */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="12"
            fill="transparent"
          />
          {/* Progress Circle */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            stroke={isAchieved ? '#10b981' : coverage > 0 ? '#3b82f6' : '#64748b'}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Inner Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-slate-400">
            Target Achieved:
          </span>
          <span className="text-3xl font-black font-mono tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            {coverage}%
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
            Goal: {targetCoverage}%
          </span>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
        <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-center">
          <span className="text-[10px] font-medium text-slate-400">Lines Covered:</span>
          <span className="text-xs font-bold text-slate-200 font-mono mt-0.5">
            {linesCoveredText || `${coverage}% of statements`}
          </span>
        </div>

        <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-center">
          <span className="text-[10px] font-medium text-slate-400">Status:</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isLoading ? (
              <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Executing
              </span>
            ) : isAchieved ? (
              <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Passing
              </span>
            ) : coverage > 0 ? (
              <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Refining
              </span>
            ) : (
              <span className="text-slate-400 font-bold text-xs">Idle</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverageGauge;
