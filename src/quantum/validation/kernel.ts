// Deterministic verification of the localization-kernel sector.
//
// Expected outcomes, derived from P_loc(x) = χ(x)|ψ(x)|² / ∫χ|ψ|², χ = exp(αL):
//
//   α → 0            χ ≡ 1, so P_loc is exactly the Born density.
//   flat field       φ constant ⇒ ω_loc constant ⇒ χ constant ⇒ χ cancels in the
//                    normalisation: P_loc = Born however large χ is.
//   any constant χ   cancels identically (the reason a single-point χ is not an
//                    observable).
//   normalisation    ∫P_loc = ∫Born = 1, so the divergence field integrates to 0:
//                    probability is moved, never created.

import { ILLUSTRATIVE_KERNEL_COEFFICIENTS, localizationKernel, observedLocalizationDensity } from '@/lib/physics';
import {
  computeDivergenceField,
  KERNEL_BETA,
  KERNEL_KAPPA,
  KERNEL_OMEGA0,
  kernelRegionSeparation,
  type RealitySplitParams,
  type SplitFrame,
} from '@/lib/realitySplit';
import { classifyLadder } from './convergence';
import { checkAtMost, checkDomain, type VerificationResult } from './results';

const STATIC_FRAME: SplitFrame = {
  t: 0,
  standard: { PA: 1, PB: 0, norm: 1 },
  model: { PA: 1, PB: 0, norm: 1 },
  deltaPB: 0,
  traceDistance: 0,
};

const kernelField = (p: RealitySplitParams, gridSize = 320) =>
  computeDivergenceField('scalar_kernel', p, STATIC_FRAME, gridSize);

export function checkAlphaZeroReduction(params: RealitySplitParams): VerificationResult {
  const field = kernelField({ ...params, alpha: 0 });
  const chi = localizationKernel({
    omega0: KERNEL_OMEGA0,
    beta: KERNEL_BETA,
    kappa: KERNEL_KAPPA,
    phi: params.phiB,
    d2phi: 0,
    omega_w: params.omega_w,
    gamma: params.gamma,
    alpha: 0,
  }).chi;
  return checkAtMost(
    { id: 'kernel-alpha-zero', label: 'α → 0: χ → 1 and P_loc → Born', category: 'control', gate: 'model' },
    Math.max(field.maxAbs, Math.abs(chi - 1)),
    1e-12,
    'With the response strength off, the kernel must be identically 1 and the predicted density must equal the Born density.'
  );
}

export function checkFlatFieldNull(params: RealitySplitParams): VerificationResult {
  const flat = (params.phiA + params.phiB) / 2 + 0.7;
  const field = kernelField({ ...params, phiA: flat, phiB: flat, alpha: Math.max(2, params.alpha) });
  return checkAtMost(
    { id: 'kernel-flat-field', label: 'Spatially flat field: no localization effect', category: 'control', gate: 'model' },
    field.maxAbs,
    1e-12,
    'A uniform φ makes χ spatially constant; it must cancel under normalisation and manufacture no density change, even at large α.'
  );
}

export function checkConstantKernelCancels(): VerificationResult {
  const born = [0.05, 0.15, 0.3, 0.25, 0.15, 0.1];
  const chi = Math.exp(3.7);
  const { Ploc } = observedLocalizationDensity(
    born,
    born.map(() => ({ L: 1, chi }))
  );
  const total = born.reduce((a, b) => a + b, 0);
  const defect = Math.max(...Ploc.map((p, i) => Math.abs(p - born[i] / total)));
  return checkAtMost(
    { id: 'kernel-constant-cancels', label: 'Constant multiplicative kernel cancels', category: 'invariant', gate: 'model' },
    defect,
    1e-14,
    `A constant χ = e^3.7 ≈ ${chi.toFixed(1)} must leave the normalised density unchanged. A single-point χ value is therefore not an observable.`
  );
}

