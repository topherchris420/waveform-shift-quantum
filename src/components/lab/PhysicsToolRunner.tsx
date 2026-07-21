import { useMemo, useState } from 'react';
import { Loader2, Play, Terminal, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type FieldType = 'number' | 'bit';

interface ToolField {
  name: string;
  label: string;
  type: FieldType;
  default: number;
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
  visualize: (out: any) => React.ReactNode;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
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
    name: 'barrier_transmission',
    title: '1D barrier transmission',
    summary: 'Rectangular potential barrier T(E, V, a). Tunneling, resonant, or oscillatory.',
    fields: [
      { name: 'energy_eV', label: 'Energy E', type: 'number', default: 1.0, min: 0.001, step: 0.05, unit: 'eV' },
      { name: 'barrier_eV', label: 'Barrier V', type: 'number', default: 2.0, min: 0.001, step: 0.05, unit: 'eV' },
      { name: 'width_nm', label: 'Width a', type: 'number', default: 0.5, min: 0.001, step: 0.05, unit: 'nm' },
    ],
    visualize: (o) => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200">regime: {o.regime}</Badge>
          <span className="font-mono text-xs text-slate-400">κa = {Number(o.kappa_a).toFixed(4)}</span>
        </div>
        <Bar value={o.transmission} label="Transmission T" tone="cyan" />
        <Bar value={o.reflection} label="Reflection R" tone="amber" />
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
    visualize: (o) => (
      <div className="space-y-2">
        <Bar value={o.intensity} label="Normalized intensity I/I₀" tone="violet" />
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
    visualize: (o) => (
      <div className="space-y-3">
        <Bar value={o.p0} label="p(0)" tone="cyan" />
        <Bar value={o.p1} label="p(1)" tone="violet" />
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
    visualize: (o) => (
      <div className="space-y-3">
        <Bar value={o.fidelity} label="Fidelity F" tone="cyan" />
        <Bar value={o.concurrence} label="Concurrence C" tone="violet" />
        <div className="font-mono text-[11px] text-slate-400">
          entangled: <span className={o.entangled ? 'text-emerald-300' : 'text-rose-300'}>{String(o.entangled)}</span>
        </div>
      </div>
    ),
  },
  {
    name: 'pauli_correction',
    title: 'Pauli correction (m₁ m₂)',
    summary: 'Bell-basis bits → Bob\u2019s Pauli operator.',
    fields: [
      { name: 'm1', label: 'm₁', type: 'bit', default: 0 },
      { name: 'm2', label: 'm₂', type: 'bit', default: 1 },
    ],
    visualize: (o) => (
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 font-mono text-2xl text-cyan-100">
          {o.operator}
        </div>
        <div className="text-sm text-slate-300">
          <div className="font-mono text-xs text-slate-500">bits {o.bits}</div>
          {o.description}
        </div>
      </div>
    ),
  },
];

export function PhysicsToolRunner() {
  const [selected, setSelected] = useState(TOOLS[0].name);
  const tool = useMemo(() => TOOLS.find((t) => t.name === selected)!, [selected]);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(tool.fields.map((f) => [f.name, f.default])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ structured: any; text: string } | null>(null);

  function pick(name: string) {
    const next = TOOLS.find((t) => t.name === name)!;
    setSelected(name);
    setValues(Object.fromEntries(next.fields.map((f) => [f.name, f.default])));
    setResult(null);
    setError(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${MCP_URL}/.mcp/invoke-tool/${tool.name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = Array.isArray(data?.content)
        ? data.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('\n')
        : '';
      setResult({ structured: data?.structuredContent ?? null, text });
    } catch (e: any) {
      setError(e?.message ?? String(e));
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