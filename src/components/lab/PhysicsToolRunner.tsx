import { useMemo, useState } from 'react';
import { Loader2, Play, Terminal, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  twoSiteModel,
  localizationKernel,
  barrierTransmission,
  doubleSlitIntensity,
  bornProbabilities,
  teleportationFidelity,
  wernerConcurrence,
  computeInterferometerFringes,
  compareModels,
} from '@/lib/physics';
import { searchAnomalies } from '@/lib/anomalyEngine';

type FieldType = 'number' | 'bit' | 'select';

interface ToolField {
  name: string;
  label: string;
  type: FieldType;
  default: number | string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
}

interface ToolDef {
  name: string;
  title: string;
  summary: string;
  fields: ToolField[];
  visualize: (out: Record<string, unknown>) => React.ReactNode;
  localCompute?: (inputs: Record<string, unknown>) => { structured: Record<string, unknown>; text: string };
}

/** Structured MCP output is untyped JSON; these narrow it at the render edge. */
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const str = (v: unknown) => (v == null ? '' : String(v));

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) || 'https://wpkvetwoxcrggyeaidfs.supabase.co';
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwa3ZldHdveGNyZ2d5ZWFpZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQ3MjksImV4cCI6MjEwMDI0MDcyOX0.hgyxt4aNslA_9asnNTd3UqSweKh3iaibsRdP_1QA1Oc';
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;

