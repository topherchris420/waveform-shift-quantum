import React from 'react';
import { Link2 } from 'lucide-react';

export interface BellRecord {
  id: number;
  t: number;
  bits: [0 | 1, 0 | 1];
  mode: string;
  fidelity: number;
}

interface EntanglementOverlayProps {
  history: BellRecord[];
  concurrence: number;
  purity: number;
  zz: number;
  compact?: boolean;
}

const pairLabel = (b: [0 | 1, 0 | 1]) => `|${b[0]}${b[1]}⟩`;
const correctionFor = (b: [0 | 1, 0 | 1]) => {
  const z = b[0] ? 'Z' : 'I';
  const x = b[1] ? 'X' : 'I';
  if (z === 'I' && x === 'I') return 'I';
  if (z === 'I') return x;
  if (x === 'I') return z;
  return `${x}${z}`;
};

export const EntanglementOverlay: React.FC<EntanglementOverlayProps> = ({
  history,
  concurrence,
  purity,
  zz,
  compact = false,
}) => {
  const latest = history[history.length - 1];
  const recent = history.slice(-6).reverse();
  const entangled = concurrence > 0;
  const bar = (v: number, negative = false) => {
    const clamped = Math.max(-1, Math.min(1, v));
    const pct = negative ? ((clamped + 1) / 2) * 100 : Math.max(0, clamped) * 100;
    return `${pct.toFixed(1)}%`;
  };

  return (
    <div
      className={`rounded-md border border-violet/30 bg-black/55 ${compact ? 'p-2 text-[11px]' : 'p-3 text-xs'} shadow-lg shadow-black/40 backdrop-blur-md`}
      role="region"
      aria-label="Entanglement diagnostics"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-violet-foreground">
          <Link2 className="h-3.5 w-3.5" />
          <span className="section-eyebrow">Entanglement link</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            entangled
              ? 'border-violet/40 bg-violet/[0.15] text-violet-foreground'
              : 'border-white/15 bg-white/[0.05] text-muted-foreground'
          }`}
        >
          {entangled ? 'coupled' : 'separable'}
        </span>
      </div>

      <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <MetricLine label="C(ρ)" value={concurrence.toFixed(3)} />
        <MetricLine label="⟨ZZ⟩" value={zz.toFixed(3)} />
        {!compact && <MetricLine label="Purity p" value={purity.toFixed(3)} />}
      </div>

      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-violet to-primary transition-[width] duration-500"
            style={{ width: bar(concurrence) }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>separable</span>
          <span>|Φ⁺⟩</span>
        </div>
      </div>

      {latest && (
        <div className="mt-3 rounded border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-foreground">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>last outcome</span>
            <span className="text-copper">t = {latest.t.toFixed(2)}s</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>
              m₁m₂ = <span className="text-primary">{latest.bits[0]}{latest.bits[1]}</span> · {pairLabel(latest.bits)}
            </span>
            <span className="text-lime-foreground">→ {correctionFor(latest.bits)}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            F = <span className="text-foreground">{latest.fidelity.toFixed(4)}</span> · mode {latest.mode}
          </div>
        </div>
      )}

      {!compact && recent.length > 0 && (
        <div className="mt-3">
          <p className="section-eyebrow mb-1">Recent Bell outcomes</p>
          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
            {recent.map((r) => (
              <span
                key={r.id}
                className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-foreground"
                title={`${r.mode} · F=${r.fidelity.toFixed(3)}`}
              >
                {r.bits[0]}{r.bits[1]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-white/10 bg-white/[0.02] px-2 py-1">
    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-0.5 font-mono text-[13px] text-foreground">{value}</p>
  </div>
);