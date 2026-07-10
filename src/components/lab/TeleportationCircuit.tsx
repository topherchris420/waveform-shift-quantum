import React from 'react';

export type TeleportStep = 0 | 1 | 2 | 3 | 4;

interface TeleportationCircuitProps {
  step: TeleportStep; // 0 idle, 1 Bell prep, 2 CNOT+H, 3 measurement, 4 corrections
  bits?: [0 | 1, 0 | 1];
}

// Standard 3-qubit teleportation circuit (Bennett et al. 1993).
// Rows: |ψ⟩_A (input) ─────•──H──╱M
//       |0⟩_B  ─H─•───────⊕─────╱M
//       |0⟩_C  ───⊕──────────────X──Z── |ψ⟩
export const TeleportationCircuit: React.FC<TeleportationCircuitProps> = ({ step, bits }) => {
  const active = (s: TeleportStep) => step >= s;
  const wire = 'hsl(var(--foreground) / 0.45)';
  const on = 'hsl(var(--primary))';
  const off = 'hsl(var(--foreground) / 0.25)';

  return (
    <svg viewBox="0 0 420 150" role="img" aria-label="Quantum teleportation circuit" className="w-full">
      {/* Wires */}
      {[30, 75, 120].map((y, i) => (
        <line key={i} x1={40} y1={y} x2={400} y2={y} stroke={wire} strokeWidth={1.1} />
      ))}
      {/* Labels */}
      <text x={4} y={34} fontFamily="ui-monospace" fontSize="10" fill="hsl(var(--foreground))">|ψ⟩A</text>
      <text x={4} y={79} fontFamily="ui-monospace" fontSize="10" fill="hsl(var(--foreground))">|0⟩B</text>
      <text x={4} y={124} fontFamily="ui-monospace" fontSize="10" fill="hsl(var(--foreground))">|0⟩C</text>

      {/* Step 1: H on B, CNOT B→C (Bell prep) */}
      <g stroke={active(1) ? on : off} fill={active(1) ? on : 'transparent'}>
        <rect x={95} y={65} width={20} height={20} rx={2} strokeWidth={1.2} />
        <text x={98} y={80} fontFamily="ui-monospace" fontSize="12" fill={active(1) ? 'hsl(var(--primary-foreground))' : off}>H</text>
        <line x1={140} y1={75} x2={140} y2={120} strokeWidth={1.2} />
        <circle cx={140} cy={75} r={3.2} />
        <circle cx={140} cy={120} r={7} fill="none" strokeWidth={1.2} />
        <line x1={133} y1={120} x2={147} y2={120} strokeWidth={1.2} />
        <line x1={140} y1={113} x2={140} y2={127} strokeWidth={1.2} />
      </g>

      {/* Step 2: CNOT A→B, H on A */}
      <g stroke={active(2) ? on : off} fill={active(2) ? on : 'transparent'}>
        <line x1={190} y1={30} x2={190} y2={75} strokeWidth={1.2} />
        <circle cx={190} cy={30} r={3.2} />
        <circle cx={190} cy={75} r={7} fill="none" strokeWidth={1.2} />
        <line x1={183} y1={75} x2={197} y2={75} strokeWidth={1.2} />
        <line x1={190} y1={68} x2={190} y2={82} strokeWidth={1.2} />
        <rect x={215} y={20} width={20} height={20} rx={2} strokeWidth={1.2} />
        <text x={218} y={35} fontFamily="ui-monospace" fontSize="12" fill={active(2) ? 'hsl(var(--primary-foreground))' : off}>H</text>
      </g>

      {/* Step 3: measurements */}
      <g stroke={active(3) ? on : off}>
        <rect x={260} y={20} width={22} height={20} rx={2} fill={active(3) ? 'hsl(var(--copper) / 0.28)' : 'transparent'} strokeWidth={1.1} />
        <path d={`M263 36 Q271 22 279 36`} fill="none" stroke={active(3) ? 'hsl(var(--copper))' : off} strokeWidth={1.1} />
        <line x1={271} y1={36} x2={278} y2={26} stroke={active(3) ? 'hsl(var(--copper))' : off} strokeWidth={1.1} />
        <rect x={260} y={65} width={22} height={20} rx={2} fill={active(3) ? 'hsl(var(--copper) / 0.28)' : 'transparent'} strokeWidth={1.1} />
        <path d={`M263 81 Q271 67 279 81`} fill="none" stroke={active(3) ? 'hsl(var(--copper))' : off} strokeWidth={1.1} />
        <line x1={271} y1={81} x2={278} y2={71} stroke={active(3) ? 'hsl(var(--copper))' : off} strokeWidth={1.1} />
        {/* classical channels */}
        <line x1={282} y1={30} x2={340} y2={30} stroke={active(4) ? on : off} strokeDasharray="3 3" />
        <line x1={282} y1={75} x2={340} y2={75} stroke={active(4) ? on : off} strokeDasharray="3 3" />
      </g>

      {/* Step 4: conditional X, Z on C */}
      <g stroke={active(4) ? on : off} fill={active(4) ? on : 'transparent'}>
        <rect x={330} y={110} width={22} height={20} rx={2} strokeWidth={1.2} />
        <text x={335} y={125} fontFamily="ui-monospace" fontSize="12" fill={active(4) ? 'hsl(var(--primary-foreground))' : off}>X</text>
        <rect x={362} y={110} width={22} height={20} rx={2} strokeWidth={1.2} />
        <text x={367} y={125} fontFamily="ui-monospace" fontSize="12" fill={active(4) ? 'hsl(var(--primary-foreground))' : off}>Z</text>
      </g>

      {bits && step >= 3 && (
        <text x={290} y={54} fontFamily="ui-monospace" fontSize="10" fill="hsl(var(--copper))">
          m₁m₂ = {bits[0]}{bits[1]}
        </text>
      )}
    </svg>
  );
};
