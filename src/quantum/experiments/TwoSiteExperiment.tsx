import React, { useEffect, useRef, useState } from 'react';
import { Activity, Gauge, Info, Play, Pause, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { evolveTwoSiteState, TwoSiteStateVector, twoSiteModel, Complex } from '@/lib/physics';

interface TwoSiteExperimentProps {
  parameters: {
    g: number;
    phiA: number;
    phiB: number;
    delta: number;
  };
}

export const TwoSiteExperiment: React.FC<TwoSiteExperimentProps> = ({ parameters }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [history, setHistory] = useState<Array<{ t: number; PA: number; PB: number; norm: number }>>([]);
  
  // State vector |ψ(t)⟩ = [cA, cB] initialized to site A |A⟩ = [1, 0]
  const stateRef = useRef<TwoSiteStateVector>({
    cA: { re: 1.0, im: 0.0 },
    cB: { re: 0.0, im: 0.0 },
  });

  const timeRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const resetSimulation = () => {
    stateRef.current = { cA: { re: 1.0, im: 0.0 }, cB: { re: 0.0, im: 0.0 } };
    timeRef.current = 0;
    setTime(0);
    setHistory([]);
  };

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (isPlaying) {
        const deltaMs = Math.min(now - lastTime, 50);
        lastTime = now;
        const dt = deltaMs * 0.003; // simulation time step

        // Time-dependent field modulation oscillation
        const dynamicPhiA = parameters.phiA + Math.sin(timeRef.current * 1.5) * 0.4;
        const dynamicPhiB = parameters.phiB - Math.sin(timeRef.current * 1.5) * 0.4;

        const currentParams = {
          EA: 1.0,
          EB: 1.0,
          phiA: dynamicPhiA,
          phiB: dynamicPhiB,
          g: parameters.g,
          delta: parameters.delta,
        };

        // Numerical evolution step using unitary matrix propagator (exact norm conservation)
        const stepResult = evolveTwoSiteState(stateRef.current, currentParams, dt);
        stateRef.current = stepResult.state;
        timeRef.current += dt;

        setTime(timeRef.current);
        setHistory((prev) => {
          const next = [...prev, { t: timeRef.current, PA: stepResult.PA, PB: stepResult.PB, norm: stepResult.norm }];
          return next.slice(-150); // Keep last 150 points for chart
        });
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, parameters]);

  const currentPA = history.length > 0 ? history[history.length - 1].PA : 1.0;
  const currentPB = history.length > 0 ? history[history.length - 1].PB : 0.0;
  const currentNorm = history.length > 0 ? history[history.length - 1].norm : 1.0;

  // Instantaneous eigensolutions for comparison
  const eigenResult = twoSiteModel({
    EA: 1.0,
    EB: 1.0,
    phiA: parameters.phiA,
    phiB: parameters.phiB,
    g: parameters.g,
    delta: parameters.delta,
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
              NUMERICAL TIME EVOLUTION: iħ d|ψ⟩/dt = H(t)|ψ⟩
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Real-time unitary propagation of state vector |ψ(t)⟩ = cA(t)|A⟩ + cB(t)|B⟩.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="border-slate-700 bg-slate-800 font-mono text-xs text-slate-200"
          >
            {isPlaying ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            {isPlaying ? 'PAUSE' : 'RESUME'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSimulation}
            className="border-slate-700 bg-slate-800 font-mono text-xs text-slate-200"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            RESET
          </Button>
        </div>
      </div>

      {/* Live Numerical Indicators */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 font-mono text-xs">
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
          <div className="text-[10px] text-cyan-400">PA(t) = |cA(t)|²</div>
          <div className="text-xl font-bold text-cyan-200">{currentPA.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
          <div className="text-[10px] text-violet-400">PB(t) = |cB(t)|²</div>
          <div className="text-xl font-bold text-violet-200">{currentPB.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
          <div className="text-[10px] text-emerald-400">NORM preservation</div>
          <div className="text-xl font-bold text-emerald-300">{currentNorm.toFixed(6)}</div>
          <div className="text-[9px] text-emerald-400/80">PA + PB ≈ 1.000000</div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
          <div className="text-[10px] text-amber-400">EIGENSTATE PB</div>
          <div className="text-xl font-bold text-amber-200">{eigenResult.PB.toFixed(4)}</div>
          <div className="text-[9px] text-amber-400/80">Instantaneous stationary limit</div>
        </div>
      </div>

      {/* SVG Time-Series Chart for PA(t) and PB(t) */}
      <div className="relative h-44 rounded-lg border border-slate-800 bg-slate-950/90 p-2">
        <div className="absolute left-3 top-2 font-mono text-[10px] text-slate-400">
          <span className="mr-3 text-cyan-300">━ PA(t)</span>
          <span className="mr-3 text-violet-300">━ PB(t)</span>
          <span className="text-emerald-400">┄ Norm (1.0)</span>
        </div>

        <svg className="h-full w-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(13,13,13,0.18)" strokeDasharray="3 3" strokeWidth="0.5" />
          <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(13,13,13,0.18)" strokeDasharray="3 3" strokeWidth="0.5" />
          <line x1="0" y1="110" x2="400" y2="110" stroke="rgba(13,13,13,0.18)" strokeDasharray="3 3" strokeWidth="0.5" />

          {/* PA line (Cyan) */}
          {history.length > 1 && (
            <polyline
              fill="none"
              stroke="#0ea5b7"
              strokeWidth="2"
              points={history
                .map((pt, i) => `${(i / (history.length - 1)) * 400},${110 - pt.PA * 90}`)
                .join(' ')}
            />
          )}

          {/* PB line (Violet) */}
          {history.length > 1 && (
            <polyline
              fill="none"
              stroke="#5b21b6"
              strokeWidth="2"
              points={history
                .map((pt, i) => `${(i / (history.length - 1)) * 400},${110 - pt.PB * 90}`)
                .join(' ')}
            />
          )}
        </svg>
      </div>

      {/* Scientific Clarification Note */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
        <span>
          <strong className="text-slate-300">Standard Two-Level Physics Notice:</strong> Oscillatory population exchange, avoided crossings, and adiabatic transfer are standard dynamical features of any driven two-level quantum system (such as Rabi oscillations in NMR or superconducting qubits) and do not by themselves constitute evidence for scalar field spatial localization.
        </span>
      </div>
    </div>
  );
};
