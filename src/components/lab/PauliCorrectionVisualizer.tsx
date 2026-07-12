import React, { useEffect, useState } from 'react';
import type { TeleportStep } from './TeleportationCircuit';

interface PauliCorrectionVisualizerProps {
  step: TeleportStep;
  bits?: [0 | 1, 0 | 1];
}

type PauliKey = 'I' | 'X' | 'Z' | 'XZ';

interface PauliInfo {
  key: PauliKey;
  bits: string;
  label: string;
  matrix: [[string, string], [string, string]];
  action: string;
  tint: string;
  preState: string;   // Bob's qubit state before correction
  postState: string;  // after applying U
}

const PAULIS: PauliInfo[] = [
  {
    key: 'I',
    bits: '00',
    label: 'Identity',
    matrix: [['1', '0'], ['0', '1']],
    action: 'no correction — state already matches |ψ⟩',
    tint: 'hsl(var(--foreground) / 0.6)',
    preState: 'α|0⟩ + β|1⟩',
    postState: 'α|0⟩ + β|1⟩',
  },
  {
    key: 'X',
    bits: '01',
    label: 'Pauli-X (bit flip)',
    matrix: [['0', '1'], ['1', '0']],
    action: 'flip |0⟩ ↔ |1⟩ on qubit C',
    tint: 'hsl(var(--primary))',
    preState: 'β|0⟩ + α|1⟩',
    postState: 'α|0⟩ + β|1⟩',
  },
  {
    key: 'Z',
    bits: '10',
    label: 'Pauli-Z (phase flip)',
    matrix: [['1', '0'], ['0', '-1']],
    action: 'apply π phase to |1⟩ component',
    tint: 'hsl(var(--copper))',
    preState: 'α|0⟩ − β|1⟩',
    postState: 'α|0⟩ + β|1⟩',
  },
  {
    key: 'XZ',
    bits: '11',
    label: 'X·Z (iY up to phase)',
    matrix: [['0', '-1'], ['1', '0']],
    action: 'bit flip followed by phase flip',
    tint: 'hsl(var(--violet))',
    preState: '−β|0⟩ + α|1⟩',
    postState: 'α|0⟩ + β|1⟩',
  },
];

const STEPS: { id: TeleportStep; title: string; detail: string }[] = [
  { id: 1, title: 'Bell prep', detail: 'H on B, CNOT B→C → shared |Φ⁺⟩ between Alice and Bob.' },
  { id: 2, title: 'Entangle |ψ⟩', detail: 'CNOT A→B then H on A entangles the unknown state with the pair.' },
  { id: 3, title: 'Bell measurement', detail: 'Project (A, B) onto the Bell basis, yielding 2 classical bits m₁m₂.' },
  { id: 4, title: 'Pauli correction', detail: 'Bob applies X^{m₂} Z^{m₁} on C to reconstruct |ψ⟩.' },
];

const bitsKey = (bits?: [0 | 1, 0 | 1]): PauliKey | null => {
  if (!bits) return null;
  const s = `${bits[0]}${bits[1]}`;
  const match = PAULIS.find((p) => p.bits === s);
  return match ? match.key : null;
};

