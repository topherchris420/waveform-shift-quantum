// Research-model descriptors.
//
// A lightweight metadata layer around the physics functions — it does not
// re-implement them. Each descriptor states what a model assumes, which of
// those assumptions are actually encoded in code (versus stated only in prose),
// what its parameters mean and in which units, which invariants and limiting
// cases it must satisfy, what it lets one observe, and what would reject it.
//
// Every invariant and limiting case names the executed check that tests it, so
// the audit can refuse a claim that nothing verifies. The epistemic class reuses
// the existing taxonomy in ./epistemics.

import type { EpistemicClass } from './epistemics';
import { KERNEL_UNITS, TWO_SITE_UNITS, type UnitDeclaration } from './units';

export interface ParameterDescriptor {
  key: string;
  symbol: string;
  role: 'independent_variable' | 'protocol_constant' | 'free_constant';
  /** Inclusive bounds where the protocol or model restricts the value. */
  bounds?: { min: number; max: number; source: string };
  value?: number;
}

export interface ClaimLink {
  statement: string;
  /** Id of the executed VerificationResult that tests the claim. */
  checkId: string;
}

export interface FalsificationCondition {
  /**
   * internal_consistency — testable by simulation; failure falsifies the
   *                        implementation or an internal requirement only.
   * empirical            — requires measured data.
   */
  level: 'internal_consistency' | 'empirical';
  statement: string;
  /** Can it be executed today, with what exists? */
  operational: boolean;
  /** What is missing before it could be executed. */
  missing: string[];
}

export interface ResearchModelDescriptor {
  id: string;
  name: string;
  epistemicClass: EpistemicClass;
  equations: string[];
  /** Assumptions the code actually encodes. */
  assumptions: string[];
  /** Assumptions stated only in prose (paper, comments, UI); nothing enforces them. */
  proseOnlyAssumptions: string[];
  units: UnitDeclaration;
  parameters: ParameterDescriptor[];
  invariants: ClaimLink[];
  limitingCases: ClaimLink[];
  /** Ids in the observable registry (./observables). */
  observables: string[];
  falsificationConditions: FalsificationCondition[];
}

const SHARED_TWO_SITE_ASSUMPTIONS = [
  'Two-level truncation: only sites A and B exist',
  'Closed, unitary evolution: no decoherence, loss or measurement back-action',
  'Real, constant inter-site mixing Δ',
  'Initial state |A⟩',
  'ħ = 1 simulation units (energies in ε₀, time in ħ/ε₀)',
];

export const STANDARD_TWO_SITE: ResearchModelDescriptor = {
  id: 'standard-two-site-qm',
  name: 'Two-site tunnelling (standard quantum mechanics)',
  epistemicClass: 'established',
  equations: ['H = [[E_A, Δ], [Δ, E_B]]', 'P_B(t) = (4Δ²/Ω²) sin²(Ωt/2), Ω² = (E_B − E_A)² + 4Δ²'],
  assumptions: SHARED_TWO_SITE_ASSUMPTIONS,
  proseOnlyAssumptions: [],
  units: TWO_SITE_UNITS,
  parameters: [
    { key: 'EA', symbol: 'E_A', role: 'protocol_constant', value: 1 },
    { key: 'EB', symbol: 'E_B', role: 'protocol_constant', value: 1 },
    { key: 'delta', symbol: 'Δ', role: 'independent_variable', bounds: { min: 0.05, max: 1, source: 'workbench protocol' } },
  ],
  invariants: [{ statement: 'Norm is conserved', checkId: 'probability-conservation' }],
  limitingCases: [
    { statement: 'Static H follows the Rabi closed form exactly', checkId: 'baseline-rabi-closed-form' },
  ],
  observables: ['site-b-occupation', 'population-difference'],
  falsificationConditions: [],
};

