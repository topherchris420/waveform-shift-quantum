// Unit and dimension declarations for executable physics protocols.
//
// A number in this laboratory is only as meaningful as the unit it carries.
// The Reality Split engine and the experiment workbench integrate the
// Schrödinger equation with ħ = 1 and bare energies of order one: they run in
// SIMULATION UNITS. Nothing in the proposed model fixes the energy scale ε₀, the
// physical identity of the scalar field φ, or the normalisation of the coupling
// g, so none of those quantities is calibrated. This module makes that explicit
// and machine-checkable instead of leaving it to prose.
//
// Dimensions are tracked as exponent vectors over four base symbols:
//
//   E — energy
//   T — time
//   L — length
//   F — the scalar field φ's own dimension. The model never identifies φ with a
//       physical field, so F is a free symbol: dimensional analysis can say what
//       [g] must be RELATIVE to [φ], but not what either is in SI.
//
// ħ has dimension E·T. Only the product gφ is fixed (it is an energy, because it
// is added to the Hamiltonian diagonal); g and φ separately are underspecified.

export type DimensionBase = 'E' | 'T' | 'L' | 'F';
export type Dimension = Readonly<Partial<Record<DimensionBase, number>>>;

const BASES: DimensionBase[] = ['E', 'T', 'L', 'F'];

export const DIMENSIONLESS: Dimension = {};

function normalize(d: Partial<Record<DimensionBase, number>>): Dimension {
  const out: Partial<Record<DimensionBase, number>> = {};
  for (const base of BASES) {
    const exponent = d[base] ?? 0;
    if (exponent !== 0) out[base] = exponent;
  }
  return out;
}

export function dimMul(a: Dimension, b: Dimension): Dimension {
  const out: Partial<Record<DimensionBase, number>> = {};
  for (const base of BASES) out[base] = (a[base] ?? 0) + (b[base] ?? 0);
  return normalize(out);
}

export function dimPow(a: Dimension, n: number): Dimension {
  const out: Partial<Record<DimensionBase, number>> = {};
  for (const base of BASES) out[base] = (a[base] ?? 0) * n;
  return normalize(out);
}

export function dimEquals(a: Dimension, b: Dimension): boolean {
  return BASES.every((base) => (a[base] ?? 0) === (b[base] ?? 0));
}

/** Human-readable dimension, e.g. "E·F⁻¹" or "1" for dimensionless. */
export function formatDimension(d: Dimension): string {
  const sup: Record<string, string> = { '-': '⁻', '1': '¹', '2': '²', '3': '³', '4': '⁴' };
  const parts = BASES.filter((b) => (d[b] ?? 0) !== 0).map((b) => {
    const e = d[b] as number;
    if (e === 1) return b;
    return `${b}${String(e)
      .split('')
      .map((c) => sup[c] ?? c)
      .join('')}`;
  });
  return parts.length ? parts.join('·') : '1';
}

/**
 * ħ in eV·s (h/2π with h and e fixed by the 2019 SI; truncated to 10 digits).
 * Used only to state what a simulation time unit WOULD be under a chosen energy
 * scale. Choosing ε₀ is a convention, never a calibration.
 */
export const HBAR_EV_S = 6.582119569e-16;

export type UnitSystem =
  | {
      kind: 'dimensionless';
      hbar: 1;
      /** Label of the arbitrary energy scale every energy is expressed in. */
      energyUnit: 'ε₀';
      /** Time is measured in ħ/ε₀. It is never seconds. */
      timeUnit: 'ħ/ε₀';
      /** Spatial coordinates, where used, are normalised to the sample half-width. */
      lengthUnit: 'sample half-width';
      description: string;
    }
  | {
      kind: 'physical';
      energy: 'eV';
      time: 's';
      hbar: number;
      description: string;
    };

/**
 * How much physical meaning a declared quantity's numerical value carries.
 *
 * simulation_value — a number in the protocol's simulation units. Internally
 *                    consistent; no laboratory calibration exists.
 * derived          — fixed by other declared quantities (e.g. Ω from δ and Δ).
 * calibrated       — tied to a measurement; must name its calibration source.
 * underspecified   — the model does not determine this quantity's physical
 *                    units or normalisation. Reported, never concealed.
 */
export type CalibrationStatus = 'simulation_value' | 'derived' | 'calibrated' | 'underspecified';

