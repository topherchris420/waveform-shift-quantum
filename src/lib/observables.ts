// Observable registry.
//
// A number the laboratory computes is one of four kinds, and only the last can
// ever be compared with an apparatus:
//
//   internal_model_variable      — appears inside the equations (χ, ω_loc, δ).
//                                  Not measurable on its own.
//   numerical_diagnostic         — describes the computation or compares two
//                                  predictions (norm error, trace distance).
//   simulated_observable         — what the model says a measurement of a
//                                  physical quantity would return, in simulation
//                                  units, with no calibration to a real device.
//   experimentally_measurable    — a quantity of a type real instruments
//                                  measure. Listing it here does NOT mean the
//                                  model's prediction for it is defined: see
//                                  `predictionDefined` and `calibration`.
//
// Sensitivities are never invented. Where no apparatus specification exists the
// field says 'unknown'.

import type { CalibrationStatus } from './units';

export type ObservableKind =
  | 'internal_model_variable'
  | 'numerical_diagnostic'
  | 'simulated_observable'
  | 'experimentally_measurable';

export interface ObservableDescriptor {
  id: string;
  name: string;
  kind: ObservableKind;
  /** Mathematical definition, as implemented. */
  definition: string;
  /** Unit, or simulation-unit status. */
  units: string;
  calibration: CalibrationStatus;
  /** Research-model ids that produce it. */
  models: string[];
  /** Code that computes it. */
  implementedIn: string;
  baselinePrediction: string;
  proposedPrediction: string;
  /** Typical simulated magnitude, or 'computed per run', or 'unknown'. */
  expectedMagnitude: string;
  /** Required experimental sensitivity. 'unknown' unless a real specification exists. */
  requiredSensitivity: 'unknown' | string;
  /** Instrument class, or null where none is defensible. */
  instrumentClass: string | null;
  /** True only when the model yields a definite number for a real apparatus. */
  predictionDefined: boolean;
  confounders: string[];
  falsificationRule: string;
}

const TWO_SITE = 'woodyard-two-site-v1';
const BASELINE = 'standard-two-site-qm';
const KERNEL = 'woodyard-localization-kernel-v1';

