import React, { useState, useMemo } from 'react';
import { Target, Activity, Gauge, Zap, Waves, Sparkles, Scale, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { EquationBlock } from '@/components/lab/EquationBlock';
import {
  computeInterferometerFringes,
  computeRamseyFringes,
  type InterferometerSimulationParams,
  type RamseySpectroscopyParams,
} from '@/lib/physics';

export const InterferometryExperiment: React.FC = () => {
  const [subMode, setSubMode] = useState<'mach_zehnder' | 'ramsey'>('mach_zehnder');

  // Mach-Zehnder parameters
  const [armSeparation, setArmSeparation] = useState(10.0); // um
  const [interrogationTime, setInterrogationTime] = useState(2.5); // ms
  const [fieldGradient, setFieldGradient] = useState(0.8); // au / um
  const [couplingG, setCouplingG] = useState(0.85);
  const [dephasingNoise, setDephasingNoise] = useState(0.08);

  // Ramsey parameters
  const [detuning, setDetuning] = useState(1.5); // kHz
  const [ramseyTime, setRamseyTime] = useState(3.0); // ms
  const [fieldDiff, setFieldDiff] = useState(0.6);
  const [eta, setEta] = useState(1.2);
  const [decoherence, setDecoherence] = useState(0.12);

  // Mach-Zehnder fringes
  const mzResult = useMemo(() => {
    const p: InterferometerSimulationParams = {
      armSeparation_um: armSeparation,
      interrogationTime_ms: interrogationTime,
      fieldGradient_per_um: fieldGradient,
      coupling_g: couplingG,
      dephasingNoise: dephasingNoise,
    };
    return computeInterferometerFringes(p, 60);
  }, [armSeparation, interrogationTime, fieldGradient, couplingG, dephasingNoise]);

  // Ramsey fringes
  const ramseyResult = useMemo(() => {
    const p: RamseySpectroscopyParams = {
      detuning_kHz: detuning,
      interrogationTime_ms: ramseyTime,
      fieldDiff_au: fieldDiff,
      eta: eta,
      decoherenceRate: decoherence,
    };
    return computeRamseyFringes(p, 60);
  }, [detuning, ramseyTime, fieldDiff, eta, decoherence]);

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/90 p-5 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-foreground">
              Matter-Wave Interferometry & Ramsey Clock Signatures
            </h2>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">
            Woodyard (2026) §7 — Dual-Arm Phase Shift & Differential Clock Spectroscopy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EpistemicTag kind="prediction" short />
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 font-mono text-xs text-cyan-300">
            Precision Phase Verification
          </Badge>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        <Button
          variant={subMode === 'mach_zehnder' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubMode('mach_zehnder')}
          className={`font-mono text-xs ${
            subMode === 'mach_zehnder'
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Waves className="mr-1.5 h-3.5 w-3.5" />
          Mach-Zehnder Atom Interferometer
        </Button>
        <Button
          variant={subMode === 'ramsey' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubMode('ramsey')}
          className={`font-mono text-xs ${
            subMode === 'ramsey'
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Gauge className="mr-1.5 h-3.5 w-3.5" />
          Optical Clock Ramsey Spectroscopy
        </Button>
      </div>

      {subMode === 'mach_zehnder' ? (
        /* Mach-Zehnder View */
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Controls */}
          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Zap className="h-4 w-4" /> Beam Path & Field Controls
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Arm Separation Δx (μm)</span>
                  <span className="font-bold text-cyan-300">{armSeparation.toFixed(1)} μm</span>
                </div>
                <Slider
                  value={[armSeparation]}
                  onValueChange={([v]) => setArmSeparation(v)}
                  min={1.0}
                  max={50.0}
                  step={0.5}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Interrogation Time T (ms)</span>
                  <span className="font-bold text-cyan-300">{interrogationTime.toFixed(1)} ms</span>
                </div>
                <Slider
                  value={[interrogationTime]}
                  onValueChange={([v]) => setInterrogationTime(v)}
                  min={0.2}
                  max={10.0}
                  step={0.1}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Scalar Gradient ∇φ</span>
                  <span className="font-bold text-amber-300">{fieldGradient.toFixed(2)}</span>
                </div>
                <Slider
                  value={[fieldGradient]}
                  onValueChange={([v]) => setFieldGradient(v)}
                  min={0.0}
                  max={3.0}
                  step={0.05}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Coupling Strength g</span>
                  <span className="font-bold text-amber-300">{couplingG.toFixed(2)}</span>
                </div>
                <Slider
                  value={[couplingG]}
                  onValueChange={([v]) => setCouplingG(v)}
                  min={0.0}
                  max={3.0}
                  step={0.05}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Dephasing Noise γ</span>
                  <span className="font-bold text-slate-400">{dephasingNoise.toFixed(3)}</span>
                </div>
                <Slider
                  value={[dephasingNoise]}
                  onValueChange={([v]) => setDephasingNoise(v)}
                  min={0.0}
                  max={0.5}
                  step={0.01}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-3">
              <EquationBlock
                tex="\Delta\varphi_\phi = \frac{g}{\hbar} \int_0^T [\phi(x_1,t) - \phi(x_2,t)]\,dt"
                caption="Interferometric Phase Shift Integral"
              />
            </div>
          </div>

          {/* Visualization & Fringes */}
          <div className="space-y-4 lg:col-span-2">
            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                <div className="text-[10px] text-cyan-400 uppercase">Phase Shift Δφ_φ</div>
                <div className="text-xl font-bold text-cyan-200">
                  {mzResult.phaseShift_rad.toFixed(4)} <span className="text-xs font-normal">rad</span>
                </div>
                <div className="text-[10px] text-slate-400">{(mzResult.phaseShift_deg % 360).toFixed(1)}°</div>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
                <div className="text-[10px] text-emerald-400 uppercase">Fringe Visibility V</div>
                <div className="text-xl font-bold text-emerald-300">
                  {(mzResult.visibility * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">Contrast retention</div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                <div className="text-[10px] text-amber-400 uppercase">Max Deviation ΔI</div>
                <div className="text-xl font-bold text-amber-300">
                  {(mzResult.maxDelta * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">Intensity anomaly</div>
              </div>

              <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                <div className="text-[10px] text-purple-400 uppercase">Status</div>
                <div className="text-sm font-bold text-purple-200">
                  {Math.abs(mzResult.phaseShift_rad) > 1e-3 ? 'DETECTABLE' : 'SUBSENSITIVE'}
                </div>
                <div className="text-[9px] text-slate-400">Atom Interferometry</div>
              </div>
            </div>

            {/* Fringe Plot */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Interference Fringes: Standard QM (Blue) vs. Woodyard Model (Amber)
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> Standard QM
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Woodyard Model
                  </span>
                </div>
              </div>

              {/* SVG Fringe Chart */}
              <div className="h-44 w-full">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 500 150">
                  {/* Grid lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.8" />
                  <line x1="40" y1="75" x2="480" y2="75" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.8" />
                  <line x1="40" y1="130" x2="480" y2="130" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.8" />

                  {/* Axes */}
                  <line x1="40" y1="20" x2="40" y2="130" stroke="#64748b" strokeWidth="1" />
                  <line x1="40" y1="130" x2="480" y2="130" stroke="#64748b" strokeWidth="1" />

                  {/* Labels */}
                  <text x="32" y="24" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">1.0</text>
                  <text x="32" y="79" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">0.5</text>
                  <text x="32" y="134" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">0.0</text>

                  <text x="40" y="145" fill="#94a3b8" fontSize="9" textAnchor="start" fontFamily="monospace">0°</text>
                  <text x="260" y="145" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">180° (π)</text>
                  <text x="480" y="145" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">360° (2π)</text>

                  {/* Standard QM Curve (Blue) */}
                  <path
                    d={mzResult.fringePoints
                      .map((p, idx) => {
                        const x = 40 + (idx / (mzResult.fringePoints.length - 1)) * 440;
                        const y = 130 - p.standardIntensity * 110;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                  />

                  {/* Woodyard Model Curve (Amber) */}
                  <path
                    d={mzResult.fringePoints
                      .map((p, idx) => {
                        const x = 40 + (idx / (mzResult.fringePoints.length - 1)) * 440;
                        const y = 130 - p.modelIntensity * 110;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray={couplingG > 0 ? 'none' : '4,4'}
                  />
                </svg>
              </div>

              {/* Falsification Note */}
              <div className="mt-3 flex items-start gap-2 rounded bg-slate-900/90 p-2.5 font-mono text-[11px] text-slate-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
                <span>
                  <strong>Falsification Bound:</strong> If precision atom interferometers (e.g. 10m atomic fountains) observe zero fringe displacement Δφ &lt; 10⁻⁴ rad in the presence of this scalar gradient, the parameter pair (g, ∇φ) is strictly falsified.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Ramsey Spectroscopy View */
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Controls */}
          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Gauge className="h-4 w-4" /> Atomic Clock Parameters
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Detuning Δω (kHz)</span>
                  <span className="font-bold text-cyan-300">{detuning.toFixed(2)} kHz</span>
                </div>
                <Slider
                  value={[detuning]}
                  onValueChange={([v]) => setDetuning(v)}
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Ramsey Time T (ms)</span>
                  <span className="font-bold text-cyan-300">{ramseyTime.toFixed(1)} ms</span>
                </div>
                <Slider
                  value={[ramseyTime]}
                  onValueChange={([v]) => setRamseyTime(v)}
                  min={0.5}
                  max={10.0}
                  step={0.2}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Differential Field δφ</span>
                  <span className="font-bold text-amber-300">{fieldDiff.toFixed(2)}</span>
                </div>
                <Slider
                  value={[fieldDiff]}
                  onValueChange={([v]) => setFieldDiff(v)}
                  min={0.0}
                  max={2.0}
                  step={0.05}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Clock Coupling Coefficient η</span>
                  <span className="font-bold text-amber-300">{eta.toFixed(2)}</span>
                </div>
                <Slider
                  value={[eta]}
                  onValueChange={([v]) => setEta(v)}
                  min={0.0}
                  max={3.0}
                  step={0.05}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>Decoherence Rate Γ</span>
                  <span className="font-bold text-slate-400">{decoherence.toFixed(2)}</span>
                </div>
                <Slider
                  value={[decoherence]}
                  onValueChange={([v]) => setDecoherence(v)}
                  min={0.0}
                  max={0.5}
                  step={0.01}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-3">
              <EquationBlock
                tex="\Delta\Phi_{AB}(T) = \eta \int_0^T [\phi(x_A, t) - \phi(x_B, t)]\,dt"
                caption="Differential Clock Offset Integral"
              />
            </div>
          </div>

          {/* Ramsey Chart */}
          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 font-mono text-xs">
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                <div className="text-[10px] text-cyan-400 uppercase">Clock Phase Offset ΔΦ</div>
                <div className="text-xl font-bold text-cyan-200">
                  {ramseyResult.differentialPhase_rad.toFixed(4)} <span className="text-xs font-normal">rad</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                <div className="text-[10px] text-amber-400 uppercase">Induced Frequency Shift</div>
                <div className="text-xl font-bold text-amber-300">
                  {ramseyResult.frequencyShift_Hz.toFixed(1)} <span className="text-xs font-normal">Hz</span>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
                <div className="text-[10px] text-emerald-400 uppercase">Remaining Contrast</div>
                <div className="text-xl font-bold text-emerald-300">
                  {(ramseyResult.decayContrast * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Time-Domain Ramsey Fringes: Transition Probability P_exc(t)
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> Standard QM
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Woodyard Model
                  </span>
                </div>
              </div>

              {/* SVG Ramsey Curve */}
              <div className="h-44 w-full">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 500 150">
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.8" />
                  <line x1="40" y1="75" x2="480" y2="75" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.8" />
                  <line x1="40" y1="130" x2="480" y2="130" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.8" />

                  <line x1="40" y1="20" x2="40" y2="130" stroke="#64748b" strokeWidth="1" />
                  <line x1="40" y1="130" x2="480" y2="130" stroke="#64748b" strokeWidth="1" />

                  <text x="32" y="24" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">1.0</text>
                  <text x="32" y="79" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">0.5</text>
                  <text x="32" y="134" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">0.0</text>

                  <text x="40" y="145" fill="#94a3b8" fontSize="9" textAnchor="start" fontFamily="monospace">0 ms</text>
                  <text x="260" y="145" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">{(ramseyTime / 2).toFixed(1)} ms</text>
                  <text x="480" y="145" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">{ramseyTime.toFixed(1)} ms</text>

                  {/* Standard Curve */}
                  <path
                    d={ramseyResult.fringePoints
                      .map((p, idx) => {
                        const x = 40 + (idx / (ramseyResult.fringePoints.length - 1)) * 440;
                        const y = 130 - p.standardProb * 110;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                  />

                  {/* Woodyard Curve */}
                  <path
                    d={ramseyResult.fringePoints
                      .map((p, idx) => {
                        const x = 40 + (idx / (ramseyResult.fringePoints.length - 1)) * 440;
                        const y = 130 - p.modelProb * 110;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
