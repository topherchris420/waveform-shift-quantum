import React from 'react';
import { SimulationResult } from './engine';
import { ShieldCheck, ShieldAlert, MinusCircle } from 'lucide-react';

interface RoutingComparisonProps {
  result: SimulationResult;
}

export const RoutingComparison: React.FC<RoutingComparisonProps> = ({ result }) => {
  const deltaUtility = result.deltaUtility;
  const isResonanceBetter = deltaUtility > 0;

  const verdictTheme =
    result.verdict === 'improves-safely'
      ? { color: 'text-emerald-400', border: 'border-emerald-500/40', Icon: ShieldCheck, title: 'Improves allocation without new systemic risk' }
      : result.verdict === 'improves-with-risk'
      ? { color: 'text-amber-400', border: 'border-amber-500/40', Icon: ShieldAlert, title: 'Improves allocation, but transfers risk' }
      : { color: 'text-slate-400', border: 'border-slate-700', Icon: MinusCircle, title: 'No demonstrated improvement' };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="grid grid-cols-1 divide-y divide-slate-800 border-y border-slate-800 md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Model A */}
        <div className="p-4 sm:p-6">
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
        <div className="p-4 sm:p-6 bg-slate-900/30">
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

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">
          Measurable Divergence — {result.ensembleSize} shock draws
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div>
            <div className={`text-2xl font-bold ${isResonanceBetter ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isResonanceBetter ? '+' : ''}{deltaUtility.toFixed(2)} pp
            </div>
            <p className="font-mono text-[10px] text-slate-500 mt-1">
              95% CI ±{result.deltaConfidence.toFixed(2)} · wins {(result.winRate * 100).toFixed(0)}% of draws
            </p>
          </div>
          <p className="text-sm text-slate-300 flex-1 leading-relaxed border-slate-800 md:border-l md:pl-4">
            <span className="text-white font-medium">Primary driver:</span> {result.primaryDriver}
          </p>
        </div>
      </div>

      {/* Systemic risk ledger */}
      <div className={`rounded-xl border ${verdictTheme.border} bg-slate-950/50 p-4 sm:p-5`}>
        <div className="flex items-start gap-3 mb-5">
          <verdictTheme.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${verdictTheme.color}`} />
          <div>
            <h3 className={`font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${verdictTheme.color}`}>
              {verdictTheme.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{result.verdictSummary}</p>
          </div>
        </div>

        <div className="grid gap-px bg-slate-800 sm:grid-cols-2">
          {result.riskChecks.map((check) => {
            const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3));
            const delta = check.routed - check.baseline;
            return (
              <div key={check.id} className="bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-200">{check.label}</span>
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                      check.passed
                        ? 'text-emerald-400 border-emerald-500/40'
                        : 'text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {check.passed ? 'within tolerance' : 'risk added'}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2 font-mono text-[11px]">
                  <span className="text-slate-500">A {fmt(check.baseline)}{check.unit}</span>
                  <span className="text-slate-700">→</span>
                  <span className="text-cyan-300">B {fmt(check.routed)}{check.unit}</span>
                  <span className={delta <= check.tolerance ? 'text-emerald-500/80' : 'text-rose-400'}>
                    ({delta >= 0 ? '+' : ''}{fmt(delta)})
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{check.note}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500">
          Both mechanisms allocate the same seeded agent population under the same physical substitution
          matrix and capacity constraints; only the ranking signal and its coordination cost differ.
          A gain is only claimed when it clears its confidence band <em>and</em> every risk check stays
          within tolerance.
        </p>
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
