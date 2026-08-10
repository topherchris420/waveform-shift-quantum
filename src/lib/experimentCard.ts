// Experiment card generator.
//
// Turns a candidate parameter regime into a concrete, checkable experimental
// proposal: what to measure, what each model predicts, how uncertain that
// measurement would be, how much precision is required, and — most importantly
// — the single result that would falsify the proposed model.
//
// All feasibility arithmetic is shot-noise-and-systematics based:
//
//   σ_N     = σ_shot / √N                    (statistical averaging)
//   σ_total = √(σ_N² + σ_sys²)               (systematics do not average down)
//   S       = |Δ| / σ_total                  (significance, in σ)
//   N_req   = σ_shot² / ((|Δ|/n)² − σ_sys²)  (shots for an n-σ result)
//
// N_req diverges when |Δ|/n ≤ σ_sys: below the systematic floor the prediction
// is untestable on that apparatus at any shot count, and the card says so
// instead of quoting an impossible precision.

import { compareModels, type ModelComparisonResult } from './physics';
import {
  platformResolution,
  type Platform,
} from './platforms';
import type { AnomalyParameters } from './anomalyEngine';

/** Confidence level, in standard deviations, required to claim a detection. */
export const DETECTION_SIGMA = 5;

/**
 * Convert a comparison's raw model output into the dimensionless quantity an
 * apparatus actually reads out.
 *
 * This matters because the platform noise floors are quoted in observable
 * units. The two-site comparison already returns a probability, but the
 * localization comparison returns the response-kernel factor χ ≥ 1 against a
 * baseline of χ = 1 — and a kernel factor is not something a clock or an
 * interferometer reports. What a differential measurement returns is the
 * density contrast
 *
 *     C = (χ − 1) / (χ + 1) ∈ [0, 1)
 *
 * which reduces to αL/2 in the weak-response limit the model is derived in.
 * Without this step an unbounded χ would be compared directly against a
 * fractional-frequency noise floor, manufacturing million-sigma "predictions"
 * out of a units mismatch. compareModels itself is left untouched.
 */
export function toObservableUnits(experimentType: string, rawValue: number): number {
  switch (experimentType) {
    case 'localization':
    case 'scalar_kernel':
      return (rawValue - 1) / (rawValue + 1);
    default:
      // Probabilities and fidelities are already the measured quantity.
      return rawValue;
  }
}

/**
 * Whether a regime sits inside the domain where the proposed model was derived,
 * or is an extrapolation beyond it.
 */
export type ModelValidity = 'perturbative' | 'extrapolated';

export function modelValidity(
  experimentType: string,
  parameters: Pick<AnomalyParameters, 'alpha'>
): ModelValidity {
  if (experimentType !== 'scalar_kernel' && experimentType !== 'localization') {
    // The two-site Hamiltonian is diagonalized exactly; no expansion is involved.
    return 'perturbative';
  }
  // The kernel's weak-response expansion χ = exp(αL) ≈ 1 + α(L − ⟨L⟩) holds for
  // αL ≲ 1, and L ≤ 1 by construction, so α ≲ 1 is the model's own stated
  // domain of validity. Beyond it the laboratory is extrapolating, and says so.
  return parameters.alpha <= 1 ? 'perturbative' : 'extrapolated';
}

export type Testability =
  | 'testable_now'
  | 'needs_more_integration'
  | 'below_systematic_floor';

export interface UncertaintyBudget {
  /** 1σ resolution of a single shot on this platform, in observable units. */
  singleShot: number;
  /** Statistical uncertainty after the assumed shot budget: σ_shot/√N. */
  statistical: number;
  /** Irreducible systematic floor of the apparatus. */
  systematic: number;
  /** Combined 1σ uncertainty on the measured observable. */
  total: number;
  /** Shots assumed for the quoted statistical term. */
  shots: number;
  /** Plain-language statement of where the number comes from. */
  basis: string;
}

export interface ExperimentCard {
  id: string;
  createdAt: string;
  /** Which model comparison this card is built from. */
  experimentType: string;
  platform: Platform;
  parameters: AnomalyParameters;

  /** The dimensionless quantity under test, from the model comparison. */
  observable: string;
  /** The channel the hardware physically detects it through. */
  readoutChannel: string;

  /** ESTABLISHED PHYSICS — standard quantum mechanics with no scalar coupling. */
  standardPrediction: number;
  /** PROPOSED MODEL — Woodyard (2026) field-modulated localization. */
  modelPrediction: number;
  /** Signed separation between the two predictions. */
  delta: number;
  percentDeviation: number;

