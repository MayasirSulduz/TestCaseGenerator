import React from 'react';
import { Cpu, Info, Layers } from 'lucide-react';
import { FrameworkSelectorProps } from '../types';

const getFrameworkDescription = (framework: string): string => {
  const descriptions: Record<string, string> = {
    Jest: 'Popular JavaScript testing framework with built-in mocking & coverage',
    Mocha: 'Flexible JavaScript test runner with rich ecosystem',
    Jasmine: 'Behavior-driven JavaScript testing framework',
    pytest: 'Powerful Python testing framework with simple fixture syntax',
    unittest: 'Built-in Python unit testing module',
    JUnit5: 'Modern testing framework for Java 8+ applications',
    JUnit4: 'Legacy JUnit framework for Java applications'
  };

  return descriptions[framework] || '';
};

const FrameworkSelector: React.FC<FrameworkSelectorProps> = ({
  language,
  framework,
  availableFrameworks,
  onFrameworkChange
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-indigo-400" />
          <span>Framework & Language</span>
        </label>
        <span className="text-[11px] font-semibold text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-cyan-400" />
          {language || 'JavaScript'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <select
          id="framework-select"
          value={framework}
          onChange={(e) => onFrameworkChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer"
        >
          {availableFrameworks.map((fw) => (
            <option key={fw} value={fw} className="bg-slate-900 text-slate-100 font-semibold">
              {fw}
            </option>
          ))}
        </select>
      </div>

      {getFrameworkDescription(framework) && (
        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
          <Info className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
          <span>{getFrameworkDescription(framework)}</span>
        </div>
      )}
    </div>
  );
};

export default FrameworkSelector;
