import React, { useState } from 'react';
import { AlertTriangle, HelpCircle, Info, Scale, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { compareModels, ModelComparisonResult } from '@/lib/physics';

interface ComparisonPanelProps {
  experimentMode: string;
  parameters: {
    g: number;
    phiA: number;
    phiB: number;
    delta: number;
    alpha: number;
    gamma: number;
    omega_w: number;
    purity?: number;
    decoherence?: number;
  };
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ experimentMode, parameters }) => {
  const [showFalsification, setShowFalsification] = useState(false);

  const comparison: ModelComparisonResult = compareModels(experimentMode, parameters);
  const deltaSign = comparison.delta >= 0 ? '+' : '';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-cyan-400" />
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-slate-100">
            Model Comparison: Standard QM vs. Woodyard Field Model
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 font-mono text-xs text-blue-300">
            ESTABLISHED BASELINE
          </Badge>
          <Badge
            variant="outline"
            className={
              comparison.scientificStatus === 'Speculative'
                ? 'border-purple-500/40 bg-purple-500/10 font-mono text-xs text-purple-300'
                : 'border-amber-500/40 bg-amber-500/10 font-mono text-xs text-amber-300'
            }
          >
            {comparison.scientificStatus.toUpperCase()} EXTENSION
          </Badge>
        </div>
      </div>

      {/* Side-by-side Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Standard QM Card */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4 transition-all hover:border-blue-500/50">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-400">
              STANDARD QM PREDICTION
            </span>
            <Badge className="bg-blue-600/30 text-[10px] text-blue-200">ESTABLISHED</Badge>
          </div>
          <div className="my-2 font-mono text-3xl font-extrabold text-blue-100">
            {comparison.standardQM.toFixed(4)}
          </div>
          <div className="font-mono text-xs text-slate-400">{comparison.observableName}</div>
          <div className="mt-3 text-[11px] text-slate-400">
            Standard Born-rule calculation assuming un-modulated space.
          </div>
        </div>

        {/* Woodyard Model Card */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 transition-all hover:border-amber-500/50">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
              WOODYARD MODEL
            </span>
            <Badge className="bg-amber-600/30 text-[10px] text-amber-200">
              {comparison.scientificStatus.toUpperCase()}
            </Badge>
          </div>
          <div className="my-2 font-mono text-3xl font-extrabold text-amber-100">
            {comparison.woodyardModel.toFixed(4)}
          </div>
          <div className="font-mono text-xs text-slate-400">{comparison.observableName}</div>
          <div className="mt-3 text-[11px] text-amber-300/80">
            Field-modulated modification via coupling g = {parameters.g} & α = {parameters.alpha}.
          </div>
        </div>

        {/* Measurable Difference Delta Card */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 transition-all hover:border-emerald-500/50">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              MEASURABLE DEVIATION Δ
            </span>
            <Badge className="bg-emerald-600/30 text-[10px] text-emerald-200">DELTA</Badge>
          </div>
          <div className="my-2 font-mono text-3xl font-extrabold text-emerald-300">
            {deltaSign}
            {comparison.delta.toFixed(4)}
          </div>
          <div className="font-mono text-xs text-slate-400">
            Deviation: <span className="text-emerald-400 font-bold">{deltaSign}{comparison.percentDeviation.toFixed(2)}%</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            {Math.abs(comparison.delta) > 0.05
              ? 'Potentially measurable in precision interferometry.'
              : 'Small deviation; requires high-sensitivity sensor.'}
          </div>
        </div>
      </div>

      {/* Theoretical Assumptions & Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 text-cyan-400" />
          <span>
            Assumptions:{' '}
            <strong className="text-slate-300">{comparison.assumptions.join('; ')}</strong>
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFalsification(!showFalsification)}
          className={`font-mono text-xs transition-colors ${
            showFalsification
              ? 'border-red-500 bg-red-500/20 text-red-200'
              : 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
          }`}
        >
          <ShieldAlert className="mr-1.5 h-4 w-4 text-red-400" />
          {showFalsification ? 'HIDE FALSIFICATION CRITERIA' : 'WHAT WOULD FALSIFY THIS?'}
        </Button>
      </div>

      {/* Prominent Falsification Panel */}
      {showFalsification && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-red-200 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-red-300">
              FALSIFICATION CONDITION (SCIENTIFIC METHOD REQUIREMENT)
            </h4>
          </div>
          <p className="font-mono text-xs leading-relaxed text-red-100">
            {comparison.falsificationCondition}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-red-300/80">
            <CheckCircle2 className="h-3.5 w-3.5 text-red-400" />
            <span>
              If experimental observations match the Standard QM prediction within 5σ confidence, the field-modulated hypothesis is falsified for these parameters.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
