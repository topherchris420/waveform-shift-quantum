// Deterministic verification of the two-site Reality Split model.
//
// Every expected outcome below is DERIVED before it is encoded (the derivations
// are written out in research/gpd/derivations/two-site-limits.md). In brief,
// with H(t) = [[E_A + gφ_A(t), Δ], [Δ, E_B + gφ_B(t)]] and ħ = 1:
//
//   g = 0            H_model ≡ H_std, so the two branches are the same floats.
//   φ_A = φ_B = c(t) H_model = H_std + g c(t)·I. The identity commutes with
//                    everything, so U_model = e^{−ig∫c dt}·U_std: populations,
//                    trace distance and every population observable are
//                    unchanged. NOT null: absolute energies (eigenvalues shift by
//                    gc) and the global phase. The phase is unobservable for one
//                    system but would matter in an interferometer whose arms see
//                    different fields — that is the interferometric sector, not
//                    a common-mode field.
//   Δ = 0            H is diagonal, so U is diagonal: from |A⟩, P_B(t) ≡ 0 in both
//                    branches whatever g and φ do. The coupling cannot move
//                    population without mixing.
//   E_A = E_B        σ_x H(g) σ_x = H(−g) + cI, and any 2×2 unitary has
//                    |U_AB| = |U_BA|, so P_B(t) from |A⟩ is identical for g and −g.
//                    The sign of g is not identifiable from populations here.
//   drive = 0        H is static, so P_B(t) = (4Δ²/Ω²) sin²(Ωt/2), Ω² = δ² + 4Δ²,
//                    exactly — for the baseline (δ = E_B − E_A) and the proposed
//                    branch (δ = E_B − E_A + g(φ_B − φ_A)).
//   static coupling  The proposed static term is a relabelling of bare energies:
//                    E_A → E_A + gφ_A, E_B → E_B + gφ_B. A static measurement cannot
//                    tell it apart from an uncalibrated detuning.

import {
  evolveTwoSiteState,
  twoSiteHamiltonian,
  type TwoSiteParams,
  type TwoSiteStateVector,
} from '@/lib/physics';
import {
  computeDivergenceField,
  fieldAtA,
  fieldAtB,
  simulateRealitySplit,
  type RealitySplitParams,
  type RealitySplitTrajectory,
} from '@/lib/realitySplit';
import { adjoint2, expmMinusIHdt, identity2, maxAbsDiff2, mul2, type C2 } from './linalg';
import {
  checkAtMost,
  hermiticityDefect,
  notApplicable,
  type VerificationResult,
} from './results';

export interface TwoSiteCheckConfig {
  /** Representative proposed-model point, normally the largest sampled coupling. */
  params: RealitySplitParams;
  duration: number;
  dt: number;
  /** Bound for quantities that must vanish identically (controls, nulls). */
  controlTolerance: number;
  /** Bound for agreement with closed forms and exact symmetries (rounding only). */
  analyticTolerance: number;
}

const stepParams = (p: RealitySplitParams, t: number): TwoSiteParams => ({
  EA: p.EA,
  EB: p.EB,
  phiA: fieldAtA(p, t),
  phiB: fieldAtB(p, t),
  g: p.g,
  delta: p.delta,
});

const run = (p: RealitySplitParams, c: TwoSiteCheckConfig) =>
  simulateRealitySplit(p, { duration: c.duration, dt: c.dt });

