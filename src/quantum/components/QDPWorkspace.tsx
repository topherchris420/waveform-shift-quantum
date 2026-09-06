import React, { useState, useMemo } from 'react';
import { Cpu, Zap, Activity, Play, RotateCcw, BarChart2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { InlineMath } from 'react-katex';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { EquationBlock } from '@/components/lab/EquationBlock';
import {
  X1_TRUE,
  X2_TRUE,
  X3_TRUE,
  solveClassicalPPI,
  solveClassicalCombinatorial,
  solveQuantumQDP,
  type QDPExecutionSummary,
  encodeQubitState,
} from '@/lib/qdp';

export type QDPSolverMode = 'classical' | 'combinatorial' | 'hybrid' | 'quantum_oneshot' | 'quantum_multi';

export const QDPWorkspace: React.FC = () => {
  const [solverMode, setSolverMode] = useState<QDPSolverMode>('quantum_oneshot');
  const [x1Init, setX1Init] = useState<number>(0.5);
  const [x2Init, setX2Init] = useState<number>(-0.5);
  const [x3Init, setX3Init] = useState<number>(0.5);
  const [maxIterations, setMaxIterations] = useState<number>(4);
  const [numAnneals, setNumAnneals] = useState<number>(100);

  // Compute solver results dynamically based on inputs
  const result: QDPExecutionSummary = useMemo(() => {
    switch (solverMode) {
      case 'classical':
        return solveClassicalPPI(x1Init, x2Init, x3Init, maxIterations);
      case 'combinatorial':
        return solveClassicalCombinatorial(x1Init, x2Init, x3Init, maxIterations);
      case 'hybrid':
        return solveQuantumQDP('hybrid', x1Init, x2Init, x3Init, numAnneals, maxIterations);
      case 'quantum_multi':
        return solveQuantumQDP('quantum_multi', x1Init, x2Init, x3Init, numAnneals, maxIterations);
      case 'quantum_oneshot':
      default:
        return solveQuantumQDP('quantum_oneshot', x1Init, x2Init, x3Init, numAnneals, maxIterations);
    }
  }, [solverMode, x1Init, x2Init, x3Init, maxIterations, numAnneals]);

  const lastIteration = result.iterations[result.iterations.length - 1];
  const qubitEncoding = useMemo(() => encodeQubitState(lastIteration.x2, lastIteration.x3), [lastIteration]);

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/90 p-5 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-foreground">
              Quantum Dynamic Programming (QDP) Bench
            </h2>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">
            Fernández-Villaverde & Hull (2022) — Solving the Real Business Cycle (RBC) Model on D-Wave Pegasus QUBO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EpistemicTag kind="established" short />
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 font-mono text-xs text-cyan-300">
            QUBO Iterative Annealing
          </Badge>
        </div>
      </div>

      {/* Solver Selectors */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SolverButton
          mode="classical"
          active={solverMode === 'classical'}
          label="Classical PPI"
          sub="Benitez-Silva et al."
          onClick={() => setSolverMode('classical')}
        />
        <SolverButton
          mode="combinatorial"
          active={solverMode === 'combinatorial'}
          label="Combinatorial"
          sub="QUBO Discretization"
          onClick={() => setSolverMode('combinatorial')}
        />
        <SolverButton
          mode="hybrid"
          active={solverMode === 'hybrid'}
          label="Hybrid Quantum"
          sub="Analytical + QPU"
          onClick={() => setSolverMode('hybrid')}
        />
        <SolverButton
          mode="quantum_oneshot"
          active={solverMode === 'quantum_oneshot'}
          label="Quantum One-Shot"
          sub="Reverse Anneal"
          onClick={() => setSolverMode('quantum_oneshot')}
        />
        <SolverButton
          mode="quantum_multi"
          active={solverMode === 'quantum_multi'}
          label="Quantum Multi-Anneal"
          sub="Iterative QUBO"
          onClick={() => setSolverMode('quantum_multi')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Controls & Math */}
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
            <Zap className="h-4 w-4" /> Parameters & Controls
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between font-mono text-xs text-slate-300">
                <span>Initial Policy Parameter x₁</span>
                <span className="font-bold text-cyan-300">{x1Init.toFixed(2)}</span>
              </div>
              <Slider
                value={[x1Init]}
                onValueChange={([v]) => setX1Init(v)}
                min={0.05}
                max={0.95}
                step={0.01}
                className="mt-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs text-slate-300">
                <span>Initial Valuation Parameter x₂</span>
                <span className="font-bold text-cyan-300">{x2Init.toFixed(2)}</span>
              </div>
              <Slider
                value={[x2Init]}
                onValueChange={([v]) => setX2Init(v)}
                min={-35.0}
                max={0.0}
                step={0.5}
                className="mt-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs text-slate-300">
                <span>Initial Valuation Parameter x₃</span>
                <span className="font-bold text-cyan-300">{x3Init.toFixed(2)}</span>
              </div>
              <Slider
                value={[x3Init]}
                onValueChange={([v]) => setX3Init(v)}
                min={0.0}
                max={3.0}
                step={0.1}
                className="mt-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs text-slate-300">
                <span>Max Iterations</span>
                <span className="font-bold text-cyan-300">{maxIterations}</span>
              </div>
              <Slider
                value={[maxIterations]}
                onValueChange={([v]) => setMaxIterations(v)}
                min={1}
                max={10}
                step={1}
                className="mt-1.5"
              />
            </div>

            {solverMode.startsWith('quantum') || solverMode === 'hybrid' ? (
              <div>
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>QPU Anneals per Execution</span>
                  <span className="font-bold text-cyan-300">{numAnneals}</span>
                </div>
                <Slider
                  value={[numAnneals]}
                  onValueChange={([v]) => setNumAnneals(v)}
                  min={10}
                  max={500}
                  step={10}
                  className="mt-1.5"
                />
              </div>
            ) : null}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setX1Init(0.5);
              setX2Init(-0.5);
              setX3Init(0.5);
              setMaxIterations(4);
              setNumAnneals(100);
            }}
            className="w-full border-slate-700 bg-slate-900 font-mono text-xs text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            RESET TO BENCHMARK DEFAULTS
          </Button>

          <div className="mt-2 border-t border-slate-800 pt-3">
            <EquationBlock
              title="Parametric Policy Iteration & QUBO Encoding"
              latex="x_1^{(k+1)} = \frac{\alpha\beta x_3^{(k)}}{1 + \alpha\beta x_3^{(k)}},\quad \min_{q \in \{0,1\}^N} q^T Q(x_1) q"
              note="Policy improvement updates x₁ analytically; policy valuation maps x₂, x₃ to binary qubit registers."
            />
          </div>
        </div>

        {/* Live Convergence Metrics */}
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <BarChart2 className="h-4 w-4" /> Policy & Valuation Convergence
            </h3>
            <span className="font-mono text-[11px] text-slate-400">
              Execution time: <strong className="text-cyan-300">{result.totalTimeMs.toFixed(2)} ms</strong>
              {result.qpuAccessTimeMs ? ` (QPU: ${result.qpuAccessTimeMs.toFixed(2)} ms)` : ''}
            </span>
          </div>

          {/* Benchmark vs Calculated comparison grid */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="x₁ (Policy)"
              calc={lastIteration.x1}
              benchmark={X1_TRUE}
              error={lastIteration.x1Error}
            />
            <MetricCard
              label="x₂ (Valuation)"
              calc={lastIteration.x2}
              benchmark={X2_TRUE}
              error={lastIteration.x2Error}
            />
            <MetricCard
              label="x₃ (Valuation)"
              calc={lastIteration.x3}
              benchmark={X3_TRUE}
              error={lastIteration.x3Error}
            />
          </div>

          {/* Iteration history table */}
          <div className="overflow-x-auto rounded-md border border-slate-800">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="p-2">Iter</th>
                  <th className="p-2">x₁</th>
                  <th className="p-2">x₂</th>
                  <th className="p-2">x₃</th>
                  <th className="p-2">x₁ Err</th>
                  <th className="p-2">x₂ Err</th>
                  <th className="p-2">x₃ Err</th>
                  <th className="p-2">Loss (PV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {result.iterations.map((row) => (
                  <tr key={row.iteration} className="hover:bg-slate-900/40">
                    <td className="p-2 font-bold text-cyan-400">#{row.iteration}</td>
                    <td className="p-2">{row.x1.toFixed(4)}</td>
                    <td className="p-2">{row.x2.toFixed(4)}</td>
                    <td className="p-2">{row.x3.toFixed(4)}</td>
                    <td className="p-2 text-emerald-400">{row.x1Error.toFixed(2)}%</td>
                    <td className="p-2 text-emerald-400">{row.x2Error.toFixed(2)}%</td>
                    <td className="p-2 text-emerald-400">{row.x3Error.toFixed(2)}%</td>
                    <td className="p-2 text-amber-300">{row.lossPV.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Qubit binary register readout */}
          <div className="rounded-md border border-cyan-500/20 bg-cyan-950/20 p-3">
            <div className="flex items-center justify-between font-mono text-xs text-cyan-300">
              <span className="flex items-center gap-1.5 font-bold">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                Active Pegasus Qubit Register (10-bit Discretization)
              </span>
              <span>
                QUBO Sample Loss: <strong>{lastIteration.lossPV.toExponential(3)}</strong>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
              <div className="rounded border border-slate-800 bg-slate-950 p-2">
                <p className="text-slate-400">x₂ Register (q₀ ... q₉):</p>
                <p className="mt-1 tracking-widest text-emerald-400">{qubitEncoding.bits2.join(' ')}</p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-2">
                <p className="text-slate-400">x₃ Register (q₁₀ ... q₁₉):</p>
                <p className="mt-1 tracking-widest text-emerald-400">{qubitEncoding.bits3.join(' ')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SolverButtonProps {
  mode: QDPSolverMode;
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
}

const SolverButton: React.FC<SolverButtonProps> = ({ active, label, sub, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border p-2.5 text-left transition ${
      active
        ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
    }`}
  >
    <p className="font-mono text-xs font-bold leading-tight">{label}</p>
    <p className="mt-0.5 font-mono text-[10px] text-slate-500">{sub}</p>
  </button>
);

interface MetricCardProps {
  label: string;
  calc: number;
  benchmark: number;
  error: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, calc, benchmark, error }) => (
  <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
    <p className="font-mono text-[10px] uppercase text-slate-400">{label}</p>
    <p className="mt-1 font-mono text-lg font-bold text-foreground">{calc.toFixed(4)}</p>
    <div className="mt-1 flex items-center justify-between font-mono text-[10px]">
      <span className="text-slate-500">True: {benchmark.toFixed(4)}</span>
      <span className="font-semibold text-emerald-400">Err: {error.toFixed(2)}%</span>
    </div>
  </div>
);
