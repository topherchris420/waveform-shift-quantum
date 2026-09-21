import React, { useMemo, useRef, useState } from 'react';
import { Atom, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BlochSphere } from '@/components/lab/BlochSphere';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { evaluateInstrument } from '@/lib/instruments';
import { bornProbabilities, pearsonChiSquared } from '@/lib/physics';

function lcg(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function sampleOutcome(shot: number, p0: number): 0 | 1 {
  const u = lcg(shot * 2654435761) / 4294967296;
  return u < p0 ? 0 : 1;
}

/**
 * Local Born-rule measurement bench. Projective outcomes accumulate against
 * P(0) = cos²(θ/2), gated to superposition mode.
 */
export const BornRuleBench: React.FC = () => {
  const [theta, setTheta] = useState([Math.PI / 3]);
  const [phi, setPhi] = useState([Math.PI / 5]);
  const [counts, setCounts] = useState<[number, number]>([0, 0]);
  const shotRef = useRef(0);

  const { p0, p1 } = useMemo(() => bornProbabilities(theta[0]), [theta]);
  const local = useMemo(
    () => evaluateInstrument('born_probabilities', { theta_rad: theta[0] }),
    [theta],
  );
  const n = counts[0] + counts[1];
  const chi2 = n === 0 ? 0 : pearsonChiSquared(counts, [n * p0, n * p1]);

  const measure = (shots = 1) => {
    setCounts((current) => {
      const next: [number, number] = [current[0], current[1]];
      for (let i = 0; i < shots; i++) {
        const k = (shotRef.current += 1);
        next[sampleOutcome(k, p0)] += 1;
      }
      return next;
    });
  };

  const reset = () => {
    shotRef.current = 0;
    setCounts([0, 0]);
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            <Atom className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
              Born-rule bench — Bloch sphere
            </h3>
            <p className="text-xs text-slate-400">
              Local instrument. P(0) = cos²(θ/2), P(1) = sin²(θ/2). Histogram vs closed form.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EpistemicTag kind="established" />
          <Button size="sm" className="bg-cyan-600 font-mono text-xs font-bold text-white hover:bg-cyan-500" onClick={() => measure(1)}>
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            MEASURE
          </Button>
          <Button size="sm" variant="outline" className="border-slate-700 bg-slate-800 font-mono text-xs text-slate-200" onClick={() => measure(32)}>
            ×32
          </Button>
          <Button size="sm" variant="outline" className="border-slate-700 bg-slate-800 font-mono text-xs text-slate-200" onClick={reset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            RESET
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <BlochSphere theta={theta[0]} phi={phi[0]} size={180} label="|ψ⟩" />
          <div className="mt-3 space-y-3">
            <LabeledSlider label="Polar θ" value={theta} onChange={setTheta} min={0} max={Math.PI} step={0.01} display={`${theta[0].toFixed(2)} rad`} />
            <LabeledSlider label="Azimuth φ" value={phi} onChange={setPhi} min={0} max={2 * Math.PI} step={0.01} display={`${phi[0].toFixed(2)} rad`} />
          </div>
        </div>

        <div className="space-y-4">
          <Histogram p0={p0} counts={counts} />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-4">
            <MetricCell label="p(0) Born" value={p0.toFixed(4)} note="cos²(θ/2)" />
            <MetricCell label="p(1) Born" value={p1.toFixed(4)} note="sin²(θ/2)" />
            <MetricCell label="Local p(0)" value={typeof local.structured.p0 === 'number' ? local.structured.p0.toFixed(4) : '—'} note="evaluateInstrument" />
            <MetricCell label="χ² (2 bins)" value={n === 0 ? '—' : chi2.toFixed(3)} note={`${n} shots`} />
          </div>
        </div>
      </div>
    </section>
  );
};

const Histogram: React.FC<{ p0: number; counts: [number, number] }> = ({ p0, counts }) => {
  const n = counts[0] + counts[1];
  const obs0 = n === 0 ? 0 : counts[0] / n;
  const obs1 = n === 0 ? 0 : counts[1] / n;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">Measurement histogram vs Born prediction</p>
      <Bar label="|0⟩" observed={obs0} expected={p0} count={counts[0]} tone="cyan" />
      <Bar label="|1⟩" observed={obs1} expected={1 - p0} count={counts[1]} tone="violet" />
    </div>
  );
};

const Bar: React.FC<{ label: string; observed: number; expected: number; count: number; tone: 'cyan' | 'violet' }> = ({
  label,
  observed,
  expected,
  count,
  tone,
}) => {
  const color = tone === 'cyan' ? 'bg-cyan-400' : 'bg-violet-400';
  const expectedColor = tone === 'cyan' ? 'border-cyan-300' : 'border-violet-300';
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] text-slate-400">
        <span>{label}</span>
        <span>
          n={count} · obs {observed.toFixed(3)} · Born {expected.toFixed(3)}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, observed)) * 100}%` }} />
        <div className={`absolute top-0 h-full border-r-2 ${expectedColor}`} style={{ left: `${Math.max(0, Math.min(1, expected)) * 100}%` }} />
      </div>
    </div>
  );
};

const LabeledSlider: React.FC<{
  label: string;
  value: number[];
  onChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}> = ({ label, value, onChange, min, max, step, display }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="font-mono text-[11px] text-slate-300">{label}</span>
      <span className="font-mono text-[11px] font-bold text-cyan-300">{display}</span>
    </div>
    <Slider aria-label={label} value={value} onValueChange={onChange} min={min} max={max} step={step} />
  </div>
);

const MetricCell: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="bg-slate-950 px-3 py-2.5">
    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-mono text-base font-bold text-slate-100">{value}</div>
    <div className="font-mono text-[10px] text-slate-500">{note}</div>
  </div>
);