export interface QuantityDeclaration {
  symbol: string;
  name: string;
  /** Key in RealitySplitParams / ExperimentSpec / PROTOCOL, when it has one. */
  codeKey?: string;
  /** Dimension implied by the quantity's role in the equations. */
  dimension: Dimension;
  /** Unit label under this protocol's unit system. */
  simulationUnit: string;
  calibration: CalibrationStatus;
  /** Required when calibration === 'calibrated'. */
  calibrationSource?: string;
  /** Where the quantity enters the equations. */
  role: string;
  note: string;
}

/** A term is a product of declared symbols raised to integer powers. */
export type DimensionTerm = ReadonlyArray<readonly [symbol: string, exponent: number]>;

/**
 * An equation-level requirement: every listed term must carry the same
 * dimension (e.g. E_A and gφ_A are summed on the Hamiltonian diagonal).
 * An empty term stands for a pure number.
 */
export interface DimensionalConstraint {
  id: string;
  statement: string;
  terms: DimensionTerm[];
}

export interface UnitDeclaration {
  id: string;
  system: UnitSystem;
  quantities: QuantityDeclaration[];
  constraints: DimensionalConstraint[];
  /** Plain statements of what the model leaves undetermined. */
  underspecified: string[];
}

export const SIMULATION_UNITS: UnitSystem = {
  kind: 'dimensionless',
  hbar: 1,
  energyUnit: 'ε₀',
  timeUnit: 'ħ/ε₀',
  lengthUnit: 'sample half-width',
  description:
    'Simulation units with ħ = 1. Energies are multiples of an arbitrary scale ε₀ that the model does not fix; times are multiples of ħ/ε₀. Choosing ε₀ = 1 eV would make the time unit ≈ 0.658 fs, but that is a convention, not a calibration.',
};

const E: Dimension = { E: 1 };
const T: Dimension = { T: 1 };
const F: Dimension = { F: 1 };
const PER_T: Dimension = { T: -1 };

