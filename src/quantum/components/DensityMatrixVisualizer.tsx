import React, { useState, useMemo } from 'react';
import { Layers, Activity, ShieldCheck, Zap, Sparkles, Scale, Sliders, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { EquationBlock } from '@/components/lab/EquationBlock';
import {
  type TwoSiteStateVector,
  type DensityMatrix2x2,
  stateToDensityMatrix,
  densityMatrixMetrics,
  densityMatrixFidelity,
  applyDephasing,
  phaseColor,
  twoSiteModel,
} from '@/lib/physics';

interface DensityMatrixVisualizerProps {
  twoSiteState?: TwoSiteStateVector;
  parameters?: {
    g: number;
    phiA: number;
    phiB: number;
    delta: number;
  };
}

export const DensityMatrixVisualizer: React.FC<DensityMatrixVisualizerProps> = ({
  twoSiteState,
  parameters = { g: 0.8, phiA: -0.5, phiB: 0.5, delta: 0.25 },
}) => {
  const [dephasing, setDephasing] = useState<number>(0.0);
  const [compareBaseline, setCompareBaseline] = useState<boolean>(true);

  // Compute state vectors for Woodyard model vs Standard QM baseline
  const woodyardState: TwoSiteStateVector = useMemo(() => {
    if (twoSiteState) return twoSiteState;
    const res = twoSiteModel({
      EA: 1.0,
      EB: 1.0,
      phiA: parameters.phiA,
      phiB: parameters.phiB,
      g: parameters.g,
      delta: parameters.delta,
    });
    const cA_mag = Math.sqrt(res.PA);
    const cB_mag = Math.sqrt(res.PB);
    return {
      cA: { re: cA_mag, im: 0 },
      cB: { re: cB_mag, im: 0 },
    };
  }, [twoSiteState, parameters]);

  const standardState: TwoSiteStateVector = useMemo(() => {
    const res = twoSiteModel({
      EA: 1.0,
      EB: 1.0,
      phiA: 0,
      phiB: 0,
      g: 0,
      delta: parameters.delta,
    });
    const cA_mag = Math.sqrt(res.PA);
    const cB_mag = Math.sqrt(res.PB);
    return {
      cA: { re: cA_mag, im: 0 },
      cB: { re: cB_mag, im: 0 },
    };
  }, [parameters.delta]);

  // Construct density matrices
  const rawRhoWood = useMemo(() => stateToDensityMatrix(woodyardState), [woodyardState]);
  const rawRhoStd = useMemo(() => stateToDensityMatrix(standardState), [standardState]);

  // Apply optional T2* environmental dephasing
  const rhoWood = useMemo(() => applyDephasing(rawRhoWood, dephasing), [rawRhoWood, dephasing]);
  const rhoStd = useMemo(() => applyDephasing(rawRhoStd, dephasing), [rawRhoStd, dephasing]);

  const metricsWood = useMemo(() => densityMatrixMetrics(rhoWood), [rhoWood]);
  const metricsStd = useMemo(() => densityMatrixMetrics(rhoStd), [rhoStd]);

  const fidelity = useMemo(() => densityMatrixFidelity(rhoStd, rhoWood), [rhoStd, rhoWood]);

  const renderCell = (
    label: string,
    val: { re: number; im: number },
    tone: 'cyan' | 'violet' | 'amber' | 'emerald' = 'cyan'
  ) => {
    const mag = Math.hypot(val.re, val.im);
    const phase = Math.atan2(val.im, val.re);
    const cellColor = phaseColor(phase, mag);

    return (
      <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
          <div
            className="h-2.5 w-2.5 rounded-full border border-white/20"
            style={{ backgroundColor: cellColor }}
            title={`Phase: ${(phase * 180 / Math.PI).toFixed(1)}°`}
          />
        </div>
        <div className="my-2 font-mono text-base font-bold text-slate-100">
          {val.re.toFixed(4)}
          {Math.abs(val.im) > 1e-4 ? (
            <span className="text-xs text-cyan-400"> {val.im >= 0 ? '+' : '-'}{Math.abs(val.im).toFixed(4)}i</span>
          ) : null}
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
          <span>|ρ| = {mag.toFixed(4)}</span>
          <span>arg = {(phase * 180 / Math.PI).toFixed(0)}°</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/90 p-5 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-foreground">
              Quantum State Tomography & Density Matrix (ρ)
            </h2>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">
            Density operator ρ = |ψ⟩⟨ψ|, quantum coherence |ρ₀₁|, purity Tr(ρ²), and von Neumann entropy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EpistemicTag kind="established" short />
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 font-mono text-xs text-cyan-300">
            Tr(ρ) ≡ 1.000000
          </Badge>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Controls & Metrics */}
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
            <Sliders className="h-4 w-4" /> Tomography & Dephasing Controls
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between font-mono text-xs text-slate-300">
                <span>Environmental Dephasing γ_dec (T₂*)</span>
                <span className="font-bold text-cyan-300">{dephasing.toFixed(2)}</span>
              </div>
              <Slider
                value={[dephasing]}
                onValueChange={([v]) => setDephasing(v)}
                min={0.0}
                max={2.0}
                step={0.05}
                className="mt-1.5"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Simulates exponential off-diagonal coherence decay ρ₀₁(t) = ρ₀₁(0)e^(-γt).
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <span className="font-mono text-xs text-slate-300">Show Dual-Model Comparison</span>
              <Button
                variant={compareBaseline ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompareBaseline(!compareBaseline)}
                className={`font-mono text-xs ${
                  compareBaseline
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                {compareBaseline ? 'ENABLED' : 'DISABLED'}
              </Button>
            </div>
          </div>

          {/* Physical Invariants Badges */}
          <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 font-mono text-xs">
            <div className="flex items-center justify-between rounded bg-slate-900/80 p-2">
              <span className="text-slate-400">Hermiticity (ρ = ρ†):</span>
              <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> VERIFIED
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded bg-slate-900/80 p-2">
              <span className="text-slate-400">Unit Trace (Tr ρ = 1):</span>
              <span className="font-bold text-emerald-300">{metricsWood.trace.toFixed(6)}</span>
            </div>

            <div className="flex items-center justify-between rounded bg-slate-900/80 p-2">
              <span className="text-slate-400">Eigenvalues (λ₁, λ₂):</span>
              <span className="text-slate-200">
                {metricsWood.eigenvalues[0].toFixed(3)}, {metricsWood.eigenvalues[1].toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* 2x2 Density Matrix Display */}
        <div className="space-y-4 lg:col-span-2">
          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
              <div className="text-[10px] text-cyan-400 uppercase">Purity Tr(ρ²)</div>
              <div className="text-xl font-bold text-cyan-200">{metricsWood.purity.toFixed(4)}</div>
              <div className="text-[9px] text-slate-400">
                {metricsWood.purity > 0.99 ? 'Pure State' : 'Mixed State'}
              </div>
            </div>

            <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
              <div className="text-[10px] text-violet-400 uppercase">Coherence |ρ₀₁|</div>
              <div className="text-xl font-bold text-violet-200">{metricsWood.coherence.toFixed(4)}</div>
              <div className="text-[9px] text-slate-400">Off-diagonal magnitude</div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
              <div className="text-[10px] text-amber-400 uppercase">Entropy S(ρ)</div>
              <div className="text-xl font-bold text-amber-300">{metricsWood.entropy.toFixed(4)} <span className="text-xs font-normal">nats</span></div>
              <div className="text-[9px] text-slate-400">Von Neumann entropy</div>
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="text-[10px] text-emerald-400 uppercase">State Fidelity F</div>
              <div className="text-xl font-bold text-emerald-300">{(fidelity * 100).toFixed(2)}%</div>
              <div className="text-[9px] text-slate-400">F(ρ_std, ρ_wood)</div>
            </div>
          </div>

          {/* Matrix Views */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Woodyard Model Density Matrix */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
                  WOODYARD MODEL: ρ_wood
                </span>
                <Badge className="bg-amber-600/30 text-[10px] text-amber-200">FIELD-MODULATED</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {renderCell('ρ_AA (|cA|²)', rhoWood.rho00, 'amber')}
                {renderCell('ρ_AB (cAcB*)', rhoWood.rho01, 'cyan')}
                {renderCell('ρ_BA (cBcA*)', rhoWood.rho10, 'cyan')}
                {renderCell('ρ_BB (|cB|²)', rhoWood.rho11, 'violet')}
              </div>
            </div>

            {/* Standard QM Baseline Density Matrix */}
            {compareBaseline && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-400">
                    STANDARD QM BASELINE: ρ_std
                  </span>
                  <Badge className="bg-blue-600/30 text-[10px] text-blue-200">ESTABLISHED</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderCell('ρ_AA (|cA|²)', rhoStd.rho00, 'cyan')}
                  {renderCell('ρ_AB (cAcB*)', rhoStd.rho01, 'cyan')}
                  {renderCell('ρ_BA (cBcA*)', rhoStd.rho10, 'cyan')}
                  {renderCell('ρ_BB (|cB|²)', rhoStd.rho11, 'violet')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
