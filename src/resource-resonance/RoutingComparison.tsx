import React from 'react';
import { Architecture, SimulationResult, runAblationAnalysis } from './engine';
import { Activity, Landmark, Network, ShieldCheck, Layers } from 'lucide-react';
import { AblationComparisonPanel } from './AblationComparison';

const META: Record<Architecture, { label: string; color: string }> = {
  market: { label: 'Heuristic price-matching baseline', color: 'text-amber-300' },
  doubleAuction: { label: 'Double auction', color: 'text-orange-300' },
  shadowPriceMarket: { label: 'Shadow-price market', color: 'text-yellow-300' },
  stabilizedMarket: { label: 'Stabilized Market', color: 'text-emerald-300' },
  hybrid: { label: 'Computational Market / Hybrid', color: 'text-indigo-300' },
  maxWeightMatching: { label: 'Maximum-weight matching', color: 'text-violet-300' },
  genesis: { label: 'Genesis', color: 'text-cyan-300' },
};

export const RoutingComparison: React.FC<{ result: SimulationResult }> = ({ result }) => {
  // Compute ablation analysis for the current simulation sample
  const ablation = runAblationAnalysis({
    resourceScarcity: result.modelA.unmetDemandDecomposition.physicalShortage / 100,
    liquidityStress: result.modelA.feasibleButUnservedDemand / 100
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">Interpretation limit</p>
        <p className="mt-2">Results are conditional simulation comparisons, not claims that computation, money, or markets are universally superior. Hidden true state scores welfare; mechanisms act only on their reported price or telemetry observations.</p>
        <p className="mt-2 font-mono text-[10px] text-slate-500">seed {result.seed} · experiment {result.experimentHash}</p>
      </section>

      {/* Architecture Cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(META) as Architecture[]).map((id) => {
          const m = result.architectures[id];
          return (
            <article key={id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <h3 className={`font-mono text-[10px] font-bold uppercase tracking-widest ${META[id].color}`}>{META[id].label}</h3>
              <p className="mt-3 text-2xl font-semibold text-white">{m.totalNetworkUtility.toFixed(1)}%</p>
              <p className="font-mono text-[9px] uppercase text-slate-600">net attainable welfare</p>
              <dl className="mt-4 space-y-2 text-xs">
                <Row k="Demand fulfilled" v={`${m.fulfilledNeeds.toFixed(1)}%`} />
                <Row k="FUD" v={`${m.feasibleButUnservedDemand.toFixed(1)}%`} />
                <Row k="Settlement failures" v={`${(m.settlementFailureRate * 100).toFixed(1)}%`} />
                <Row k="Backstop use" v={`${(m.backstopUtilization * 100).toFixed(1)}%`} />
                <Row k="Stranded utility" v={`${m.strandedPhysicalUtility.toFixed(1)}%`} />
                <Row k="Oracle efficiency" v={`${(m.efficiencyRatio * 100).toFixed(1)}%`} />
                <Row k="Clearing / shadow price" v={`${m.clearingPrice.toFixed(2)} / ${m.shadowPrice.toFixed(2)}`} />
                <Row k="False-critical rate" v={`${m.falseCriticalAllocationRate.toFixed(1)}%`} />
              </dl>
              <ul className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-[10px] leading-relaxed text-slate-500">
                {result.reasons[id].map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </article>
          );
        })}
      </div>

      {/* Multi-Layer Ablation Comparison Section */}
      <section>
        <AblationComparisonPanel ablation={ablation} />
      </section>

      <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/10 p-5">
        <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-indigo-300"/><h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-indigo-200">Matched information × mechanism decomposition</h3></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Row k="Information advantage" v={`${result.informationDecomposition.informationAdvantage.toFixed(2)} pp`} />
          <Row k="Mechanism advantage" v={`${result.informationDecomposition.mechanismAdvantage.toFixed(2)} pp`} />
          <Row k="Interaction" v={`${result.informationDecomposition.interactionEffect.toFixed(2)} pp`} />
        </div>
      </section>

      {/* Verdict & Decomposition */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-5 w-5 text-cyan-400"/>
          <div>
            <p className="font-mono text-xs font-bold tracking-widest text-white">{result.architectureVerdict}</p>
            <p className="mt-1 text-sm text-slate-400">{result.verdictSummary}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Object.entries(result.modelA.unmetDemandDecomposition).map(([key, value]) => (
            <div key={key} className="border-l-2 border-slate-700 pl-3">
              <p className="text-lg text-slate-100">{value.toFixed(1)}%</p>
              <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-slate-500">
          The expanded unmet-demand decomposition distinguishes physical scarcity, financial constraints, behavioral panic, institutional friction, information asymmetry, and residual coordination failure.
        </p>
      </section>

      {/* Thermodynamic Safety Valve & Systemic-Risk Ledger */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-5">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-cyan-400"/>
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-cyan-300">
              Thermodynamic Safety Valve: {result.safetyValve.state}
            </h3>
          </div>
          <p className="mt-2 text-xs text-slate-400">{result.safetyValve.explanation}</p>
          <ul className="mt-4 space-y-2">
            {result.safetyValve.conditions.map(c => (
              <li key={c.id} className="flex justify-between gap-3 text-[11px]">
                <span className="text-slate-400">{c.label}</span>
                <span className={c.passed ? 'text-emerald-400' : 'text-rose-400'}>
                  {c.passed ? 'PASS' : 'NOT MET'}
                  {typeof c.value === 'number' ? ` · ${(c.value * 100).toFixed(1)}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400"/>
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-200">Systemic-risk ledger</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {result.riskChecks.map(c => (
              <div key={c.id} className="border border-slate-800 p-2 text-[10px]">
                <p className="text-slate-300">{c.label}</p>
                <p className={c.passed ? 'text-emerald-400' : 'text-rose-400'}>
                  {c.passed ? 'within tolerance' : 'gate failed'} · {c.routed.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-amber-900/30 bg-amber-950/10 p-3 text-[11px] leading-relaxed text-slate-400">
        <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"/>
        Simulation assumption: monetary architectures transact through balances, credit, collateral, counterparties, and settlement rails. Multi-layer behavioral and institutional dynamics introduce endogenously emerging panics, compliance holds, and policy lags.
      </p>
    </div>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-slate-500">{k}</dt>
    <dd className="font-mono text-slate-200">{v}</dd>
  </div>
);