export function checkKernelDensityNormalization(params: RealitySplitParams): VerificationResult {
  const gridSize = 320;
  const field = kernelField(params, gridSize);
  const dx = 2 / (gridSize - 1);
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0) * dx;
  return checkAtMost(
    {
      id: 'kernel-density-normalization',
      label: 'Localization density normalisation',
      category: 'conservation',
      gate: 'numerics',
    },
    Math.max(Math.abs(sum(field.rhoStandard) - 1), Math.abs(sum(field.rhoModel) - 1), Math.abs(sum(field.divergence))),
    1e-9,
    '∫ρ_Born = ∫P_loc = 1 and the divergence field integrates to zero.'
  );
}

export function checkKernelGridConvergence(params: RealitySplitParams): VerificationResult {
  const [a, b, c] = [160, 320, 640].map((n) => kernelRegionSeparation(params, n).delta);
  const e1 = Math.abs(a - b);
  const e2 = Math.abs(b - c);
  const { regime, observedOrder } = classifyLadder(e1, e2, 1e-10, 0.5);
  const tolerance = 1e-3;
  const status = !(e2 <= tolerance) || regime === 'not_converging' ? 'fail' : regime === 'pre_asymptotic' ? 'warning' : 'pass';
  return {
    id: 'kernel-grid-convergence',
    label: 'Kernel region separation: grid 160 → 320 → 640',
    category: 'convergence',
    gate: 'numerics',
    source: 'executed',
    status,
    measured: e2,
    tolerance,
    explanation: `Total-variation separation ${c.toExponential(4)} at 640 cells; differences ${e1.toExponential(2)} → ${e2.toExponential(2)}${observedOrder !== null ? ` (order ${observedOrder.toFixed(2)}; the region boundary is located to one cell, so first order is expected)` : ''}.`,
  };
}

export function checkWeakResponseDomain(alpha: number): VerificationResult {
  return checkDomain(
    { id: 'kernel-weak-response-domain', label: 'Weak-response domain α ≲ 1', category: 'domain', gate: 'model' },
    alpha,
    { min: 0, max: 1 },
    alpha <= 1
      ? `α = ${alpha} lies inside the weak-response expansion χ ≈ 1 + α(L − ⟨L⟩) that the model is stated in.`
      : `α = ${alpha} exceeds the weak-response domain the model is stated in; results are an extrapolation.`,
    'warning'
  );
}

export function checkLinewidthDomain(gamma: number): VerificationResult {
  return checkDomain(
    { id: 'kernel-linewidth-domain', label: 'Linewidth Γ > 0', category: 'domain', gate: 'model' },
    gamma,
    { min: 0, exclusiveMin: true },
    'The Lorentzian response requires a strictly positive linewidth.'
  );
}

/** Two code paths render "the" kernel; their coefficients must at least be disclosed when they differ. */
export function checkKernelCoefficientConsistency(): VerificationResult {
  const spatial = { omega0: KERNEL_OMEGA0, beta: KERNEL_BETA, kappa: KERNEL_KAPPA };
  const point = ILLUSTRATIVE_KERNEL_COEFFICIENTS;
  const differs = spatial.omega0 !== point.omega0 || spatial.beta !== point.beta || spatial.kappa !== point.kappa;
  return {
    id: 'kernel-coefficient-consistency',
    label: 'Kernel coefficients agree across code paths',
    category: 'invariant',
    gate: 'model',
    source: 'executed',
    status: differs ? 'warning' : 'pass',
    explanation: differs
      ? `The spatial kernel uses β = ${spatial.beta}, κ = ${spatial.kappa} with the analytic ∇²φ; compareModels uses β = ${point.beta}, κ = ${point.kappa} and a fixed ∇²φ = ${point.d2phi}. The model does not fix β or κ, so neither is wrong, but the two surfaces do not display the same model instance. compareModels' χ is classified illustrative.`
      : 'Both code paths use the same kernel coefficients.',
  };
}