/** Every frozen Hamiltonian either branch exponentiates, for every given point. */
export function checkStepHamiltonians(
  points: readonly RealitySplitParams[],
  duration: number,
  dt: number
): VerificationResult {
  const steps = Math.max(1, Math.round(duration / dt));
  let defect = 0;
  let finite = true;
  let count = 0;
  for (const p of points) {
    for (let step = 1; step <= steps; step += 1) {
      const tMid = (step - 0.5) * dt;
      for (const H of [
        twoSiteHamiltonian({ ...stepParams(p, tMid), g: 0, phiA: 0, phiB: 0 }),
        twoSiteHamiltonian(stepParams(p, tMid)),
      ]) {
        count += 1;
        if (H.flat().some((v) => !Number.isFinite(v))) finite = false;
        defect = Math.max(defect, hermiticityDefect(H));
      }
    }
  }
  const result = checkAtMost(
    { id: 'hamiltonian-hermiticity', label: 'Hamiltonian Hermiticity', category: 'structure', gate: 'numerics' },
    finite ? defect : Number.NaN,
    0,
    `Largest |H₁₂ − H₂₁| over ${count} frozen step Hamiltonians (both branches, every sampled coupling). Each is a real symmetric 2×2 matrix.`
  );
  return result;
}

/** Columns of the step propagator, read off by evolving |A⟩ and |B⟩. */
function stepPropagator(params: TwoSiteParams, dt: number): C2 {
  const a = evolveTwoSiteState({ cA: { re: 1, im: 0 }, cB: { re: 0, im: 0 } }, params, dt).state;
  const b = evolveTwoSiteState({ cA: { re: 0, im: 0 }, cB: { re: 1, im: 0 } }, params, dt).state;
  return {
    re: [
      [a.cA.re, b.cA.re],
      [a.cB.re, b.cB.re],
    ],
    im: [
      [a.cA.im, b.cA.im],
      [a.cB.im, b.cB.im],
    ],
  };
}

/** Frozen Hamiltonians to probe: first step, drive peak, and drive trough. */
function probeHamiltonians(p: RealitySplitParams, dt: number): TwoSiteParams[] {
  const quarter = p.driveOmega > 0 ? Math.PI / (2 * p.driveOmega) : 0;
  return [dt / 2, quarter, 3 * quarter].map((t) => stepParams(p, t));
}

export function checkPropagatorUnitarity(config: TwoSiteCheckConfig): VerificationResult {
  let defect = 0;
  for (const hp of probeHamiltonians(config.params, config.dt)) {
    const U = stepPropagator(hp, config.dt);
    defect = Math.max(defect, maxAbsDiff2(mul2(adjoint2(U), U), identity2()));
  }
  return checkAtMost(
    { id: 'propagator-unitarity', label: 'Step propagator unitarity', category: 'conservation', gate: 'numerics' },
    defect,
    config.analyticTolerance,
    'max |U†U − I| for the step propagator at three frozen Hamiltonians (first step, drive peak, drive trough).'
  );
}

export function checkPropagatorAgainstExpm(config: TwoSiteCheckConfig): VerificationResult {
  let defect = 0;
  for (const hp of probeHamiltonians(config.params, config.dt)) {
    const U = stepPropagator(hp, config.dt);
    const ref = expmMinusIHdt(twoSiteHamiltonian(hp), config.dt);
    defect = Math.max(defect, maxAbsDiff2(U, ref));
  }
  return checkAtMost(
    {
      id: 'propagator-matches-expm',
      label: 'Step propagator = exp(−iH dt) (independent series)',
      category: 'structure',
      gate: 'numerics',
    },
    defect,
    config.analyticTolerance,
    'The closed-form propagator agrees with an independent scaling-and-squaring Taylor exponential of the same frozen H. This verifies exact propagation of each frozen step only; it says nothing about the error of freezing a time-dependent H.'
  );
}

/** Shared by the audit and by the workbench sweep, whose first sample is g = 0. */
export function zeroCouplingResult(maxDivergence: number, controlTolerance: number): VerificationResult {
  return checkAtMost(
    { id: 'g-zero-reduction', label: 'g = 0 baseline collapse', category: 'control', gate: 'model' },
    maxDivergence,
    controlTolerance,
    'With the coupling removed — fields and drive left on — the proposed branch must reproduce established QM at every step.'
  );
}