  uncertainty: UncertaintyBudget;
  /** 1σ resolution the apparatus must reach for a DETECTION_SIGMA result. */
  requiredPrecision: number;
  /** Shots needed for that result; Infinity when blocked by systematics. */
  requiredShots: number;
  /** |Δ| / σ_total at the assumed shot budget. */
  significance: number;
  testability: Testability;
  /** Whether this regime lies inside the model's derived domain of validity. */
  modelValidity: ModelValidity;

  /** The result that would rule the proposed model out in this regime. */
  falsificationCondition: string;
  /** Controls a credible null result must include. */
  controls: string[];
  /** Systematics that could counterfeit a positive result. */
  confounders: string[];
  /** Assumptions inherited from the model comparison. */
  assumptions: string[];
  /** Deterministic seed so the card can be regenerated exactly. */
  seed: number;
}

const formatSci = (v: number) => {
  if (!Number.isFinite(v)) return '∞';
  if (v === 0) return '0';
  return v.toExponential(2);
};

/** Shots required to resolve |delta| at nSigma given a platform's noise model. */
export function requiredShotsFor(
  platform: Platform,
  delta: number,
  nSigma: number = DETECTION_SIGMA
): number {
  const target = Math.abs(delta) / nSigma;
  // Systematics do not average down: if the per-measurement systematic floor is
  // already at or above the required 1σ precision, no shot count is enough.
  if (target <= platform.systematicFloor) return Infinity;
  const variance = target * target - platform.systematicFloor * platform.systematicFloor;
  return Math.ceil((platform.singleShotResolution * platform.singleShotResolution) / variance);
}

export function classifyTestability(
  platform: Platform,
  delta: number,
  nSigma: number = DETECTION_SIGMA
): { testability: Testability; requiredShots: number } {
  const requiredShots = requiredShotsFor(platform, delta, nSigma);
  if (!Number.isFinite(requiredShots)) {
    return { testability: 'below_systematic_floor', requiredShots };
  }
  if (requiredShots <= platform.practicalShots) {
    return { testability: 'testable_now', requiredShots };
  }
  return { testability: 'needs_more_integration', requiredShots };
}

export interface BuildCardOptions {
  id?: string;
  seed?: number;
  /** Override the shot budget used for the quoted uncertainty. */
  shots?: number;
  nSigma?: number;
  /** Reuse an already-computed comparison instead of recomputing it. */
  comparison?: ModelComparisonResult;
}

/**
 * Build a full experiment card for one parameter regime on one platform.
 */
