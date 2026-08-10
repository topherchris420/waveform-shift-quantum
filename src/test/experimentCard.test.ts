import { describe, it, expect } from 'vitest';
import {
  buildExperimentCard,
  classifyTestability,
  DETECTION_SIGMA,
  experimentCardToCSV,
  modelValidity,
  requiredShotsFor,
  toObservableUnits,
} from '../lib/experimentCard';
import {
  getPlatform,
  PLATFORMS,
  platformPracticalFloor,
  platformResolution,
} from '../lib/platforms';
import type { AnomalyParameters } from '../lib/anomalyEngine';

const atom = getPlatform('atom_interferometer')!;
const transmon = getPlatform('transmon_circuit')!;

const regime: AnomalyParameters = {
  g: 1.2,
  delta: 0.3,
  phiA: -1.0,
  phiB: 1.0,
  alpha: 1.1,
  gamma: 1.5,
  omega_w: 12,
};

describe('Platform noise model', () => {
  it('improves with shots but never falls below the systematic floor', () => {
    for (const platform of PLATFORMS) {
      const few = platformResolution(platform, 10);
      const many = platformResolution(platform, 1e9);

      expect(many).toBeLessThan(few);
      expect(many).toBeGreaterThanOrEqual(platform.systematicFloor);
      expect(platformPracticalFloor(platform)).toBeGreaterThanOrEqual(platform.systematicFloor);
    }
  });

  it('reduces statistical error as 1/√N', () => {
    const oneShot = atom.singleShotResolution;
    const hundred = platformResolution(atom, 100);
    // Statistical term only; the systematic floor is far below it here.
    expect(hundred).toBeCloseTo(Math.hypot(oneShot / 10, atom.systematicFloor), 12);
  });
});

describe('Required precision and shot budget', () => {
  it('demands 1σ precision of |Δ|/nσ for a detection', () => {
    const card = buildExperimentCard('two_site', regime, atom);
    expect(card.requiredPrecision).toBeCloseTo(Math.abs(card.delta) / DETECTION_SIGMA, 12);
  });

  it('scales the required shots as 1/Δ² while statistics-limited', () => {
    const n1 = requiredShotsFor(atom, 1e-2);
    const n2 = requiredShotsFor(atom, 5e-3);
    // Halving the separation quadruples the shots needed.
    expect(n2 / n1).toBeGreaterThan(3.8);
    expect(n2 / n1).toBeLessThan(4.2);
  });

  it('returns an infinite shot budget once the target sits under the systematic floor', () => {
    // A 5σ result needs 1σ precision of |Δ|/5. Below the systematic floor no
    // amount of averaging suffices, so the answer must be Infinity, not a
    // large-but-finite number that would imply the experiment is merely hard.
    const belowFloor = atom.systematicFloor * DETECTION_SIGMA * 0.5;
    expect(requiredShotsFor(atom, belowFloor)).toBe(Infinity);
    expect(classifyTestability(atom, belowFloor).testability).toBe('below_systematic_floor');
  });

  it('classifies a comfortably resolvable separation as testable now', () => {
    const { testability, requiredShots } = classifyTestability(atom, 5e-2);
    expect(testability).toBe('testable_now');
    expect(requiredShots).toBeLessThanOrEqual(atom.practicalShots);
  });

  it('flags separations that exceed the practical shot budget', () => {
    // Fractionally above the systematic floor: resolvable in principle, but
    // only with far more shots than a real campaign provides. The margin has to
    // be tiny because required shots blow up as 1/(target² − σ_sys²).
    const marginal = transmon.systematicFloor * DETECTION_SIGMA * 1.000001;
    const { testability, requiredShots } = classifyTestability(transmon, marginal);
    expect(Number.isFinite(requiredShots)).toBe(true);
    expect(testability).toBe('needs_more_integration');
    expect(requiredShots).toBeGreaterThan(transmon.practicalShots);
  });
});