/** Two-site sector: the quantities the Reality Split engine actually integrates. */
export const TWO_SITE_UNITS: UnitDeclaration = {
  id: 'two-site-simulation-units.v1',
  system: SIMULATION_UNITS,
  quantities: [
    {
      symbol: 'E_A',
      name: 'Bare site-A energy',
      codeKey: 'EA',
      dimension: E,
      simulationUnit: 'ε₀',
      calibration: 'simulation_value',
      role: 'Hamiltonian diagonal H₁₁ = E_A + gφ_A(t)',
      note: 'Value 1 in the protocol. Only E_B − E_A affects populations.',
    },
    {
      symbol: 'E_B',
      name: 'Bare site-B energy',
      codeKey: 'EB',
      dimension: E,
      simulationUnit: 'ε₀',
      calibration: 'simulation_value',
      role: 'Hamiltonian diagonal H₂₂ = E_B + gφ_B(t)',
      note: 'Value 1 in the protocol (resonant sites).',
    },
    {
      symbol: 'Δ',
      name: 'Inter-site mixing (tunnelling) amplitude',
      codeKey: 'delta',
      dimension: E,
      simulationUnit: 'ε₀',
      calibration: 'simulation_value',
      role: 'Hamiltonian off-diagonal H₁₂ = H₂₁ = Δ (real)',
      note: 'Sets the bare Rabi frequency 2Δ/ħ.',
    },
    {
      symbol: 'φ_A',
      name: 'Scalar field at site A',
      codeKey: 'phiA',
      dimension: F,
      simulationUnit: 'φ-unit (unidentified)',
      calibration: 'underspecified',
      role: 'Enters only through the product gφ_A',
      note: 'φ is not identified with any physical field, so its unit and normalisation are undetermined.',
    },
    {
      symbol: 'φ_B',
      name: 'Scalar field at site B',
      codeKey: 'phiB',
      dimension: F,
      simulationUnit: 'φ-unit (unidentified)',
      calibration: 'underspecified',
      role: 'Enters only through the product gφ_B',
      note: 'As φ_A.',
    },
    {
      symbol: 'a',
      name: 'Antisymmetric drive amplitude',
      codeKey: 'driveAmplitude',
      dimension: F,
      simulationUnit: 'φ-unit (unidentified)',
      calibration: 'underspecified',
      role: 'φ_A(t) = φ_A + a sin ωt, φ_B(t) = φ_B − a sin ωt',
      note: 'A field amplitude, so it inherits φ’s undetermined unit.',
    },
    {
      symbol: 'g',
      name: 'Matter–scalar coupling',
      codeKey: 'g',
      dimension: { E: 1, F: -1 },
      simulationUnit: 'ε₀ per φ-unit',
      calibration: 'underspecified',
      role: 'Diagonal energy shift gφ',
      note: 'Only gφ (an energy) is fixed. g has dimension E/[φ]; with φ unidentified, g cannot be mapped to SI or compared with any laboratory bound.',
    },
    {
      symbol: 'ω',
      name: 'Drive angular frequency',
      codeKey: 'driveOmega',
      dimension: PER_T,
      simulationUnit: 'ε₀/ħ',
      calibration: 'simulation_value',
      role: 'Argument of sin ωt',
      note: 'Value 1.5 in the protocol.',
    },
    {
      symbol: 't',
      name: 'Time / duration',
      codeKey: 'duration',
      dimension: T,
      simulationUnit: 'ħ/ε₀',
      calibration: 'simulation_value',
      role: 'Evolution time',
      note: 'Never seconds. Value 12 in the protocol.',
    },
    {
      symbol: 'dt',
      name: 'Integration timestep',
      codeKey: 'dt',
      dimension: T,
      simulationUnit: 'ħ/ε₀',
      calibration: 'simulation_value',
      role: 'Step of the piecewise-constant propagator',
      note: 'A numerical parameter, not a physical one.',
    },
    {
      symbol: 'ħ',
      name: 'Reduced Planck constant',
      dimension: { E: 1, T: 1 },
      simulationUnit: '1',
      calibration: 'derived',
      role: 'U = exp(−iH dt/ħ)',
      note: 'Set to 1 by the choice of time unit ħ/ε₀.',
    },
  ],
  constraints: [
    {
      id: 'diagonal-energy',
      statement:
        'Every Hamiltonian entry is an energy: E_A and gφ_A are summed on the diagonal, the drive enters as g·a, and Δ is off-diagonal. So gφ must be an energy.',
      terms: [
        [['E_A', 1]],
        [
          ['g', 1],
          ['φ_A', 1],
        ],
        [
          ['g', 1],
          ['a', 1],
        ],
        [['Δ', 1]],
      ],
    },
    {
      id: 'propagator-phase',
      statement: 'The propagator exponent H·dt/ħ must be a pure number.',
      terms: [
        [
          ['Δ', 1],
          ['dt', 1],
          ['ħ', -1],
        ],
        [],
      ],
    },
    {
      id: 'drive-phase',
      statement: 'The drive phase ωt must be a pure number.',
      terms: [
        [
          ['ω', 1],
          ['t', 1],
        ],
        [],
      ],
    },
    {
      id: 'interferometric-phase',
      statement: 'The proposed interferometric phase (g/ħ)∫Δφ dt must be a pure number.',
      terms: [
        [
          ['g', 1],
          ['ħ', -1],
          ['φ_A', 1],
          ['t', 1],
        ],
        [],
      ],
    },
  ],
  underspecified: [
    'The energy scale ε₀ is not fixed by the model, so no simulated time maps to seconds.',
    'φ is not identified with a physical field; its unit [φ] and normalisation are undetermined.',
    'Only the product gφ is fixed (an energy). g alone has dimension ε₀/[φ] and cannot be compared with any laboratory constraint.',
    'No calibrated value exists for g, φ_A, φ_B or the drive amplitude.',
  ],
};

