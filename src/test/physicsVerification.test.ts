import { describe, expect, it } from 'vitest';
import { DEFAULT_SPLIT_PARAMS, simulateRealitySplit, type RealitySplitParams } from '../lib/realitySplit';
import { evolveTwoSiteState, twoSiteHamiltonian, twoSiteModel } from '../lib/physics';
import { RESEARCH_STATUSES } from '../lib/epistemics';
import { TWO_SITE_UNITS, type UnitDeclaration } from '../lib/units';
import {
  assessRun,
  checkAlphaZeroReduction,
  checkAtMost,
  checkBaselineClosedForm,
  checkCalibrationClaims,
  checkCommonModeDrivenNull,
  checkCommonModeStaticNull,
  checkConstantKernelCancels,
  checkCouplingSignSymmetry,
  checkDimensionalConsistency,
  checkFinite,
  checkFlatFieldNull,
  checkHermitian2x2,
  checkKernelDensityNormalization,
  checkNormalization,
  checkPropagatorAgainstExpm,
  checkPropagatorUnitarity,
  checkStaticDetuningDegeneracy,
  checkStaticModelClosedForm,
  checkUniformFieldGlobalPhase,
  checkUnitLabels,
  checkWeakResponseDomain,
  checkZeroCouplingReduction,
  checkZeroMixingLimit,
  classifyLadder,
  convergenceChecks,
  metadataWarning,
  runTimestepLadder,
  summarizeLadders,
  unitSpecificationWarning,
  type TwoSiteCheckConfig,
  type VerificationResult,
} from '../quantum/validation';
import { expmMinusIHdt as expm } from '../quantum/validation/linalg';

const params = (o: Partial<RealitySplitParams> = {}): RealitySplitParams => ({
  ...DEFAULT_SPLIT_PARAMS,
  EA: 1,
  EB: 1,
  g: 1.6,
  phiA: -0.6,
  phiB: 0.6,
  delta: 0.25,
  driveAmplitude: 0.4,
  driveOmega: 1.5,
  ...o,
});
const config = (o: Partial<RealitySplitParams> = {}): TwoSiteCheckConfig => ({
  params: params(o),
  duration: 12,
  dt: 0.02,
  controlTolerance: 1e-12,
  analyticTolerance: 1e-10,
});
const meta = { id: 'x', label: 'x', category: 'structure', gate: 'numerics' } as const;

describe('structured verification primitives', () => {
  it('return results instead of throwing, and fail on non-finite input', () => {
    expect(checkAtMost(meta, 1e-13, 1e-12, '').status).toBe('pass');
    expect(checkAtMost(meta, 1e-11, 1e-12, '').status).toBe('fail');
    expect(checkAtMost(meta, Number.NaN, 1, '').status).toBe('fail');
    expect(checkAtMost(meta, Number.POSITIVE_INFINITY, 1, '').status).toBe('fail');
    expect(checkFinite(meta, [1, 2, Number.NaN]).status).toBe('fail');
    expect(checkNormalization(meta, [0.4, 0.6]).status).toBe('pass');
    expect(checkNormalization(meta, [0.4, 0.5]).status).toBe('fail');
    expect(checkNormalization(meta, [1.2, -0.2]).status).toBe('fail');
  });

  it('detect a non-Hermitian matrix', () => {
    expect(checkHermitian2x2(meta, twoSiteHamiltonian({ EA: 1, EB: 2, phiA: 0.3, phiB: -1, g: 2, delta: 0.4 })).status).toBe('pass');
    expect(checkHermitian2x2(meta, [[1, 0.4], [0.5, 2]]).status).toBe('fail');
    expect(checkHermitian2x2(meta, [[1, 0.4, 0], [0.4, 2, 0]]).status).toBe('fail');
  });

  it('metadata can warn but never pass', () => {
    expect(metadataWarning(meta, 'declared').status).toBe('warning');
    expect(unitSpecificationWarning(TWO_SITE_UNITS)).toMatchObject({ status: 'warning', source: 'metadata' });
  });
});

