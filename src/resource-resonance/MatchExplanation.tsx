import React from 'react';
import { MatchResult } from './engine';
import { Zap, ShieldCheck, Route, Waves, Cpu, AlignLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MatchExplanationProps {
  match: MatchResult;
}

export const MatchExplanation: React.FC<MatchExplanationProps> = ({ match }) => {
  const { explanation } = match;

  const metrics = [
    { label: 'Compatibility', value: explanation.compatibility, icon: Cpu, tooltip: 'How well the available resource fits the stated request.' },
    { label: 'Energy availability', value: explanation.energyAvailability, icon: Zap, tooltip: 'Seeded energy availability for the selected hour.' },
    { label: 'Urgency alignment', value: explanation.urgencyAlignment, icon: AlignLeft, tooltip: 'How closely the delivery timing fits the stated deadline.' },
    { label: 'Network cost', value: explanation.networkCost, icon: Route, tooltip: 'Estimated location and transport friction.' },
    { label: 'Reliability', value: explanation.reliability, icon: ShieldCheck, tooltip: 'Observed provider reliability in this synthetic run.' },
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
        <TooltipProvider>
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            const percentage = Math.round(m.value * 100);
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between gap-4 cursor-help">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-300 border-b border-dashed border-slate-700">{m.label}</span>
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
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px] border-cyan-900/50 bg-slate-900 text-xs text-slate-300">
                  <p>{m.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
      
      <div className="mt-4 border-t border-slate-800 pt-3 text-[10px] leading-relaxed text-slate-500">
        Route preview based on the requester’s declared boundary and operating fit. It does not assign universal value or execute a trade.
      </div>
    </div>
  );
};
