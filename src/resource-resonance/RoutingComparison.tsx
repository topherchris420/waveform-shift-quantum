import React from 'react';
import { SimulationResult } from './engine';
import { Metric } from '@/components/QuantumLab'; // Need to define Metric locally or import if available, I'll define a local inline one to be safe

interface RoutingComparisonProps {
  result: SimulationResult;
}

export const RoutingComparison: React.FC<RoutingComparisonProps> = ({ result }) => {
  const deltaUtility = result.modelB.totalNetworkUtility - result.modelA.totalNetworkUtility;
  const isResonanceBetter = deltaUtility > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 divide-y divide-slate-800 border-y border-slate-800 md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Model A */}
        <div className="p-6">
          <h3 className="mb-4 font-mono text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">
            Model A — Monetary Routing
          </h3>
          <div className="space-y-4">
            <ComparisonRow label="Network Utility" value={`${result.modelA.totalNetworkUtility.toFixed(1)}%`} />
            <ComparisonRow label="Wasted Energy" value={`${result.modelA.wastedEnergy.toFixed(1)}%`} />
            <ComparisonRow label="Routing Latency" value={`${result.modelA.routingLatency.toFixed(0)} ms`} />
            <ComparisonRow label="Unmet Demand" value={`${result.modelA.unmetDemand.toFixed(1)}%`} />
          </div>
        </div>

        {/* Model B */}
        <div className="p-6 bg-slate-900/30">
          <h3 className="mb-4 font-mono text-[11px] font-bold tracking-[0.2em] text-cyan-400 uppercase">
            Model B — Resource Resonance
          </h3>
          <div className="space-y-4">
            <ComparisonRow label="Network Utility" value={`${result.modelB.totalNetworkUtility.toFixed(1)}%`} highlight={result.modelB.totalNetworkUtility > result.modelA.totalNetworkUtility} />
            <ComparisonRow label="Wasted Energy" value={`${result.modelB.wastedEnergy.toFixed(1)}%`} highlight={result.modelB.wastedEnergy < result.modelA.wastedEnergy} />
            <ComparisonRow label="Routing Latency" value={`${result.modelB.routingLatency.toFixed(0)} ms`} highlight={result.modelB.routingLatency < result.modelA.routingLatency} />
            <ComparisonRow label="Unmet Demand" value={`${result.modelB.unmetDemand.toFixed(1)}%`} highlight={result.modelB.unmetDemand < result.modelA.unmetDemand} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">Measurable Divergence</p>
        <div className="flex items-center gap-4">
          <div className={`text-2xl font-bold ${isResonanceBetter ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isResonanceBetter ? '+' : ''}{deltaUtility.toFixed(2)}%
          </div>
          <p className="text-sm text-slate-300 flex-1 leading-relaxed border-l border-slate-800 pl-4">
            <span className="text-white font-medium">Primary driver:</span> {result.primaryDriver}
          </p>
        </div>
      </div>
    </div>
  );
};

const ComparisonRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-slate-400">{label}</span>
    <span className={`font-mono text-sm ${highlight ? 'text-cyan-300 font-bold' : 'text-slate-200'}`}>
      {value}
    </span>
  </div>
);
