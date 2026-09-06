import React from 'react';
import { AblationAnalysisResult, AblationLayerMetrics } from './engine';
import { Layers, HelpCircle, ArrowRight, Zap, ShieldAlert, Scale } from 'lucide-react';

export const AblationComparisonPanel: React.FC<{ ablation: AblationAnalysisResult }> = ({ ablation }) => {
  const { baseline, plusBehavior, plusInstitutions, full, behavioralContributionPct, institutionalContributionPct, interactionEffectPct, isNonlinear, explanation } = ablation;

  return (
    <div className="space-y-6 rounded-xl border border-indigo-900/40 bg-indigo-950/10 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-900/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-900/40 rounded-lg border border-indigo-500/30">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">Multi-Layer Ablation Analysis</h3>
            <p className="text-xs text-indigo-300/80">Disentangling Physical, Behavioral & Institutional Frictions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${isNonlinear ? 'bg-amber-950/50 border-amber-500/50 text-amber-300' : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'}`}>
            {isNonlinear ? 'NON-LINEAR COUPLING DETECTED' : 'ADDITIVE LAYERS'}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3.5 rounded-lg border border-slate-800">
        <span className="font-mono text-indigo-400 font-bold uppercase tracking-wide">Causal Insights: </span>
        {explanation}
      </p>

      {/* Primary Causal Attribution Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">Full Model Causal Attribution</span>
          <span className="text-cyan-400 text-[10px]">Certainty: {full.causalAttribution.certaintyLevel}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
          <AttrBar pct={full.causalAttribution.physicalScarcityPct} color="bg-cyan-500" title="Physical Scarcity" />
          <AttrBar pct={full.causalAttribution.financialConstraintPct} color="bg-amber-500" title="Financial Constraint" />
          <AttrBar pct={full.causalAttribution.behavioralFrictionPct} color="bg-rose-500" title="Behavioral Panic" />
          <AttrBar pct={full.causalAttribution.institutionalFrictionPct} color="bg-indigo-500" title="Institutional Friction" />
          <AttrBar pct={full.causalAttribution.informationFrictionPct} color="bg-purple-500" title="Information Asymmetry" />
          <AttrBar pct={full.causalAttribution.coordinationFailurePct} color="bg-slate-600" title="Coordination Failure" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[10px] font-mono pt-1">
          <LegendItem label="Physical" pct={full.causalAttribution.physicalScarcityPct} color="bg-cyan-500" />
          <LegendItem label="Financial" pct={full.causalAttribution.financialConstraintPct} color="bg-amber-500" />
          <LegendItem label="Behavioral" pct={full.causalAttribution.behavioralFrictionPct} color="bg-rose-500" />
          <LegendItem label="Institutional" pct={full.causalAttribution.institutionalFrictionPct} color="bg-indigo-500" />
          <LegendItem label="Information" pct={full.causalAttribution.informationFrictionPct} color="bg-purple-500" />
          <LegendItem label="Residual" pct={full.causalAttribution.coordinationFailurePct} color="bg-slate-600" />
        </div>
      </div>

      {/* 4 Layer Cards Matrix */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2">
        <LayerCard layer={baseline} highlight={false} />
        <LayerCard layer={plusBehavior} highlight={false} delta={behavioralContributionPct} deltaLabel="Behavioral Shift" />
        <LayerCard layer={plusInstitutions} highlight={false} delta={institutionalContributionPct} deltaLabel="Institutional Shift" />
        <LayerCard layer={full} highlight={true} delta={interactionEffectPct} deltaLabel="Coupling Effect" />
      </div>

      {/* Contribution Breakdown Ledger */}
      <div className="grid gap-3 sm:grid-cols-3 pt-2 text-xs font-mono">
        <div className="p-3.5 rounded-lg border border-rose-900/40 bg-rose-950/20">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Behavioral Contribution</div>
          <div className="text-xl font-bold text-rose-300 mt-1">
            {behavioralContributionPct >= 0 ? `+${behavioralContributionPct.toFixed(1)}%` : `${behavioralContributionPct.toFixed(1)}%`}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Unmet demand shift from risk aversion, hoarding & trust decay.</p>
        </div>

        <div className="p-3.5 rounded-lg border border-indigo-900/40 bg-indigo-950/20">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Institutional Contribution</div>
          <div className="text-xl font-bold text-indigo-300 mt-1">
            {institutionalContributionPct >= 0 ? `+${institutionalContributionPct.toFixed(1)}%` : `${institutionalContributionPct.toFixed(1)}%`}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Unmet demand shift from compliance checks, latency & capital holds.</p>
        </div>

        <div className="p-3.5 rounded-lg border border-amber-900/40 bg-amber-950/20">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Interaction Effect (Coupling)</div>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {interactionEffectPct >= 0 ? `+${interactionEffectPct.toFixed(1)}%` : `${interactionEffectPct.toFixed(1)}%`}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Non-linear difference between combined effect and sum of isolated layers.</p>
        </div>
      </div>
    </div>
  );
};

const LayerCard: React.FC<{ layer: AblationLayerMetrics; highlight?: boolean; delta?: number; deltaLabel?: string }> = ({ layer, highlight, delta, deltaLabel }) => (
  <div className={`rounded-lg border p-3.5 ${highlight ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-slate-800 bg-slate-950/60'}`}>
    <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2 flex justify-between items-center">
      <span>{layer.name}</span>
      {delta !== undefined && (
        <span className={`text-[10px] ${delta > 0 ? 'text-rose-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
          {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
        </span>
      )}
    </h4>
    <div className="mt-3 space-y-2 text-xs">
      <MetricRow label="Unmet Demand" val={`${layer.unmetDemand.toFixed(1)}%`} highlight={layer.unmetDemand > 20} />
      <MetricRow label="Net Attainable Utility" val={`${layer.totalNetworkUtility.toFixed(1)}%`} />
      <MetricRow label="Physical Shortage" val={`${layer.physicalShortage.toFixed(1)}%`} />
      <MetricRow label="Financial Exclusion" val={`${layer.financialExclusion.toFixed(1)}%`} />
      <MetricRow label="Behavioral Friction" val={`${layer.behavioralFriction.toFixed(1)}%`} />
      <MetricRow label="Institutional Friction" val={`${layer.institutionalFriction.toFixed(1)}%`} />
      <MetricRow label="Trust-Weighted Cap" val={`${layer.trustWeightedCapacity.toFixed(1)}`} />
      <MetricRow label="Cascading Risk" val={`${(layer.cascadingFailureProbability * 100).toFixed(1)}%`} />
    </div>
  </div>
);

const MetricRow = ({ label, val, highlight }: { label: string; val: string; highlight?: boolean }) => (
  <div className="flex justify-between items-center text-[10px] font-mono">
    <span className="text-slate-500">{label}</span>
    <span className={highlight ? 'text-rose-400 font-bold' : 'text-slate-200'}>{val}</span>
  </div>
);

const AttrBar = ({ pct, color, title }: { pct: number; color: string; title: string }) => {
  if (pct <= 0) return null;
  return <div style={{ width: `${pct}%` }} className={`h-full ${color}`} title={`${title}: ${pct.toFixed(1)}%`} />;
};

const LegendItem = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
  <div className="flex items-center gap-1.5 text-slate-400">
    <div className={`w-2 h-2 rounded-full ${color}`} />
    <span>{label}: {pct.toFixed(0)}%</span>
  </div>
);