export const OBSERVABLES: ObservableDescriptor[] = [
  {
    id: 'site-b-occupation',
    name: 'Site-B occupation probability P_B(t)',
    kind: 'simulated_observable',
    definition: 'P_B(t) = |⟨B|ψ(t)⟩|², |ψ(0)⟩ = |A⟩',
    units: 'probability (dimensionless); t in ħ/ε₀',
    calibration: 'simulation_value',
    models: [BASELINE, TWO_SITE],
    implementedIn: 'simulateRealitySplit (src/lib/realitySplit.ts)',
    baselinePrediction: 'P_B(t) = (4Δ²/Ω²) sin²(Ωt/2), Ω² = (E_B − E_A)² + 4Δ²',
    proposedPrediction: 'P_B(t) under H(t) with diagonal gφ_A(t), gφ_B(t); closed form only when the drive is off',
    expectedMagnitude: 'computed per run (0–1)',
    requiredSensitivity: 'unknown',
    instrumentClass:
      'Site-resolved population readout of a two-level or double-well system (generic). Which physical system couples to φ is not defined.',
    predictionDefined: false,
    confounders: [
      'Uncalibrated bare detuning E_B − E_A: a static g(φ_B − φ_A) is exactly degenerate with it',
      'Uncalibrated tunnelling amplitude Δ',
      'Decoherence and dephasing (not modelled: evolution is closed and unitary)',
      'State-preparation and readout error',
      'Levels outside the two-level truncation',
    ],
    falsificationRule:
      'With E_B − E_A and Δ independently calibrated and φ varied by a known, controlled amount, absence of a P_B change scaling with g·Δφ beyond a declared resolution bounds |g| for that apparatus. Not operational until φ is physically identified.',
  },
  {
    id: 'population-difference',
    name: 'Population difference z = P_A − P_B',
    kind: 'simulated_observable',
    definition: 'z = P_A − P_B = 1 − 2P_B under normalisation',
    units: 'dimensionless',
    calibration: 'simulation_value',
    models: [BASELINE, TWO_SITE],
    implementedIn: 'twoSiteModel (static eigenstate) and simulateRealitySplit frames',
    baselinePrediction: 'z = 1 − 2P_B^std',
    proposedPrediction: 'z = 1 − 2P_B^model',
    expectedMagnitude: 'computed per run (−1 to 1)',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['Same as site-B occupation; carries no independent information'],
    falsificationRule: 'Equivalent to the site-B occupation rule.',
  },
  {
    id: 'trace-distance',
    name: 'Trace distance between predicted occupations D(t)',
    kind: 'numerical_diagnostic',
    definition: 'D(t) = ½Σ_i |p_i − q_i| = |P_B^model(t) − P_B^std(t)|',
    units: 'dimensionless',
    calibration: 'derived',
    models: [TWO_SITE],
    implementedIn: 'simulateRealitySplit',
    baselinePrediction: '0 by definition (baseline compared with itself)',
    proposedPrediction: 'computed per run',
    expectedMagnitude: 'computed per run (0–1)',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['Compares two model outputs; no instrument measures it directly'],
    falsificationRule:
      'Not a measured quantity. It bounds the advantage a single population measurement could have in distinguishing the models.',
  },
  {
    id: 'max-divergence',
    name: 'Maximum divergence max_t D(t)',
    kind: 'numerical_diagnostic',
    definition: 'max over the coarse time grid of D(t)',
    units: 'dimensionless',
    calibration: 'derived',
    models: [TWO_SITE],
    implementedIn: 'simulateRealitySplit (maxDivergence)',
    baselinePrediction: '0',
    proposedPrediction: 'computed per run',
    expectedMagnitude: 'computed per run',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['Grid-sampled maximum; the largest swept value is not an optimum'],
    falsificationRule: 'Summary statistic of D(t); not measured.',
  },
  {
    id: 'mean-divergence',
    name: 'Mean divergence ⟨D⟩_t',
    kind: 'numerical_diagnostic',
    definition: 'arithmetic mean of D over post-step coarse frames',
    units: 'dimensionless',
    calibration: 'derived',
    models: [TWO_SITE],
    implementedIn: 'simulateRealitySplit (meanDivergence)',
    baselinePrediction: '0',
    proposedPrediction: 'computed per run',
    expectedMagnitude: 'computed per run',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['Rectangle-rule average over a finite window'],
    falsificationRule: 'Summary statistic of D(t); not measured.',
  },
  {
    id: 'spatial-density-divergence',
    name: 'Spatial density divergence ρ_model(x) − ρ_std(x)',
    kind: 'numerical_diagnostic',
    definition: 'Normalised densities from site populations rendered as Gaussian wells; L1 = ∫|Δρ|dx',
    units: 'per sample half-width',
    calibration: 'underspecified',
    models: [TWO_SITE],
    implementedIn: 'computeDivergenceField (two_site mode)',
    baselinePrediction: 'Δρ ≡ 0',
    proposedPrediction: 'computed per frame',
    expectedMagnitude: 'L1 ≤ 2D(t)',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['Well positions and widths are a rendering choice, not part of the model'],
    falsificationRule: 'Visualisation of D(t); carries no information beyond the populations.',
  },
  {
    id: 'kernel-region-separation',
    name: 'Probability in the kernel-enhanced region',
    kind: 'simulated_observable',
    definition: '∫_{Δρ>0} (P_loc − ρ_Born) dx = total-variation distance between P_loc and the Born density',
    units: 'probability; x in sample half-widths',
    calibration: 'underspecified',
    models: [KERNEL],
    implementedIn: 'kernelRegionSeparation (src/lib/realitySplit.ts)',
    baselinePrediction: '0 (Born rule)',
    proposedPrediction: 'computed from χ(x) = exp(αL(x)) with the tanh field profile',
    expectedMagnitude: 'computed per parameter set',
    requiredSensitivity: 'unknown',
    instrumentClass:
      'Spatially resolved density imaging (generic). Not defensible as a specific instrument: the kernel frequencies and length scale have no physical units.',
    predictionDefined: false,
    confounders: [
      'Imaging point-spread function and background',
      'Preparation of the reference density |ψ|² itself',
      'Any frequency-selective force that is not the proposed kernel',
    ],
    falsificationRule:
      'A calibrated density measurement that shows no frequency-selective redistribution near ω_w beyond its declared resolution excludes the kernel for those parameters.',
  },
  {
    id: 'kernel-factor',
    name: 'Response kernel factor χ(x)',
    kind: 'internal_model_variable',
    definition: 'χ = exp(αL), L = (Γ/2)²/[(ω_w − ω_loc)² + (Γ/2)²]',
    units: 'dimensionless',
    calibration: 'underspecified',
    models: [KERNEL],
    implementedIn: 'localizationKernel (src/lib/physics.ts)',
    baselinePrediction: '1',
    proposedPrediction: 'exp(αL)',
    expectedMagnitude: '1 to e^α',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['A spatially constant χ cancels exactly under normalisation'],
    falsificationRule: 'Not measurable on its own; only the normalised density P_loc is.',
  },
  {
    id: 'local-resonance',
    name: 'Local resonance ω_loc(x)',
    kind: 'internal_model_variable',
    definition: 'ω_loc = ω₀ + βφ + κ∇²φ',
    units: 'kernel frequency unit (undeclared)',
    calibration: 'underspecified',
    models: [KERNEL],
    implementedIn: 'localizationKernel',
    baselinePrediction: 'not defined in standard QM',
    proposedPrediction: 'computed per position',
    expectedMagnitude: 'unknown',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: [],
    falsificationRule: 'Internal variable; not measurable.',
  },
  {
    id: 'detuning',
    name: 'Effective detuning δ',
    kind: 'internal_model_variable',
    definition: 'δ = (E_B − E_A) + g(φ_B − φ_A)',
    units: 'ε₀',
    calibration: 'underspecified',
    models: [TWO_SITE],
    implementedIn: 'twoSiteModel',
    baselinePrediction: 'E_B − E_A',
    proposedPrediction: 'E_B − E_A + g(φ_B − φ_A)',
    expectedMagnitude: 'computed per run',
    requiredSensitivity: 'unknown',
    instrumentClass: null,
    predictionDefined: false,
    confounders: ['The two contributions cannot be separated without independent calibration of E_B − E_A'],
    falsificationRule: 'Internal variable; enters observables only through Ω and P_B.',
  },
  {
    id: 'interferometric-phase',
    name: 'Matter-wave interferometric phase Δφ_φ',
    kind: 'experimentally_measurable',
    definition: 'Δφ_φ = (g/ħ)∫₀ᵀ[φ(x₁(t), t) − φ(x₂(t), t)] dt',
    units: 'rad',
    calibration: 'underspecified',
    models: [TWO_SITE],
    implementedIn: 'interferometryPhaseShift (src/lib/physics.ts); not used by any protocol',
    baselinePrediction: '0 (no scalar coupling)',
    proposedPrediction: 'undefined numerically: requires calibrated g and a physical φ(x, t) along the arms',
    expectedMagnitude: 'unknown',
    requiredSensitivity: 'unknown',
    instrumentClass:
      'Matter-wave interferometer (phase readout). Phases are measurable in principle; the model supplies no number to compare.',
    predictionDefined: false,
    confounders: [
      'Gravitational and inertial phases',
      'Electromagnetic potentials along the arms',
      'Any arm-dependent potential that is not φ',
    ],
    falsificationRule:
      'Not operational: without a physical identification of φ and a calibrated g, no phase can be predicted to compare with a measurement.',
  },
  {
    id: 'clock-comparison-phase',
    name: 'Clock-comparison differential phase ΔΦ_AB',
    kind: 'experimentally_measurable',
    definition: 'ΔΦ_AB(T) = η∫₀ᵀ[φ(x_A, t) − φ(x_B, t)] dt',
    units: 'rad',
    calibration: 'underspecified',
    models: [TWO_SITE],
    implementedIn: 'clockComparisonPhase (src/lib/physics.ts); not used by any protocol',
    baselinePrediction: '0',
    proposedPrediction: 'undefined numerically: η is not related to g and φ is unidentified',
    expectedMagnitude: 'unknown',
    requiredSensitivity: 'unknown',
    instrumentClass: 'Clock comparison (phase readout). The model supplies no number to compare.',
    predictionDefined: false,
    confounders: ['Gravitational redshift between clock sites', 'Clock systematics'],
    falsificationRule: 'Not operational: η has no declared relation to g.',
  },
  {
    id: 'norm-error',
    name: 'Norm error |‖ψ‖² − 1|',
    kind: 'numerical_diagnostic',
    definition: 'max over frames and branches of |P_A + P_B − 1|',
    units: 'dimensionless',
    calibration: 'derived',
    models: [BASELINE, TWO_SITE],
    implementedIn: 'runExperiment',
    baselinePrediction: '0 up to rounding',
    proposedPrediction: '0 up to rounding',
    expectedMagnitude: '~1e-15',
    requiredSensitivity: 'not applicable',
    instrumentClass: null,
    predictionDefined: true,
    confounders: [],
    falsificationRule: 'A numerical check, not a physical prediction.',
  },
  {
    id: 'timestep-error',
    name: 'Timestep ladder errors',
    kind: 'numerical_diagnostic',
    definition: 'error(dt, dt/2) and error(dt/2, dt/4) at shared coarse-grid times',
    units: 'same as the compared metric',
    calibration: 'derived',
    models: [BASELINE, TWO_SITE],
    implementedIn: 'runTimestepLadder (src/quantum/validation/convergence.ts)',
    baselinePrediction: 'rounding level (static H)',
    proposedPrediction: 'O(dt²) when driven, rounding level when static',
    expectedMagnitude: 'computed per run',
    requiredSensitivity: 'not applicable',
    instrumentClass: null,
    predictionDefined: true,
    confounders: [],
    falsificationRule: 'A numerical check, not a physical prediction.',
  },
];

export function observable(id: string): ObservableDescriptor {
  const o = OBSERVABLES.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown observable: ${id}`);
  return o;
}