/** Localization-kernel sector (Paper Eq. 9–12), as rendered by realitySplit.ts. */
export const KERNEL_UNITS: UnitDeclaration = {
  id: 'localization-kernel-simulation-units.v1',
  system: SIMULATION_UNITS,
  quantities: [
    {
      symbol: 'ω₀',
      name: 'Baseline resonance',
      dimension: PER_T,
      simulationUnit: 'kernel frequency unit',
      calibration: 'underspecified',
      role: 'ω_loc = ω₀ + βφ + κ∇²φ',
      note: 'Value 10. No relation to the two-site scale ε₀/ħ is declared.',
    },
    {
      symbol: 'ω_w',
      name: 'External drive frequency',
      codeKey: 'omega_w',
      dimension: PER_T,
      simulationUnit: 'kernel frequency unit',
      calibration: 'underspecified',
      role: 'Lorentzian detuning ω_w − ω_loc',
      note: 'Same undeclared unit as ω₀.',
    },
    {
      symbol: 'Γ',
      name: 'Response linewidth',
      codeKey: 'gamma',
      dimension: PER_T,
      simulationUnit: 'kernel frequency unit',
      calibration: 'underspecified',
      role: 'L = (Γ/2)² / [(ω_w − ω_loc)² + (Γ/2)²]',
      note: 'Must be > 0. Same unit as ω₀.',
    },
    {
      symbol: 'β',
      name: 'Field coupling coefficient',
      dimension: { T: -1, F: -1 },
      simulationUnit: 'kernel frequency unit per φ-unit',
      calibration: 'underspecified',
      role: 'βφ term of ω_loc',
      note: 'Not a declared model parameter: 2.0 in the spatial kernel, 0.5 in compareModels.',
    },
    {
      symbol: 'κ',
      name: 'Field curvature coefficient',
      dimension: { T: -1, F: -1, L: 2 },
      simulationUnit: 'kernel frequency unit × (half-width)² per φ-unit',
      calibration: 'underspecified',
      role: 'κ∇²φ term of ω_loc',
      note: 'Not a declared model parameter: 0.15 in the spatial kernel, 0.1 in compareModels.',
    },
    {
      symbol: 'φ',
      name: 'Scalar field profile',
      dimension: F,
      simulationUnit: 'φ-unit (unidentified)',
      calibration: 'underspecified',
      role: 'φ(x) = φ̄ + (Δφ/2) tanh(x/w)',
      note: 'Same unidentified field as the two-site sector.',
    },
    {
      symbol: 'x',
      name: 'Position',
      dimension: { L: 1 },
      simulationUnit: 'sample half-width',
      calibration: 'underspecified',
      role: 'Spatial grid on [−1, 1]',
      note: 'No physical length is attached to the sample.',
    },
    {
      symbol: 'α',
      name: 'Response strength',
      codeKey: 'alpha',
      dimension: DIMENSIONLESS,
      simulationUnit: '1',
      calibration: 'simulation_value',
      role: 'χ = exp(αL)',
      note: 'Dimensionless by construction. The weak-response expansion assumes α ≲ 1.',
    },
  ],
  constraints: [
    {
      id: 'local-resonance',
      statement: 'ω₀, βφ and κ∇²φ are summed in ω_loc, so all must be frequencies.',
      terms: [
        [['ω₀', 1]],
        [
          ['β', 1],
          ['φ', 1],
        ],
        [
          ['κ', 1],
          ['φ', 1],
          ['x', -2],
        ],
        [['ω_w', 1]],
        [['Γ', 1]],
      ],
    },
    {
      id: 'kernel-exponent',
      statement: 'The kernel exponent αL must be a pure number (L is a ratio of squared frequencies).',
      terms: [[['α', 1]], []],
    },
  ],
  underspecified: [
    'The kernel frequency unit is not related to the two-site energy scale ε₀/ħ.',
    'β and κ are fixed constants in code, not declared model parameters, and two code paths use different values.',
    'Position is normalised to the sample half-width; no physical length is attached.',
  ],
};

/** Physical dimension of one term (a product of declared symbols). */
export function termDimension(
  declaration: UnitDeclaration,
  term: DimensionTerm
): Dimension | { missing: string } {
  let dim: Dimension = DIMENSIONLESS;
  for (const [symbol, exponent] of term) {
    const q = declaration.quantities.find((x) => x.symbol === symbol);
    if (!q) return { missing: symbol };
    dim = dimMul(dim, dimPow(q.dimension, exponent));
  }
  return dim;
}

/** Human-readable term, e.g. "g·φ_A". */
export function formatTerm(term: DimensionTerm): string {
  if (term.length === 0) return '1';
  return term.map(([s, e]) => (e === 1 ? s : `${s}^${e}`)).join('·');
}

/** Unit label for a protocol quantity, so the UI cannot drift from the declaration. */
export function unitFor(declaration: UnitDeclaration, codeKey: string): string {
  return declaration.quantities.find((q) => q.codeKey === codeKey)?.simulationUnit ?? '';
}