describe('two-site propagation', () => {
  it('matches an independent matrix exponential and is unitary for every frozen step', () => {
    expect(checkPropagatorAgainstExpm(config()).status).toBe('pass');
    expect(checkPropagatorUnitarity(config({ g: 2, driveAmplitude: 1 })).status).toBe('pass');
    // The reference exponential is itself checked against a known closed form:
    // for H = Δσ_x, exp(−iHt) = cos(Δt)I − i sin(Δt)σ_x.
    const U = expm([[0, 0.7], [0.7, 0]], 1.3);
    expect(U.re[0][0]).toBeCloseTo(Math.cos(0.91), 14);
    expect(U.im[0][1]).toBeCloseTo(-Math.sin(0.91), 14);
  });

  it('is exact for a static Hamiltonian and only second-order accurate when driven', () => {
    // Static: the whole trajectory follows the Rabi closed form to rounding error.
    expect(checkBaselineClosedForm(config()).measured).toBeLessThan(1e-12);
    expect(checkStaticModelClosedForm(config()).measured).toBeLessThan(1e-12);
    const staticLadder = runTimestepLadder(params({ driveAmplitude: 0 }), 12, 0.02);
    expect(classifyLadder(...staticLadder.errors.PB, 1e-10, 1.5).regime).toBe('roundoff');
    // Driven: midpoint freezing is an approximation whose error falls ~4× per halving.
    const driven = runTimestepLadder(params(), 12, 0.02);
    const [e1, e2] = driven.errors.PB;
    expect(e1).toBeGreaterThan(1e-7);
    const { regime, observedOrder } = classifyLadder(e1, e2, 1e-10, 1.5);
    expect(regime).toBe('asymptotic');
    expect(observedOrder).toBeGreaterThan(1.9);
    expect(observedOrder).toBeLessThan(2.1);
  });

  it('flags a ladder whose error does not shrink', () => {
    expect(classifyLadder(1e-4, 2e-4, 1e-10, 1.5).regime).toBe('not_converging');
    expect(classifyLadder(1e-4, 7e-5, 1e-10, 1.5).regime).toBe('pre_asymptotic');
    const bad = convergenceChecks(
      summarizeLadders(
        [{ coupling: 1, ladder: { PA: [1e-4, 2e-4], PB: [1e-4, 2e-4], traceDistance: [0, 0], maxDivergence: [0, 0], meanDivergence: [0, 0], coherence: [0, 0] } }],
        1e-10,
        1.5
      ),
      1e-3,
      1.5
    );
    expect(bad.find((c) => c.id === 'convergence-trend')?.status).toBe('fail');
  });
});

describe('two-site limiting cases (derived, then encoded)', () => {
  it('g = 0 collapses the split', () => {
    expect(checkZeroCouplingReduction(config({ phiA: -1.8, phiB: 1.7, driveAmplitude: 1 })).status).toBe('pass');
  });

  it('a uniform field — static or driven — moves no population', () => {
    expect(checkCommonModeStaticNull(config()).status).toBe('pass');
    expect(checkCommonModeDrivenNull(config()).status).toBe('pass');
  });

  it('a uniform field is not "nothing": it shifts energies and the global phase', () => {
    expect(checkUniformFieldGlobalPhase(config()).status).toBe('pass');
    const shifted = twoSiteModel({ EA: 1, EB: 1, phiA: 0.9, phiB: 0.9, g: 1.5, delta: 0.25 });
    const bare = twoSiteModel({ EA: 1, EB: 1, phiA: 0, phiB: 0, g: 0, delta: 0.25 });
    expect(shifted.E_minus - bare.E_minus).toBeCloseTo(1.5 * 0.9, 12);
    expect(shifted.PB).toBeCloseTo(bare.PB, 12);
  });

  it('the null is specific to a COMMON field: the antisymmetric drive alone does move population', () => {
    // Guards against encoding a null that merely sounds intuitive.
    const t = simulateRealitySplit(params({ phiA: 0, phiB: 0, driveAmplitude: 0.6 }), { duration: 12, dt: 0.02 });
    expect(t.maxDivergence).toBeGreaterThan(1e-3);
  });

  it('Δ = 0 forbids any transfer', () => {
    expect(checkZeroMixingLimit(config({ g: 2, driveAmplitude: 1 })).status).toBe('pass');
  });

  it('E_A = E_B makes populations blind to the sign of g — and only then', () => {
    expect(checkCouplingSignSymmetry(config()).status).toBe('pass');
    expect(checkCouplingSignSymmetry(config({ EB: 1.3 })).status).toBe('not_applicable');
    // Without the symmetry the sign of g does matter: the check is not vacuous.
    const p = params({ EB: 1.3 });
    const plus = simulateRealitySplit(p, { duration: 12, dt: 0.02 });
    const minus = simulateRealitySplit({ ...p, g: -p.g }, { duration: 12, dt: 0.02 });
    const diff = Math.max(...plus.frames.map((f, i) => Math.abs(f.model.PB - minus.frames[i].model.PB)));
    expect(diff).toBeGreaterThan(1e-2);
  });

  it('a static coupling is exactly degenerate with a bare detuning, and is reported as a limit, not a pass', () => {
    const r = checkStaticDetuningDegeneracy(config());
    expect(r.status).toBe('warning');
    expect(r.gate).toBe('empirical');
    expect(checkStaticDetuningDegeneracy(config({ phiA: 0, phiB: 0 })).status).toBe('not_applicable');
  });

  it('a step that is not exp(−iH dt) would be caught', () => {
    // Construct the propagator for a perturbed H and compare against the true one.
    const hp = { EA: 1, EB: 1, phiA: -0.6, phiB: 0.6, g: 1.6, delta: 0.25 };
    const wrong = evolveTwoSiteState({ cA: { re: 1, im: 0 }, cB: { re: 0, im: 0 } }, { ...hp, delta: 0.2501 }, 0.02);
    const ref = expm(twoSiteHamiltonian(hp), 0.02);
    expect(Math.abs(wrong.state.cB.im - ref.im[1][0])).toBeGreaterThan(1e-7);
  });
});