export function checkZeroCouplingReduction(config: TwoSiteCheckConfig): VerificationResult {
  return zeroCouplingResult(run({ ...config.params, g: 0 }, config).maxDivergence, config.controlTolerance);
}

/** A common field value guaranteed non-zero, so the null is not vacuous. */
function commonField(p: RealitySplitParams): number {
  return 0.5 + Math.max(Math.abs(p.phiA), Math.abs(p.phiB));
}

export function checkCommonModeStaticNull(config: TwoSiteCheckConfig): VerificationResult {
  const meta = {
    id: 'uniform-field-null-static',
    label: 'Uniform static field: population null',
    category: 'control' as const,
    gate: 'model' as const,
  };
  if (config.params.g === 0) return notApplicable(meta, 'No non-zero coupling sampled; the null would be vacuous.');
  const c = commonField(config.params);
  const t = run({ ...config.params, phiA: c, phiB: c, driveAmplitude: 0 }, config);
  return checkAtMost(
    meta,
    t.maxDivergence,
    config.controlTolerance,
    `φ_A = φ_B = ${c.toFixed(3)} adds g·c·I to H: a global phase only, so populations must not move.`
  );
}

/** A common-mode DRIVEN field. Reality Split's drive is antisymmetric, so this uses the step function directly. */
export function checkCommonModeDrivenNull(config: TwoSiteCheckConfig): VerificationResult {
  const p = config.params;
  const meta = {
    id: 'uniform-field-null-driven',
    label: 'Uniform driven field: population null',
    category: 'control' as const,
    gate: 'model' as const,
  };
  if (p.g === 0) return notApplicable(meta, 'No non-zero coupling sampled; the null would be vacuous.');
  const c = commonField(p);
  const amplitude = p.driveAmplitude !== 0 ? Math.abs(p.driveAmplitude) : 0.5;
  const steps = Math.max(1, Math.round(config.duration / config.dt));
  let std: TwoSiteStateVector = { cA: { re: 1, im: 0 }, cB: { re: 0, im: 0 } };
  let mod: TwoSiteStateVector = std;
  let worst = 0;
  for (let step = 1; step <= steps; step += 1) {
    const phi = c + amplitude * Math.sin(p.driveOmega * (step - 0.5) * config.dt);
    const a = evolveTwoSiteState(std, { EA: p.EA, EB: p.EB, phiA: 0, phiB: 0, g: 0, delta: p.delta }, config.dt);
    const b = evolveTwoSiteState(mod, { EA: p.EA, EB: p.EB, phiA: phi, phiB: phi, g: p.g, delta: p.delta }, config.dt);
    std = a.state;
    mod = b.state;
    worst = Math.max(worst, Math.abs(a.PB - b.PB));
  }
  return checkAtMost(
    meta,
    worst,
    config.controlTolerance,
    `φ_A(t) = φ_B(t) = ${c.toFixed(3)} + ${amplitude.toFixed(3)} sin ωt. A time-dependent multiple of the identity commutes with H, so even a driven common field is a pure phase.`
  );
}

/** The non-null sector of a uniform field: it must appear as exactly e^{−igcT}. */
export function checkUniformFieldGlobalPhase(config: TwoSiteCheckConfig): VerificationResult {
  const meta = {
    id: 'uniform-field-global-phase',
    label: 'Uniform field acts as a pure global phase',
    category: 'invariant' as const,
    gate: 'model' as const,
  };
  if (config.params.g === 0) return notApplicable(meta, 'No non-zero coupling sampled.');
  const c = commonField(config.params);
  const t = run({ ...config.params, phiA: c, phiB: c, driveAmplitude: 0 }, config);
  const s = t.finalStandard;
  const m = t.finalModel;
  // ⟨ψ_std|ψ_model⟩
  const re = s.cA.re * m.cA.re + s.cA.im * m.cA.im + s.cB.re * m.cB.re + s.cB.im * m.cB.im;
  const im = s.cA.re * m.cA.im - s.cA.im * m.cA.re + s.cB.re * m.cB.im - s.cB.im * m.cB.re;
  const phase = -config.params.g * c * t.duration;
  const defect = Math.hypot(re - Math.cos(phase), im - Math.sin(phase));
  return checkAtMost(
    meta,
    defect,
    1e3 * config.analyticTolerance,
    `⟨ψ_std(T)|ψ_model(T)⟩ must equal e^{−igcT} (T = ${t.duration}). The uniform field is not "nothing": it shifts absolute energies and the global phase, neither of which a population measurement sees.`
  );
}

