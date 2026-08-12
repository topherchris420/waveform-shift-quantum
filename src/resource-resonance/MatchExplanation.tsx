import React from 'react';
import { MatchResult } from './engine';
import { Zap, ShieldCheck, Route, Waves, Cpu, AlignLeft } from 'lucide-react';

interface MatchExplanationProps {
  match: MatchResult;
}

export const MatchExplanation: React.FC<MatchExplanationProps> = ({ match }) => {
  const { explanation } = match;

  const metrics = [
    { label: 'Compute Compatibility', value: explanation.compatibility, icon: Cpu },
    { label: 'Energy Availability', value: explanation.energyAvailability, icon: Zap },
    { label: 'Urgency Alignment', value: explanation.urgencyAlignment, icon: AlignLeft },
    { label: 'Network Cost', value: explanation.networkCost, icon: Route },
    { label: 'Reliability', value: explanation.reliability, icon: ShieldCheck },
  ];

  return (
    <div className="rounded-xl border border-cyan-900/50 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between border-b border-cyan-900/30 pb-3">
        <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
          Match Explanation
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Composite Score</span>
          <span className="font-mono text-sm font-bold text-cyan-300">
            {explanation.compositeMatch.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          const percentage = Math.round(m.value * 100);
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-300">{m.label}</span>
              </div>
              <div className="flex flex-1 items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all duration-700"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-slate-400">
                  {m.value.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 border-t border-slate-800 pt-3 text-[10px] leading-relaxed text-slate-500">
        Routing decision based on dynamic multi-dimensional alignment rather than compressed monetary price.
      </div>
    </div>
  );
};