function Bar({ value, label, tone = 'cyan' }: { value: number; label: string; tone?: 'cyan' | 'violet' | 'amber' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color =
    tone === 'violet' ? 'from-violet-500 to-fuchsia-400' : tone === 'amber' ? 'from-amber-400 to-orange-500' : 'from-cyan-400 to-sky-500';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-widest text-slate-400">
        <span>{label}</span>
        <span className="text-slate-200">{value.toExponential(4)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const TOOLS: ToolDef[] = [
  {
    name: 'two_site_transfer',
    title: 'Two-Site Localization Transfer (Woodyard 2026)',
    summary: 'Continuous localization transfer between site A & B via detuning δ(t) = (EB - EA) + g(φB - φA).',
    fields: [
      { name: 'bare_EA', label: 'Site EA', type: 'number', default: 1.0, step: 0.1, unit: 'eV' },
      { name: 'bare_EB', label: 'Site EB', type: 'number', default: 1.0, step: 0.1, unit: 'eV' },
      { name: 'field_phiA', label: 'Field φA', type: 'number', default: -0.5, step: 0.1 },
      { name: 'field_phiB', label: 'Field φB', type: 'number', default: 0.5, step: 0.1 },
      { name: 'coupling_g', label: 'Coupling g', type: 'number', default: 0.8, step: 0.1 },
      { name: 'mixing_delta', label: 'Mixing Δ', type: 'number', default: 0.2, min: 0.01, step: 0.05, unit: 'eV' },
    ],
    localCompute: (inputs) => {
      const res = twoSiteModel({
        EA: num(inputs.bare_EA),
        EB: num(inputs.bare_EB),
        phiA: num(inputs.field_phiA),
        phiB: num(inputs.field_phiB),
        g: num(inputs.coupling_g),
        delta: num(inputs.mixing_delta),
      });
      return {
        structured: { ...res },
        text: `PA = ${res.PA.toFixed(4)}, PB = ${res.PB.toFixed(4)}, z = ${res.z.toFixed(4)} (detuning δ = ${res.detuning.toFixed(3)} eV)`,
      };
    },
    visualize: (o) => {
      const res = twoSiteModel({
        EA: (o.bare_EA as number) ?? 1.0,
        EB: (o.bare_EB as number) ?? 1.0,
        phiA: (o.field_phiA as number) ?? -0.5,
        phiB: (o.field_phiB as number) ?? 0.5,
        g: (o.coupling_g as number) ?? 0.8,
        delta: (o.mixing_delta as number) ?? 0.2,
      });
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
              Detuning δ = {res.detuning.toFixed(3)} eV
            </Badge>
            <span className="font-mono text-xs text-slate-400">θ = {(res.theta * (180 / Math.PI)).toFixed(1)}°</span>
          </div>
          <Bar value={res.PA} label="Site A Occupation PA" tone="cyan" />
          <Bar value={res.PB} label="Site B Occupation PB" tone="violet" />
          <div className="font-mono text-xs text-slate-300">
            Occupation Imbalance z(t) = <span className="text-amber-300 font-bold">{res.z.toFixed(4)}</span>
          </div>
        </div>
      );
    },
  },
  {
    name: 'field_localization_kernel',
    title: 'Localization Kernel χ(x) (Woodyard 2026)',
    summary: 'Biased spatial localization response profile L(x) and kernel χ(x) = exp[α L(x)].',
    fields: [
      { name: 'omega0', label: 'Baseline ω₀', type: 'number', default: 10.0, step: 0.5, unit: 'GHz' },
      { name: 'beta', label: 'Field coeff β', type: 'number', default: 2.0, step: 0.2 },
      { name: 'phi', label: 'Scalar φ(x)', type: 'number', default: 1.2, step: 0.1 },
      { name: 'drive_w', label: 'Drive ω_w', type: 'number', default: 12.4, step: 0.2, unit: 'GHz' },
      { name: 'gamma', label: 'Linewidth Γ', type: 'number', default: 1.5, min: 0.1, step: 0.1 },
      { name: 'alpha', label: 'Strength α', type: 'number', default: 1.0, step: 0.1 },
    ],
    localCompute: (inputs) => {
      const res = localizationKernel({
        omega0: num(inputs.omega0),
        beta: num(inputs.beta),
        kappa: 0,
        phi: num(inputs.phi),
        d2phi: 0,
        omega_w: num(inputs.drive_w),
        gamma: num(inputs.gamma),
        alpha: num(inputs.alpha),
      });
      return {
        structured: { ...res },
        text: `χ(x) = ${res.chi.toFixed(4)}, L(x) = ${res.L.toFixed(4)}, ω_loc = ${res.omega_loc.toFixed(2)} GHz`,
      };
    },
    visualize: (o) => {
      const res = localizationKernel({
        omega0: (o.omega0 as number) ?? 10.0,
        beta: (o.beta as number) ?? 2.0,
        kappa: 0,
        phi: (o.phi as number) ?? 1.2,
        d2phi: 0,
        omega_w: (o.drive_w as number) ?? 12.4,
        gamma: (o.gamma as number) ?? 1.5,
        alpha: (o.alpha as number) ?? 1.0,
      });
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-200">
              ω_loc = {res.omega_loc.toFixed(2)} GHz
            </Badge>
            <span className="font-mono text-xs text-slate-400">Response L(x) = {res.L.toFixed(4)}</span>
          </div>
          <Bar value={res.L} label="Response Profile L(x)" tone="amber" />
          <div className="font-mono text-xs text-cyan-200">
            Kernel Factor χ(x) = exp(α L) = <span className="font-bold text-cyan-100">{res.chi.toFixed(4)}</span>
          </div>
        </div>
      );
    },
  },
  {
    name: 'interferometry_phase_shift',
    title: 'Matter-Wave Interferometry Phase Shift',
    summary: 'Calculates the predicted matter-wave interferometric phase shift Δφ and fringe visibility.',
    fields: [
      { name: 'armSeparation_um', label: 'Arm Separation Δx', type: 'number', default: 10.0, step: 0.5, unit: 'µm' },
      { name: 'interrogationTime_ms', label: 'Interrogation Time T', type: 'number', default: 2.5, step: 0.1, unit: 'ms' },
      { name: 'fieldGradient_per_um', label: 'Field Gradient ∇φ', type: 'number', default: 0.8, step: 0.05 },
      { name: 'coupling_g', label: 'Coupling g', type: 'number', default: 0.85, step: 0.05 },
      { name: 'dephasingNoise', label: 'Dephasing Noise γ', type: 'number', default: 0.05, step: 0.01 },
    ],
    localCompute: (inputs) => {
      const res = computeInterferometerFringes({
        armSeparation_um: num(inputs.armSeparation_um),
        interrogationTime_ms: num(inputs.interrogationTime_ms),
        fieldGradient_per_um: num(inputs.fieldGradient_per_um),
        coupling_g: num(inputs.coupling_g),
        dephasingNoise: num(inputs.dephasingNoise),
      });
      return {
        structured: { ...res },
        text: `Phase Shift Δφ = ${res.phaseShift_rad.toFixed(4)} rad (${res.phaseShift_deg.toFixed(2)}°), Visibility = ${(res.visibility * 100).toFixed(1)}%`,
      };
    },
    visualize: (o) => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
            Δφ = {num(o.phaseShift_rad).toFixed(4)} rad ({num(o.phaseShift_deg).toFixed(1)}°)
          </Badge>
          <span className="font-mono text-xs text-slate-400">Visibility: {(num(o.visibility) * 100).toFixed(1)}%</span>
        </div>
        <Bar value={num(o.visibility)} label="Fringe Contrast Visibility" tone="cyan" />
        <Bar value={num(o.maxDelta)} label="Max Intensity Deviation ΔI" tone="amber" />
      </div>
    ),
  },
  {
    name: 'compare_models',
    title: 'Dual Model Comparison & Falsification',
    summary: 'Compares Standard QM vs Woodyard Model with explicit falsification conditions.',
    fields: [
      { name: 'g', label: 'Coupling g', type: 'number', default: 0.8, step: 0.05 },
      { name: 'phiA', label: 'Field φA', type: 'number', default: -0.6, step: 0.1 },
      { name: 'phiB', label: 'Field φB', type: 'number', default: 0.6, step: 0.1 },
      { name: 'delta', label: 'Mixing Δ', type: 'number', default: 0.25, step: 0.05, unit: 'eV' },
      { name: 'alpha', label: 'Response α', type: 'number', default: 1.2, step: 0.1 },
    ],
    localCompute: (inputs) => {
      const res = compareModels('two_site', {
        g: num(inputs.g),
        phiA: num(inputs.phiA),
        phiB: num(inputs.phiB),
        delta: num(inputs.delta),
        alpha: num(inputs.alpha),
      });
      return {
        structured: { ...res },
        text: `Standard QM = ${res.standardQM.toFixed(4)}, Woodyard = ${res.woodyardModel.toFixed(4)}, Δ = ${res.delta.toFixed(4)} (${res.percentDeviation.toFixed(2)}%)`,
      };
    },
    visualize: (o) => (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="rounded border border-blue-500/30 bg-blue-950/30 p-2">
            <span className="text-blue-400 text-[10px]">Standard QM</span>
            <div className="text-sm font-bold text-blue-200">{num(o.standardQM).toFixed(4)}</div>
          </div>
          <div className="rounded border border-amber-500/30 bg-amber-950/30 p-2">
            <span className="text-amber-400 text-[10px]">Woodyard Model</span>
            <div className="text-sm font-bold text-amber-200">{num(o.woodyardModel).toFixed(4)}</div>
          </div>
        </div>
        <div className="font-mono text-xs text-emerald-300">
          Deviation: <span className="font-bold">{num(o.delta) >= 0 ? '+' : ''}{num(o.delta).toFixed(4)} ({num(o.percentDeviation).toFixed(2)}%)</span>
        </div>
      </div>
    ),
  },
  {
    name: 'anomaly_search',
    title: 'Automated Anomaly Parameter Sweep',
    summary: 'Automated search for regimes that maximize measurable statistical deviation.',
    fields: [
      { name: 'seed', label: 'PRNG Seed', type: 'number', default: 42, step: 1 },
      { name: 'iterations', label: 'Iterations', type: 'number', default: 50, step: 10, min: 10, max: 200 },
    ],
    localCompute: (inputs) => {
      const candidates = searchAnomalies({ seed: num(inputs.seed), iterations: num(inputs.iterations) });
      return {
        structured: { totalDiscovered: candidates.length, topRegimes: candidates.slice(0, 3) },
        text: `Found ${candidates.length} candidate regimes. Top score: ${candidates[0]?.score}`,
      };
    },
    visualize: (o) => {
      const top = (o.topRegimes as Array<Record<string, unknown>>) || [];
      return (
        <div className="space-y-2 font-mono text-xs">
          <div className="text-cyan-300 font-bold">Discovered {num(o.totalDiscovered)} Candidate Regimes</div>
          {top.map((item, idx) => (
            <div key={idx} className="rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
              <div className="flex justify-between text-slate-300">
                <span>{str(item.id)}</span>
                <span className="text-amber-300 font-bold">Score: {num(item.score)}</span>
              </div>
              <div className="text-[10px] text-slate-400">{str(item.candidatePlatform)} · ΔP = {num(item.deltaP).toFixed(4)}</div>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    name: 'barrier_transmission',
    title: '1D barrier transmission',
    summary: 'Rectangular potential barrier T(E, V, a). Tunneling, resonant, or oscillatory.',
    fields: [
      { name: 'energy_eV', label: 'Energy E', type: 'number', default: 1.0, min: 0.001, step: 0.05, unit: 'eV' },
      { name: 'barrier_eV', label: 'Barrier V', type: 'number', default: 2.0, min: 0.001, step: 0.05, unit: 'eV' },
      { name: 'width_nm', label: 'Width a', type: 'number', default: 0.5, min: 0.001, step: 0.05, unit: 'nm' },
    ],
    localCompute: (inputs) => {
      const res = barrierTransmission(num(inputs.energy_eV), num(inputs.barrier_eV), num(inputs.width_nm));
      return {
        structured: { ...res, transmission: res.T, reflection: 1 - res.T },
        text: `T = ${res.T.toExponential(4)} (regime: ${res.regime}, κa = ${res.kappa_a.toFixed(4)})`,
      };
    },
    visualize: (o) => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200">regime: {str(o.regime)}</Badge>
          <span className="font-mono text-xs text-slate-400">κa = {num(o.kappa_a).toFixed(4)}</span>
        </div>
        <Bar value={num(o.transmission)} label="Transmission T" tone="cyan" />
        <Bar value={num(o.reflection)} label="Reflection R" tone="amber" />
      </div>
    ),
  },
  {
    name: 'double_slit_intensity',
    title: 'Double-slit intensity',
    summary: 'Fraunhofer fringe I/I₀ at screen position y.',
    fields: [
      { name: 'y_mm', label: 'Screen y', type: 'number', default: 0.5, step: 0.05, unit: 'mm' },
      { name: 'slit_separation_um', label: 'Slit sep d', type: 'number', default: 100, min: 0.1, step: 5, unit: 'µm' },
      { name: 'wavelength_nm', label: 'Wavelength λ', type: 'number', default: 633, min: 1, step: 1, unit: 'nm' },
      { name: 'screen_distance_mm', label: 'Distance L', type: 'number', default: 1000, min: 1, step: 10, unit: 'mm' },
    ],
    localCompute: (inputs) => {
      const intensity = doubleSlitIntensity(
        num(inputs.y_mm),
        num(inputs.slit_separation_um),
        num(inputs.wavelength_nm),
        num(inputs.screen_distance_mm)
      );
      return {
        structured: { intensity },
        text: `Intensity I/I₀ = ${intensity.toFixed(4)}`,
      };
    },
    visualize: (o) => (
      <div className="space-y-2">
        <Bar value={num(o.intensity)} label="Normalized intensity I/I₀" tone="violet" />
        <p className="font-mono text-[11px] text-slate-500">cos²(πd sinθ / λ)</p>
      </div>
    ),
  },
  {
    name: 'born_probabilities',
    title: 'Born-rule probabilities',
    summary: 'p(0), p(1) for |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩.',
    fields: [
      { name: 'theta_rad', label: 'Polar θ', type: 'number', default: Math.PI / 3, step: 0.05, unit: 'rad' },
    ],
    localCompute: (inputs) => {
      const res = bornProbabilities(num(inputs.theta_rad));
      return {
        structured: { ...res },
        text: `p(0) = ${res.p0.toFixed(4)}, p(1) = ${res.p1.toFixed(4)}`,
      };
    },
    visualize: (o) => (
      <div className="space-y-3">
        <Bar value={num(o.p0)} label="p(0)" tone="cyan" />
        <Bar value={num(o.p1)} label="p(1)" tone="violet" />
      </div>
    ),
  },
  {
    name: 'teleportation_fidelity',
    title: 'Teleportation fidelity',
    summary: 'F for a Werner Bell pair with decoherence d, plus concurrence.',
    fields: [
      { name: 'bell_purity', label: 'Bell purity p', type: 'number', default: 0.9, min: 0, max: 1, step: 0.01 },
      { name: 'decoherence', label: 'Decoherence d', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01 },
    ],
    localCompute: (inputs) => {
      const fidelity = teleportationFidelity(num(inputs.bell_purity), num(inputs.decoherence));
      const concurrence = wernerConcurrence(num(inputs.bell_purity));
      return {
        structured: { fidelity, concurrence, entangled: concurrence > 0 },
        text: `Fidelity F = ${fidelity.toFixed(4)}, Concurrence C = ${concurrence.toFixed(4)}`,
      };
    },
    visualize: (o) => (
      <div className="space-y-3">
        <Bar value={num(o.fidelity)} label="Fidelity F" tone="cyan" />
        <Bar value={num(o.concurrence)} label="Concurrence C" tone="violet" />
        <div className="font-mono text-[11px] text-slate-400">
          entangled: <span className={o.entangled ? 'text-emerald-300' : 'text-rose-300'}>{String(o.entangled)}</span>
        </div>
      </div>
    ),
  },
  {
    name: 'pauli_correction',
    title: 'Pauli correction (m₁ m₂)',
    summary: 'Bell-basis bits → Bob’s Pauli operator.',
    fields: [
      { name: 'm1', label: 'm₁', type: 'bit', default: 0 },
      { name: 'm2', label: 'm₂', type: 'bit', default: 1 },
    ],
    localCompute: (inputs) => {
      const m1 = num(inputs.m1) === 1 ? 1 : 0;
      const m2 = num(inputs.m2) === 1 ? 1 : 0;
      const ops = ['I (Identity)', 'X (Bit flip)', 'Z (Phase flip)', 'ZX / -iY (Bit + phase flip)'];
      const symbols = ['I', 'X', 'Z', 'ZX'];
      const idx = m1 * 2 + m2;
      return {
        structured: { operator: symbols[idx], bits: `${m1}${m2}`, description: ops[idx] },
        text: `Operator: ${symbols[idx]} for bits ${m1}${m2}`,
      };
    },
    visualize: (o) => (
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 font-mono text-2xl text-cyan-100">
          {str(o.operator)}
        </div>
        <div className="text-sm text-slate-300">
          <div className="font-mono text-xs text-slate-500">bits {str(o.bits)}</div>
          {str(o.description)}
        </div>
      </div>
    ),
  },
];

export function PhysicsToolRunner() {
  const [selected, setSelected] = useState(TOOLS[0].name);
  const tool = useMemo(() => TOOLS.find((t) => t.name === selected)!, [selected]);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(tool.fields.map((f) => [f.name, f.default as number])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ structured: Record<string, unknown> | null; text: string } | null>(null);

  function pick(name: string) {
    const next = TOOLS.find((t) => t.name === name)!;
    setSelected(name);
    setValues(Object.fromEntries(next.fields.map((f) => [f.name, f.default as number])));
    setResult(null);
    setError(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Try remote Supabase edge function invocation
      const res = await fetch(`${MCP_URL}/.mcp/invoke-tool/${tool.name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        const data = await res.json();
        type ContentItem = { type?: string; text?: string };
        const text = Array.isArray(data?.content)
          ? (data.content as ContentItem[])
              .filter((c) => c?.type === 'text')
              .map((c) => c.text ?? '')
              .join('\n')
          : '';
        const structured =
          data?.structuredContent && typeof data.structuredContent === 'object'
            ? (data.structuredContent as Record<string, unknown>)
            : null;
        setResult({ structured, text });
      } else {
        // Fallback to local analytical compute
        if (tool.localCompute) {
          const localRes = tool.localCompute(values);
          setResult(localRes);
        } else {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
      }
    } catch (e) {
      if (tool.localCompute) {
        const localRes = tool.localCompute(values);
        setResult(localRes);
      } else {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-2xl shadow-cyan-500/5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-cyan-300" />
          <h2 className="font-serif text-xl text-slate-100">Run physics tool</h2>
          <Badge variant="outline" className="border-slate-700 bg-slate-900/60 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            MCP · live
          </Badge>
        </div>
        <p className="max-w-md text-xs text-slate-400">
          Direct calls to the app's MCP tools. Pick a function, set inputs, and visualize the analytic output.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {TOOLS.map((t) => {
          const active = t.name === selected;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => pick(t.name)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
                active
                  ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
                  : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {t.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
          <div className="mb-3">
            <div className="font-serif text-base text-slate-100">{tool.title}</div>
            <p className="text-xs text-slate-400">{tool.summary}</p>
          </div>
          <div className="space-y-3">
            {tool.fields.map((f) => (
              <label key={f.name} className="block">
                <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-widest text-slate-400">
                  <span>{f.label}</span>
                  <span className="text-slate-500">{f.unit ?? (f.type === 'bit' ? 'bit' : '')}</span>
                </div>
                {f.type === 'bit' ? (
                  <div className="flex gap-2">
                    {[0, 1].map((b) => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setValues((v) => ({ ...v, [f.name]: b }))}
                        className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm ${
                          values[f.name] === b
                            ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="number"
                    value={values[f.name]}
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 'any'}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-sm text-slate-100 focus:border-cyan-400/60 focus:outline-none"
                  />
                )}
                {f.hint && <p className="mt-1 text-[11px] text-slate-500">{f.hint}</p>}
              </label>
            ))}
          </div>
          <Button onClick={run} disabled={loading} className="mt-4 w-full gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? 'Invoking…' : 'Invoke tool'}
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-cyan-300" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Output</span>
          </div>
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 font-mono text-xs text-rose-200">{error}</div>
          )}
          {!error && !result && (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-xs text-slate-500">
              Set inputs and invoke the tool to see structured output.
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                {result.structured ? tool.visualize(result.structured) : <span className="text-xs text-slate-400">No structured output.</span>}
              </div>
              {result.text && (
                <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-[11px] text-slate-300">
{result.text}
                </pre>
              )}
              {result.structured && (
                <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-[11px] text-slate-400">
{JSON.stringify(result.structured, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PhysicsToolRunner;