export const PauliCorrectionVisualizer: React.FC<PauliCorrectionVisualizerProps> = ({ step, bits }) => {
  const selectedKey = bitsKey(bits);
  const revealed = step >= 3; // outcome known
  const applied = step >= 4;  // correction applied
  const selected = PAULIS.find((p) => p.key === selectedKey);

  // Trigger a brief transition whenever the applied correction changes.
  const runKey = `${selectedKey ?? 'none'}-${applied ? '1' : '0'}`;
  const [phase, setPhase] = useState<'idle' | 'run'>('idle');
  useEffect(() => {
    if (!applied || !selected) {
      setPhase('idle');
      return;
    }
    setPhase('idle');
    const raf = requestAnimationFrame(() => setPhase('run'));
    return () => cancelAnimationFrame(raf);
  }, [runKey, applied, selected]);

  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between">
        <p className="section-eyebrow">Pauli correction</p>
        <span className="font-mono text-[10px] text-muted-foreground">
          U_c = X<sup>m₂</sup> Z<sup>m₁</sup>
        </span>
      </div>

      {/* Step ladder */}
      <ol className="mt-3 space-y-1.5" aria-label="Protocol steps">
        {STEPS.map((s) => {
          const state = step > s.id ? 'done' : step === s.id ? 'active' : 'pending';
          const dot =
            state === 'active'
              ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse'
              : state === 'done'
              ? 'bg-lime'
              : 'bg-white/20';
          const text =
            state === 'pending' ? 'text-muted-foreground/60' : 'text-foreground';
          return (
            <li key={s.id} className="flex items-start gap-2 text-[11px]">
              <span className={`mt-1 h-2 w-2 flex-none rounded-full ${dot}`} aria-hidden />
              <div className={text}>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  step {s.id}
                </span>{' '}
                <span className="font-medium">{s.title}</span>
                <p className="text-[10.5px] leading-snug text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Operator lookup table */}
      <div className="mt-3">
        <div className="grid grid-cols-4 gap-1.5">
          {PAULIS.map((p) => {
            const isSelected = revealed && selectedKey === p.key;
            return (
              <div
                key={p.key}
                className={`rounded border px-1.5 py-1.5 text-center transition-all ${
                  isSelected
                    ? 'scale-[1.03] border-primary/70 bg-primary/[0.14] shadow-[0_0_18px_hsl(var(--primary)/0.35)]'
                    : 'border-white/10 bg-white/[0.02] opacity-70'
                }`}
                style={isSelected ? { borderColor: p.tint } : undefined}
                aria-current={isSelected ? 'true' : undefined}
              >
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {p.bits}
                </p>
                <p
                  className="mt-0.5 font-mono text-[15px] font-semibold"
                  style={{ color: isSelected ? p.tint : 'hsl(var(--foreground) / 0.55)' }}
                >
                  {p.key}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail card for the applied correction */}
      <div className="mt-3 min-h-[92px] rounded border border-white/10 bg-black/40 p-2.5 font-mono text-[11px]">
        {!revealed || !selected ? (
          <p className="text-muted-foreground">
            Awaiting Bell measurement on (A, B) — the outcome m₁m₂ selects one of the four Pauli operators above.
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <MatrixSVG matrix={selected.matrix} tint={selected.tint} applied={applied} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  m₁m₂ = {bits?.[0]}{bits?.[1]}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-wider ${
                    applied
                      ? 'border-lime/40 bg-lime/[0.12] text-lime-foreground'
                      : 'border-copper/40 bg-copper/[0.12] text-copper'
                  }`}
                >
                  {applied ? 'applied' : 'pending'}
                </span>
              </div>
              <p className="mt-1 text-foreground" style={{ color: selected.tint }}>
                {selected.label}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                {selected.action}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* State-vector transformation animation */}
      <div
        key={runKey}
        className="mt-3 overflow-hidden rounded border border-white/10 bg-black/40 p-2.5"
        aria-live="polite"
      >
        <div className="flex items-center justify-between">
          <p className="section-eyebrow">State transformation</p>
          <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
            |ψ_pre⟩ → U|ψ_pre⟩ = |ψ⟩
          </span>
        </div>

        {!revealed || !selected ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Bob's qubit C waits in one of four possible states — the measurement selects U and reconstructs |ψ⟩.
          </p>
        ) : (
          <div
            className="relative mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2"
            style={{ minHeight: 54 }}
          >
            {/* Pre state */}
            <div
              className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 transition-all duration-500"
              style={{
                opacity: phase === 'run' && applied ? 0.55 : 1,
                transform: phase === 'run' && applied ? 'translateX(-4px)' : 'translateX(0)',
                borderColor: applied ? undefined : selected.tint,
              }}
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                |ψ_pre⟩ on C
              </p>
              <p className="mt-0.5 font-mono text-[13px] text-foreground">{selected.preState}</p>
            </div>

            {/* Operator moving along the wire */}
            <div className="relative flex h-[42px] w-16 items-center justify-center">
              <span
                aria-hidden
                className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
                style={{ background: `linear-gradient(90deg, transparent, ${selected.tint}, transparent)` }}
              />
              <span
                className="relative z-10 inline-flex h-7 min-w-7 items-center justify-center rounded border px-1.5 font-mono text-[12px] font-semibold transition-all duration-500 ease-out"
                style={{
                  color: selected.tint,
                  borderColor: selected.tint,
                  background: 'hsl(var(--background) / 0.9)',
                  transform:
                    phase === 'run' && applied
                      ? 'translateX(0) scale(1)'
                      : applied
                      ? 'translateX(-22px) scale(0.92)'
                      : 'translateX(0) scale(1)',
                  boxShadow:
                    phase === 'run' && applied
                      ? `0 0 18px ${selected.tint}`
                      : `0 0 0 transparent`,
                }}
              >
                {selected.key === 'XZ' ? 'X·Z' : selected.key}
              </span>
            </div>

            {/* Post state */}
            <div
              className="rounded border px-2 py-1.5 transition-all duration-500"
              style={{
                borderColor: applied && phase === 'run' ? selected.tint : 'hsl(var(--border) / 0.4)',
                background:
                  applied && phase === 'run'
                    ? `linear-gradient(135deg, ${selected.tint.replace(')', ' / 0.14)')}, transparent)`
                    : 'hsl(var(--foreground) / 0.02)',
                opacity: applied ? 1 : 0.5,
                transform: applied && phase === 'run' ? 'translateX(0) scale(1.02)' : 'translateX(4px) scale(1)',
                boxShadow:
                  applied && phase === 'run' ? `0 0 22px ${selected.tint.replace(')', ' / 0.35)')}` : 'none',
              }}
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                |ψ⟩ reconstructed
              </p>
              <p
                className="mt-0.5 font-mono text-[13px]"
                style={{ color: applied && phase === 'run' ? selected.tint : 'hsl(var(--foreground) / 0.75)' }}
              >
                {selected.postState}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MatrixSVG: React.FC<{ matrix: [[string, string], [string, string]]; tint: string; applied: boolean }> = ({
  matrix,
  tint,
  applied,
}) => (
  <svg viewBox="0 0 70 70" className="h-16 w-16 flex-none" role="img" aria-label="Pauli operator matrix">
    <path d="M6 6 L2 6 L2 64 L6 64" fill="none" stroke={tint} strokeWidth={1.2} />
    <path d="M64 6 L68 6 L68 64 L64 64" fill="none" stroke={tint} strokeWidth={1.2} />
    {matrix.flatMap((row, i) =>
      row.map((v, j) => (
        <text
          key={`${i}-${j}`}
          x={22 + j * 24}
          y={26 + i * 24}
          fontFamily="ui-monospace"
          fontSize="13"
          textAnchor="middle"
          fill={tint}
          opacity={applied ? 1 : 0.75}
        >
          {v}
        </text>
      )),
    )}
  </svg>
);