describe('Observable units', () => {
  it('leaves probability-valued comparisons untouched', () => {
    expect(toObservableUnits('two_site', 0.42)).toBe(0.42);
    expect(toObservableUnits('teleportation', 0.9)).toBe(0.9);
  });

  it('maps the unbounded kernel factor onto a bounded density contrast', () => {
    // χ = 1 is the no-effect baseline and must map to exactly zero contrast.
    expect(toObservableUnits('scalar_kernel', 1)).toBe(0);
    // The contrast is bounded below 1 no matter how large χ becomes, so it can
    // be compared against a platform noise floor without inventing significance.
    expect(toObservableUnits('scalar_kernel', Math.exp(3))).toBeLessThan(1);
    expect(toObservableUnits('scalar_kernel', 1e6)).toBeLessThan(1);
    // Weak-response limit: (χ−1)/(χ+1) → αL/2 as αL → 0.
    const alphaL = 1e-4;
    expect(toObservableUnits('scalar_kernel', Math.exp(alphaL))).toBeCloseTo(alphaL / 2, 8);
  });

  it('keeps every card separation inside the observable range', () => {
    for (const type of ['two_site', 'scalar_kernel']) {
      const card = buildExperimentCard(type, { ...regime, alpha: 3 }, atom);
      expect(Math.abs(card.delta)).toBeLessThanOrEqual(1);
      expect(card.standardPrediction).toBeGreaterThanOrEqual(0);
      expect(card.standardPrediction).toBeLessThanOrEqual(1);
      expect(card.modelPrediction).toBeGreaterThanOrEqual(0);
      expect(card.modelPrediction).toBeLessThanOrEqual(1);
    }
  });
});

describe('Model domain of validity', () => {
  it('treats the exactly-diagonalized two-site model as always in-domain', () => {
    expect(modelValidity('two_site', { alpha: 2.9 })).toBe('perturbative');
  });

  it('flags kernel regimes beyond the weak-response expansion', () => {
    expect(modelValidity('scalar_kernel', { alpha: 0.5 })).toBe('perturbative');
    expect(modelValidity('scalar_kernel', { alpha: 1 })).toBe('perturbative');
    expect(modelValidity('scalar_kernel', { alpha: 1.8 })).toBe('extrapolated');
  });

  it('says so on the card when a prediction is an extrapolation', () => {
    const card = buildExperimentCard('scalar_kernel', { ...regime, alpha: 2.8 }, atom);
    expect(card.modelValidity).toBe('extrapolated');
    expect(card.falsificationCondition).toContain('extrapolation');
  });
});

describe('Experiment card', () => {
  it('carries both predictions, the uncertainty budget and a falsification condition', () => {
    const card = buildExperimentCard('two_site', regime, atom);

    expect(card.standardPrediction).toBeGreaterThanOrEqual(0);
    expect(card.modelPrediction).toBeGreaterThanOrEqual(0);
    expect(card.delta).toBeCloseTo(card.modelPrediction - card.standardPrediction, 12);

    expect(card.uncertainty.total).toBeGreaterThan(0);
    expect(card.uncertainty.total).toBeGreaterThanOrEqual(card.uncertainty.systematic);
    expect(card.uncertainty.total).toBeCloseTo(
      Math.hypot(card.uncertainty.statistical, card.uncertainty.systematic),
      12
    );

    expect(card.falsificationCondition).toMatch(/FALSIFIED|Not falsifiable/);
    expect(card.controls.length).toBeGreaterThan(0);
    expect(card.confounders.length).toBeGreaterThan(0);
    expect(card.observable.length).toBeGreaterThan(0);
  });

  it('computes significance as |Δ| divided by the total uncertainty', () => {
    const card = buildExperimentCard('two_site', regime, atom);
    expect(card.significance).toBeCloseTo(Math.abs(card.delta) / card.uncertainty.total, 9);
  });

  it('states plainly when a null result would constrain nothing', () => {
    // A regime with no field gradient produces no separation at all.
    const flat: AnomalyParameters = { ...regime, phiA: 0, phiB: 0 };
    const card = buildExperimentCard('two_site', flat, atom);

    expect(Math.abs(card.delta)).toBeLessThan(1e-12);
    expect(card.testability).toBe('below_systematic_floor');
    expect(card.falsificationCondition).toContain('Not falsifiable');
  });

  it('is reproducible from its seed and exports every field to CSV', () => {
    const a = buildExperimentCard('two_site', regime, atom, { seed: 99, id: 'FIXED' });
    const b = buildExperimentCard('two_site', regime, atom, { seed: 99, id: 'FIXED' });

    expect(a.id).toBe(b.id);
    expect(a.delta).toBe(b.delta);
    expect(a.requiredShots).toBe(b.requiredShots);

    const csv = experimentCardToCSV(a);
    expect(csv.split('\n')[0]).toBe('field,value');
    for (const field of [
      'established_physics_prediction',
      'proposed_model_prediction',
      'sigma_total',
      'required_precision_1sigma',
      'required_shots',
      'falsification_condition',
      'param_g',
    ]) {
      expect(csv).toContain(field);
    }
  });
});