export function checkZeroMixingLimit(config: TwoSiteCheckConfig): VerificationResult {
  const t = run({ ...config.params, delta: 0 }, config);
  let worst = 0;
  for (const f of t.frames) worst = Math.max(worst, f.standard.PB, f.model.PB);
  return checkAtMost(
    { id: 'zero-mixing-limit', label: 'Δ = 0: no population transfer', category: 'limit', gate: 'model' },
    worst,
    config.controlTolerance,
    'With Δ = 0 the Hamiltonian is diagonal, so from |A⟩ both branches must keep P_B ≡ 0 whatever g and φ(t) do. (Δ = 0 lies outside the workbench input domain; this checks the implementation limit.)'
  );
}

export function checkCouplingSignSymmetry(config: TwoSiteCheckConfig): VerificationResult {
  const meta = {
    id: 'equal-energy-sign-symmetry',
    label: 'E_A = E_B: P_B invariant under g → −g',
    category: 'symmetry' as const,
    gate: 'model' as const,
  };
  if (config.params.EA !== config.params.EB) {
    return notApplicable(meta, 'E_A ≠ E_B breaks the σ_x exchange symmetry; no sign invariance is expected.');
  }
  if (config.params.g === 0) return notApplicable(meta, 'No non-zero coupling sampled.');
  const plus = run(config.params, config);
  const minus = run({ ...config.params, g: -config.params.g }, config);
  let worst = 0;
  plus.frames.forEach((f, i) => {
    worst = Math.max(worst, Math.abs(f.model.PB - minus.frames[i].model.PB));
  });
  return checkAtMost(
    meta,
    worst,
    config.analyticTolerance,
    'σ_x H(g) σ_x = H(−g) + const·I and |U_AB| = |U_BA| for any 2×2 unitary, so populations from |A⟩ cannot depend on the sign of g. Consequence: the sign of g is not identifiable from P_B when E_A = E_B.'
  );
}

/** Rabi closed form P_B(t) = (4Δ²/Ω²) sin²(Ωt/2), Ω = √(δ² + 4Δ²). */
export function rabiPB(detuning: number, delta: number, t: number): number {
  const omega = Math.hypot(detuning, 2 * delta);
  if (omega === 0) return 0;
  return ((4 * delta * delta) / (omega * omega)) * Math.sin((omega * t) / 2) ** 2;
}

function maxRabiError(t: RealitySplitTrajectory, branch: 'standard' | 'model', detuning: number, delta: number) {
  let worst = 0;
  for (const f of t.frames) worst = Math.max(worst, Math.abs(f[branch].PB - rabiPB(detuning, delta, f.t)));
  return worst;
}

export function checkBaselineClosedForm(config: TwoSiteCheckConfig): VerificationResult {
  const p = config.params;
  const t = run(p, config);
  return checkAtMost(
    {
      id: 'baseline-rabi-closed-form',
      label: 'Established branch = Rabi closed form',
      category: 'limit',
      gate: 'numerics',
    },
    maxRabiError(t, 'standard', p.EB - p.EA, p.delta),
    config.analyticTolerance,
    p.EA === p.EB
      ? 'E_A = E_B: the baseline must follow P_B(t) = sin²(Δt) exactly, with no discretisation error (static H).'
      : 'Static baseline must follow P_B(t) = (4Δ²/Ω²) sin²(Ωt/2) exactly.'
  );
}