export function buildExperimentCard(
  experimentType: string,
  parameters: AnomalyParameters,
  platform: Platform,
  options: BuildCardOptions = {}
): ExperimentCard {
  const nSigma = options.nSigma ?? DETECTION_SIGMA;
  const comparison = options.comparison ?? compareModels(experimentType, parameters);
  // Both predictions are mapped through the same monotone function, so the sign
  // and the existence of a separation are preserved while the scale becomes
  // something a real apparatus could be held to.
  const standardPrediction = toObservableUnits(experimentType, comparison.standardQM);
  const modelPrediction = toObservableUnits(experimentType, comparison.woodyardModel);
  const delta = modelPrediction - standardPrediction;
  const percentDeviation =
    Math.abs(standardPrediction) > 1e-12
      ? (delta / standardPrediction) * 100
      : comparison.percentDeviation;
  const validity = modelValidity(experimentType, parameters);

  const shots = options.shots ?? platform.practicalShots;
  const statistical = platform.singleShotResolution / Math.sqrt(Math.max(1, shots));
  const total = platformResolution(platform, shots);

  const uncertainty: UncertaintyBudget = {
    singleShot: platform.singleShotResolution,
    statistical,
    systematic: platform.systematicFloor,
    total,
    shots,
    basis:
      `σ_total = √(σ_shot²/N + σ_sys²) with σ_shot = ${formatSci(platform.singleShotResolution)} ` +
      `per shot, N = ${shots.toExponential(0)} shots (${platform.integrationTime}), ` +
      `and an irreducible systematic floor σ_sys = ${formatSci(platform.systematicFloor)}.`,
  };

  const requiredPrecision = Math.abs(delta) / nSigma;
  const { testability, requiredShots } = classifyTestability(platform, delta, nSigma);
  const significance = total > 0 ? Math.abs(delta) / total : 0;

  const direction = delta >= 0 ? 'above' : 'below';
  const falsificationCondition =
    testability === 'below_systematic_floor'
      ? `Not falsifiable on this apparatus: the predicted separation |Δ| = ${formatSci(Math.abs(delta))} ` +
        `requires 1σ precision of ${formatSci(requiredPrecision)}, which lies below the platform's ` +
        `systematic floor of ${formatSci(platform.systematicFloor)}. A null result here would ` +
        `constrain nothing — choose a platform whose systematic floor is under ${formatSci(requiredPrecision)}.`
      : `Measure ${comparison.observableName} at the stated parameters. Established physics predicts ` +
        `${standardPrediction.toFixed(6)}; the proposed model predicts ${modelPrediction.toFixed(6)} ` +
        `(${direction} the standard value by ${formatSci(Math.abs(delta))}). ` +
        `If the measured value agrees with ${standardPrediction.toFixed(6)} to within ` +
        `±${formatSci(nSigma * total)} (${nSigma}σ), the proposed model is FALSIFIED at ` +
        `g = ${parameters.g}, α = ${parameters.alpha}, Δ = ${parameters.delta}. ` +
        `Confirmation requires the ${nSigma}σ excess to survive every control below.` +
        (validity === 'extrapolated'
          ? ` NOTE: α = ${parameters.alpha} is outside the weak-response regime the kernel was derived in, so this prediction is an extrapolation of the model rather than a consequence of it.`
          : '');

  const seed = options.seed ?? 137000 + Math.round(Math.abs(delta) * 1e6);
  const id =
    options.id ??
    `EXP-${platform.id.toUpperCase().slice(0, 4)}-${Math.abs(seed % 100000)
      .toString()
      .padStart(5, '0')}`;

  return {
    id,
    createdAt: new Date().toISOString(),
    experimentType,
    platform,
    parameters,
    observable: comparison.observableName,
    readoutChannel: platform.readoutChannel,
    standardPrediction,
    modelPrediction,
    delta,
    percentDeviation,
    uncertainty,
    requiredPrecision,
    requiredShots,
    significance,
    testability,
    modelValidity: validity,
    falsificationCondition,
    controls: [
      'Zero-coupling control: repeat with the scalar drive off (g → 0). The predicted separation must vanish.',
      'Reversed-gradient control: swap φ_A ↔ φ_B. The predicted shift must change sign, not merely magnitude.',
      'Blind analysis: fix the analysis pipeline and unblind only after the control runs are accepted.',
      `Interleaved reference: alternate signal and reference shots to reject drift slower than ${platform.integrationTime}.`,
    ],
    confounders: platform.systematics,
    assumptions: comparison.assumptions,
    seed,
  };
}

/** One-line verdict suitable for a badge. */
export function testabilityLabel(t: Testability): string {
  switch (t) {
    case 'testable_now':
      return 'TESTABLE WITH CURRENT APPARATUS';
    case 'needs_more_integration':
      return 'TESTABLE ONLY WITH EXTENDED INTEGRATION';
    default:
      return 'NOT TESTABLE ON THIS PLATFORM';
  }
}

/** Flatten a card to CSV for research export. */
export function experimentCardToCSV(card: ExperimentCard): string {
  const rows: Array<[string, string]> = [
    ['card_id', card.id],
    ['created_at', card.createdAt],
    ['experiment_type', card.experimentType],
    ['platform', card.platform.label],
    ['observable', card.observable],
    ['readout_channel', card.readoutChannel],
    ['established_physics_prediction', card.standardPrediction.toPrecision(10)],
    ['proposed_model_prediction', card.modelPrediction.toPrecision(10)],
    ['delta', card.delta.toPrecision(10)],
    ['percent_deviation', card.percentDeviation.toPrecision(6)],
    ['sigma_single_shot', card.uncertainty.singleShot.toExponential(4)],
    ['sigma_statistical', card.uncertainty.statistical.toExponential(4)],
    ['sigma_systematic', card.uncertainty.systematic.toExponential(4)],
    ['sigma_total', card.uncertainty.total.toExponential(4)],
    ['assumed_shots', String(card.uncertainty.shots)],
    ['required_precision_1sigma', card.requiredPrecision.toExponential(4)],
    ['required_shots', Number.isFinite(card.requiredShots) ? String(card.requiredShots) : 'infinite'],
    ['significance_sigma', card.significance.toPrecision(6)],
    ['testability', card.testability],
    ['model_validity', card.modelValidity],
    ['seed', String(card.seed)],
    ...Object.entries(card.parameters).map(
      ([k, v]) => [`param_${k}`, String(v)] as [string, string]
    ),
    ['falsification_condition', card.falsificationCondition],
  ];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return ['field,value', ...rows.map(([k, v]) => `${escape(k)},${escape(v)}`)].join('\n') + '\n';
}