export const WOODYARD_TWO_SITE: ResearchModelDescriptor = {
  id: 'woodyard-two-site-v1',
  name: 'Two-site matter–scalar coupling (Woodyard 2026, Sec. 4)',
  epistemicClass: 'proposed',
  equations: [
    'H(t) = [[E_A + gφ_A(t), Δ], [Δ, E_B + gφ_B(t)]]',
    'φ_A(t) = φ_A + a sin ωt,  φ_B(t) = φ_B − a sin ωt',
  ],
  assumptions: [
    ...SHARED_TWO_SITE_ASSUMPTIONS,
    'Coupling is linear and diagonal: gφ is added to each site energy',
    'φ is a prescribed external c-number: no field dynamics and no back-reaction of matter on φ',
    'φ is evaluated at two points only (site-local field values)',
    'The drive is antisymmetric between the sites (φ_A + φ_B is time-independent)',
    'The same g couples at both sites',
  ],
  proseOnlyAssumptions: [
    'φ is a physical scalar field ("matter–scalar coupling") — never identified with any known field',
    'g is a physical coupling constant — no normalisation, scale or calibration is given',
    'Energies are in eV (stated in earlier comments and UI labels; the executed protocol uses simulation units)',
    'The two-site model is a faithful reduction of the paper’s continuum localization theory',
    'The adiabatic ground-state occupation (twoSiteModel) describes what an experiment would prepare',
  ],
  units: TWO_SITE_UNITS,
  parameters: [
    { key: 'maxCoupling', symbol: 'g', role: 'independent_variable', bounds: { min: 0, max: 2, source: 'workbench protocol (swept from 0)' } },
    { key: 'fieldContrast', symbol: 'φ_B − φ_A', role: 'independent_variable', bounds: { min: 0, max: 2, source: 'workbench protocol' } },
    { key: 'delta', symbol: 'Δ', role: 'independent_variable', bounds: { min: 0.05, max: 1, source: 'workbench protocol' } },
    { key: 'driveAmplitude', symbol: 'a', role: 'independent_variable', bounds: { min: 0, max: 1, source: 'workbench protocol' } },
    { key: 'driveOmega', symbol: 'ω', role: 'protocol_constant', value: 1.5 },
    { key: 'EA', symbol: 'E_A', role: 'protocol_constant', value: 1 },
    { key: 'EB', symbol: 'E_B', role: 'protocol_constant', value: 1 },
  ],
  invariants: [
    { statement: 'Every step Hamiltonian is Hermitian', checkId: 'hamiltonian-hermiticity' },
    { statement: 'The step propagator is unitary', checkId: 'propagator-unitarity' },
    { statement: 'Norm is conserved in both branches', checkId: 'probability-conservation' },
    { statement: 'A uniform field acts as a pure global phase e^{−igcT}', checkId: 'uniform-field-global-phase' },
    { statement: 'Equations are dimensionally consistent', checkId: 'dimensions-two-site-simulation-units.v1' },
  ],
  limitingCases: [
    { statement: 'g → 0: proposed branch reduces exactly to established QM', checkId: 'g-zero-reduction' },
    { statement: 'φ_A = φ_B (static): no population effect', checkId: 'uniform-field-null-static' },
    { statement: 'φ_A(t) = φ_B(t) (driven): no population effect', checkId: 'uniform-field-null-driven' },
    { statement: 'Δ → 0: no population transfer in either branch', checkId: 'zero-mixing-limit' },
    { statement: 'E_A = E_B: P_B invariant under g → −g', checkId: 'equal-energy-sign-symmetry' },
    { statement: 'Drive off: proposed branch follows the Rabi closed form', checkId: 'static-model-closed-form' },
  ],
  observables: ['site-b-occupation', 'population-difference', 'trace-distance', 'max-divergence', 'mean-divergence', 'interferometric-phase'],
  falsificationConditions: [
    {
      level: 'internal_consistency',
      statement:
        'The implementation is rejected if any limiting case or invariant above fails inside the tested parameters, or if the g = 0 or uniform-field controls produce a population effect.',
      operational: true,
      missing: [],
    },
    {
      level: 'empirical',
      statement:
        'With E_B − E_A and Δ independently calibrated and φ varied by a known amount, absence of a P_B change scaling with g·Δφ beyond a declared resolution bounds |g| on that apparatus.',
      operational: false,
      missing: [
        'A physical identification of φ (what field, in what units)',
        'A calibrated normalisation of g',
        'A physical system whose two sites experience different φ',
        'Independent calibration of E_B − E_A to better than g·Δφ (a static effect is degenerate with detuning)',
        'An apparatus resolution and noise model for P_B',
        'A model of decoherence, which the closed evolution omits',
      ],
    },
  ],
};

