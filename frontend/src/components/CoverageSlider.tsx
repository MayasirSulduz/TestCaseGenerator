import React from 'react';
import { Gauge, Sparkles, Target } from 'lucide-react';
import { CoverageSliderProps } from '../types';

const CoverageSlider: React.FC<CoverageSliderProps> = ({ value, onChange }) => {
  const getCoverageColorClass = (coverage: number): string => {
    if (coverage >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (coverage >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  const getCoverageLabel = (coverage: number): string => {
    if (coverage >= 80) return 'Excellent Coverage';
    if (coverage >= 60) return 'Good Coverage';
    if (coverage >= 40) return 'Fair Coverage';
    return 'Basic Coverage';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-400" />
          <span>Target Coverage Score</span>
        </label>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${getCoverageColorClass(value)}`}>
          {value}% Target
        </span>
      </div>

      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">{getCoverageLabel(value)}</span>
        </div>
        <span className="text-lg font-black tracking-tight text-white font-mono">{value}%</span>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300/90 flex items-start gap-2 leading-relaxed">
        <Sparkles className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
        <span>Aim for 80-90% coverage for production-grade reliability.</span>
      </div>
    </div>
  );
};

export default CoverageSlider;