export function checkStaticModelClosedForm(config: TwoSiteCheckConfig): VerificationResult {
  const p = { ...config.params, driveAmplitude: 0 };
  const t = run(p, config);
  const detuning = p.EB - p.EA + p.g * (p.phiB - p.phiA);
  return checkAtMost(
    {
      id: 'static-model-closed-form',
      label: 'Static proposed branch = Rabi closed form',
      category: 'limit',
      gate: 'model',
    },
    maxRabiError(t, 'model', detuning, p.delta),
    config.analyticTolerance,
    `With the drive off the proposed branch is static, so P_B(t) must follow the Rabi formula with δ = (E_B − E_A) + g(φ_B − φ_A) = ${detuning.toFixed(4)} ε₀.`
  );
}

export function checkStaticDetuningDegeneracy(config: TwoSiteCheckConfig): VerificationResult {
  const p = config.params;
  const meta = {
    id: 'static-detuning-degeneracy',
    label: 'Static coupling indistinguishable from bare detuning',
    category: 'identifiability' as const,
    gate: 'empirical' as const,
  };
  if (p.g === 0 || p.phiA === p.phiB) {
    return notApplicable(meta, 'No static field contrast is coupled in this run.');
  }
  const model = run({ ...p, driveAmplitude: 0 }, config);
  const relabelled = run({ ...p, EA: p.EA + p.g * p.phiA, EB: p.EB + p.g * p.phiB, g: 0, driveAmplitude: 0 }, config);
  let worst = 0;
  model.frames.forEach((f, i) => {
    worst = Math.max(worst, Math.abs(f.model.PB - relabelled.frames[i].standard.PB));
  });
  const degenerate = worst <= config.analyticTolerance;
  return {
    ...meta,
    source: 'executed',
    // Confirming the degeneracy is not a success for the model: it is a limit
    // on what any static population measurement can say about g.
    status: degenerate ? 'warning' : 'fail',
    measured: worst,
    tolerance: config.analyticTolerance,
    explanation: degenerate
      ? 'The static proposed trajectory equals established QM with E_A → E_A + gφ_A, E_B → E_B + gφ_B. A static measurement cannot separate g(φ_B − φ_A) from an uncalibrated bare detuning; only a controlled change of φ with independently calibrated E_B − E_A can.'
      : 'The static coupling did more than shift bare energies — the implementation departs from the declared Hamiltonian.',
  };
}

export function checkTwoSiteDensityRendering(
  config: TwoSiteCheckConfig,
  trajectory: RealitySplitTrajectory
): VerificationResult {
  const peak = trajectory.frames.reduce((a, b) => (b.traceDistance > a.traceDistance ? b : a));
  const gridSize = 240;
  const field = computeDivergenceField('two_site', config.params, peak, gridSize);
  const dx = 2 / (gridSize - 1);
  const sum = (v: number[]) => v.reduce((acc, x) => acc + x, 0) * dx;
  const defect = Math.max(
    Math.abs(sum(field.rhoStandard) - 1),
    Math.abs(sum(field.rhoModel) - 1),
    Math.abs(sum(field.divergence))
  );
  const dataProcessingOk = field.l1 <= 2 * peak.traceDistance + 1e-9;
  const result = checkAtMost(
    {
      id: 'density-rendering-normalization',
      label: 'Spatial density normalisation (two-site rendering)',
      category: 'conservation',
      gate: 'numerics',
    },
    defect,
    1e-9,
    `At the peak frame both rendered densities integrate to 1 and the divergence field to 0; its L1 norm ${field.l1.toFixed(4)} ≤ 2D = ${(2 * peak.traceDistance).toFixed(4)} (coarse-graining cannot add distinguishability). The Gaussian well shapes are a rendering choice, not part of the model.`
  );
  return dataProcessingOk ? result : { ...result, status: 'fail', explanation: `Data-processing bound violated. ${result.explanation}` };
}