describe('localization-kernel sector', () => {
  const p = params({ alpha: 1.2, gamma: 1.5, omega_w: 12 });
  it('α → 0 recovers the Born density; flat fields and constant kernels cancel', () => {
    expect(checkAlphaZeroReduction(p).status).toBe('pass');
    expect(checkFlatFieldNull(p).status).toBe('pass');
    expect(checkConstantKernelCancels().status).toBe('pass');
    expect(checkKernelDensityNormalization(p).status).toBe('pass');
  });

  it('warns rather than passes outside the weak-response domain', () => {
    expect(checkWeakResponseDomain(0.8).status).toBe('pass');
    expect(checkWeakResponseDomain(1.2).status).toBe('warning');
  });
});

describe('dimensional analysis and unit honesty', () => {
  it('the two-site equations balance and fix only the product gφ', () => {
    expect(checkDimensionalConsistency(TWO_SITE_UNITS).status).toBe('pass');
  });

  it('catches an inconsistent constraint', () => {
    const broken: UnitDeclaration = {
      ...TWO_SITE_UNITS,
      constraints: [{ id: 'bad', statement: '', terms: [[['E_A', 1]], [['g', 1]]] }],
    };
    expect(checkDimensionalConsistency(broken).status).toBe('fail');
  });

  it('refuses seconds under ħ = 1 and calibration without a source', () => {
    const relabelled: UnitDeclaration = {
      ...TWO_SITE_UNITS,
      quantities: TWO_SITE_UNITS.quantities.map((q) => (q.symbol === 't' ? { ...q, simulationUnit: 's' } : q)),
    };
    expect(checkUnitLabels(relabelled).status).toBe('fail');
    expect(checkUnitLabels(TWO_SITE_UNITS).status).toBe('pass');
    const overclaimed: UnitDeclaration = {
      ...TWO_SITE_UNITS,
      quantities: TWO_SITE_UNITS.quantities.map((q) => (q.symbol === 'g' ? { ...q, calibration: 'calibrated' } : q)),
    };
    expect(checkCalibrationClaims(overclaimed).status).toBe('fail');
  });
});

describe('research assessment', () => {
  const ok = (id: string, gate: VerificationResult['gate'], category: VerificationResult['category']): VerificationResult => ({
    id,
    label: id,
    gate,
    category,
    status: 'pass',
    source: 'executed',
    explanation: '',
  });
  const base = [ok('a', 'code', 'structure'), ok('b', 'numerics', 'conservation'), ok('c', 'model', 'control'), ok('d', 'model', 'limit')];
  const input = { maxSeparation: 0.4, effectFloor: 1e-12, numericalUncertainty: 1e-6, declaredResolution: null };
  const fail = (i: number) => base.map((c, j) => (j === i ? { ...c, status: 'fail' as const } : c));

  it('is pessimistic: numerics outrank controls, which outrank any effect', () => {
    expect(assessRun({ ...input, checks: base }).status).toBe('simulation_effect_present');
    expect(assessRun({ ...input, checks: fail(1) }).status).toBe('numerically_unstable');
    expect(assessRun({ ...input, checks: fail(2) }).status).toBe('control_failed');
    expect(assessRun({ ...input, checks: fail(3) }).status).toBe('falsified_in_tested_parameter_region');
    expect(assessRun({ ...input, checks: base, maxSeparation: 0 }).status).toBe('simulation_effect_absent');
    expect(assessRun({ ...input, checks: base, maxSeparation: 5e-6 }).status).toBe('inconclusive');
  });

  it('never claims more than computation can support', () => {
    const a = assessRun({ ...input, checks: fail(3) });
    expect(a.statement).toContain('not an empirical falsification');
    expect(a.gates.find((g) => g.id === 'empirical')?.outcome).toBe('not_evaluable');
    for (const s of Object.values(RESEARCH_STATUSES)) {
      expect(`${s.label} ${s.meaning}`.toLowerCase()).not.toMatch(/\bconfirm/);
    }
    expect(RESEARCH_STATUSES.empirical_result_required.scope).toBe('empirical');
  });
});
