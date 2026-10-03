// Structured, deterministic verification results.
//
// validateParameters.ts throws on failure, which suits input guards. A research
// run needs the opposite: every check runs, every outcome is kept — failures
// included — and the full list travels with the experiment record. No check
// here consults a language model or any non-deterministic source; a status is
// a pure function of the numbers the engine produced.

import type { ResearchGateId } from '@/lib/epistemics';

export type VerificationStatus = 'pass' | 'fail' | 'warning' | 'not_applicable';

/**
 * executed — the status was computed by running code on this run's inputs.
 * metadata — the status restates an explicit declaration (e.g. "g is not
 *            calibrated"). Metadata can only ever WARN; it is never allowed to
 *            award a pass, because documentation claiming a property is not
 *            evidence that it holds.
 */
export type VerificationSource = 'executed' | 'metadata';

export type VerificationCategory =
  | 'structure'
  | 'conservation'
  | 'convergence'
  | 'control'
  | 'limit'
  | 'symmetry'
  | 'invariant'
  | 'domain'
  | 'units'
  | 'identifiability'
  | 'calibration';

export interface VerificationResult {
  id: string;
  label: string;
  category: VerificationCategory;
  /** Which of the four research questions this check bears on. */
  gate: ResearchGateId;
  status: VerificationStatus;
  source: VerificationSource;
  measured?: number;
  tolerance?: number;
  explanation: string;
}

type Meta = Pick<VerificationResult, 'id' | 'label' | 'category' | 'gate'>;

/** Pass iff a finite measured value is at or below its tolerance. */
export function checkAtMost(
  meta: Meta,
  measured: number,
  tolerance: number,
  explanation: string
): VerificationResult {
  const finite = Number.isFinite(measured);
  return {
    ...meta,
    source: 'executed',
    status: finite && measured <= tolerance ? 'pass' : 'fail',
    measured: finite ? measured : undefined,
    tolerance,
    explanation: finite ? explanation : `Non-finite measurement. ${explanation}`,
  };
}

/** Largest |H_ij − conj(H_ji)| for a complex 2×2 matrix. */
export function hermiticityDefect(
  re: readonly (readonly number[])[],
  im: readonly (readonly number[])[] = [
    [0, 0],
    [0, 0],
  ]
): number {
  let defect = 0;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      defect = Math.max(
        defect,
        Math.abs(re[i][j] - re[j][i]),
        Math.abs(im[i][j] + im[j][i])
      );
    }
  }
  return defect;
}

export function checkHermitian2x2(
  meta: Meta,
  matrix: readonly (readonly number[])[],
  tolerance = 1e-12
): VerificationResult {
  if (matrix.length !== 2 || matrix.some((row) => row.length !== 2)) {
    return {
      ...meta,
      source: 'executed',
      status: 'fail',
      explanation: 'Matrix must be 2x2',
    };
  }
  if (matrix.flat().some((v) => !Number.isFinite(v))) {
    return {
      ...meta,
      source: 'executed',
      status: 'fail',
      explanation: 'Matrix contains a non-finite entry.',
    };
  }
  const defect = hermiticityDefect(matrix);
  return {
    ...meta,
    source: 'executed',
    status: defect <= tolerance ? 'pass' : 'fail',
    measured: defect,
    tolerance,
    explanation:
      defect <= tolerance
        ? 'Real symmetric 2×2 matrix (H₁₂ = H₂₁).'
        : 'Matrix off-diagonal elements are not equal',
  };
}

export function checkNormalization(
  meta: Meta,
  probabilities: readonly number[],
  tolerance = 1e-10
): VerificationResult {
  const sum = probabilities.reduce((acc, p) => acc + p, 0);
  const negative = probabilities.some((p) => p < -tolerance);
  const result = checkAtMost(
    meta,
    Math.abs(sum - 1),
    tolerance,
    `|Σp − 1| for ${probabilities.length} probabilities.`
  );
  if (negative) {
    return { ...result, status: 'fail', explanation: 'A probability is negative.' };
  }
  return result;
}

export function checkFinite(meta: Meta, values: Iterable<number>): VerificationResult {
  let count = 0;
  let bad = 0;
  for (const v of values) {
    count += 1;
    if (!Number.isFinite(v)) bad += 1;
  }
  return {
    ...meta,
    source: 'executed',
    status: bad === 0 ? 'pass' : 'fail',
    measured: bad,
    tolerance: 0,
    explanation:
      bad === 0
        ? `All ${count} recorded numbers are finite.`
        : `${bad} of ${count} recorded numbers are NaN or infinite.`,
  };
}

export function checkDomain(
  meta: Meta,
  value: number,
  bounds: { min?: number; max?: number; exclusiveMin?: boolean },
  explanation: string,
  /** Outside the domain → 'fail' (hard requirement) or 'warning' (extrapolation). */
  severity: 'fail' | 'warning' = 'fail'
): VerificationResult {
  const aboveMin =
    bounds.min === undefined || (bounds.exclusiveMin ? value > bounds.min : value >= bounds.min);
  const belowMax = bounds.max === undefined || value <= bounds.max;
  const inside = Number.isFinite(value) && aboveMin && belowMax;
  return {
    ...meta,
    source: 'executed',
    status: inside ? 'pass' : severity,
    measured: Number.isFinite(value) ? value : undefined,
    tolerance: bounds.max ?? bounds.min,
    explanation,
  };
}

/** A declaration restated as a check. It can warn; it can never pass. */
export function metadataWarning(meta: Meta, explanation: string): VerificationResult {
  return { ...meta, source: 'metadata', status: 'warning', explanation };
}

export function notApplicable(meta: Meta, explanation: string): VerificationResult {
  return { ...meta, source: 'executed', status: 'not_applicable', explanation };
}

export interface VerificationSummary {
  pass: number;
  fail: number;
  warning: number;
  not_applicable: number;
}

export function summarizeVerification(results: readonly VerificationResult[]): VerificationSummary {
  const summary: VerificationSummary = { pass: 0, fail: 0, warning: 0, not_applicable: 0 };
  for (const r of results) summary[r.status] += 1;
  return summary;
}

/** Drop absent optional fields so a result can be canonically serialised. */
export function compactResult(result: VerificationResult): VerificationResult {
  const out = { ...result };
  if (out.measured === undefined) delete out.measured;
  if (out.tolerance === undefined) delete out.tolerance;
  return out;
}