export const WOODYARD_KERNEL: ResearchModelDescriptor = {
  id: 'woodyard-localization-kernel-v1',
  name: 'Field-modulated localization kernel (Woodyard 2026, Sec. 3)',
  epistemicClass: 'proposed',
  equations: [
    'ω_loc(x) = ω₀ + βφ(x) + κ∇²φ(x)',
    'L(x) = (Γ/2)² / [(ω_w − ω_loc)² + (Γ/2)²],  χ = exp(αL)',
    'P_loc(x) = χ(x)|ψ(x)|² / ∫χ|ψ|²',
  ],
  assumptions: [
    'Born density is a single Gaussian packet on a normalised grid x ∈ [−1, 1]',
    'φ(x) = φ̄ + (Δφ/2) tanh(x/w) with analytic Laplacian, w = 0.5',
    'Kernel acts multiplicatively and is renormalised',
    'Static field: the kernel does not evolve in time',
  ],
  proseOnlyAssumptions: [
    'The kernel describes a physical, frequency-selective localization response',
    'The weak-response expansion χ ≈ 1 + α(L − ⟨L⟩) is the regime of validity (α ≲ 1)',
    'Kernel frequencies (ω₀, ω_w, Γ) relate to some physical drive — no units are declared',
  ],
  units: KERNEL_UNITS,
  parameters: [
    { key: 'alpha', symbol: 'α', role: 'independent_variable', bounds: { min: 0, max: 1, source: 'stated weak-response domain' } },
    { key: 'gamma', symbol: 'Γ', role: 'independent_variable' },
    { key: 'omega_w', symbol: 'ω_w', role: 'independent_variable' },
    { key: 'beta', symbol: 'β', role: 'free_constant', value: 2.0 },
    { key: 'kappa', symbol: 'κ', role: 'free_constant', value: 0.15 },
    { key: 'omega0', symbol: 'ω₀', role: 'free_constant', value: 10 },
  ],
  invariants: [
    { statement: 'P_loc and the Born density are normalised; the divergence integrates to 0', checkId: 'kernel-density-normalization' },
    { statement: 'A constant multiplicative kernel cancels', checkId: 'kernel-constant-cancels' },
    { statement: 'Equations are dimensionally consistent', checkId: 'dimensions-localization-kernel-simulation-units.v1' },
  ],
  limitingCases: [
    { statement: 'α → 0: χ → 1 and P_loc → Born density', checkId: 'kernel-alpha-zero' },
    { statement: 'Spatially flat field: no localization effect', checkId: 'kernel-flat-field' },
  ],
  observables: ['kernel-region-separation', 'kernel-factor', 'local-resonance'],
  falsificationConditions: [
    {
      level: 'internal_consistency',
      statement: 'Rejected if the α → 0 or flat-field limits produce a density change, or normalisation fails.',
      operational: true,
      missing: [],
    },
    {
      level: 'empirical',
      statement:
        'A calibrated density measurement showing no frequency-selective redistribution near ω_w beyond its declared resolution excludes the kernel for those parameters.',
      operational: false,
      missing: [
        'Physical units for ω₀, ω_w and Γ and their relation to a real drive',
        'A physical length scale for x',
        'Declared values of β and κ (currently free constants that differ between code paths)',
        'An imaging resolution and noise model',
      ],
    },
  ],
};

export const RESEARCH_MODELS: ResearchModelDescriptor[] = [STANDARD_TWO_SITE, WOODYARD_TWO_SITE, WOODYARD_KERNEL];

export function researchModel(id: string): ResearchModelDescriptor {
  const m = RESEARCH_MODELS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown research model: ${id}`);
  return m;
}
