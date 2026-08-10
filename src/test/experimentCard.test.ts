import { describe, it, expect } from 'vitest';
import {
  buildExperimentCard,
  classifyTestability,
  DETECTION_SIGMA,
  experimentCardToCSV,
  modelValidity,
  requiredShotsFor,
  resolvePredictions,
} from '../lib/experimentCard';
import { compareModels } from '../lib/physics';
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

describe('Resolved predictions', () => {
  const comparisonFor = (type: string, params: AnomalyParameters) => compareModels(type, params);

  it('passes probability-valued comparisons straight through', () => {
    const cmp = comparisonFor('two_site', regime);
    const resolved = resolvePredictions('two_site', regime, cmp);
    expect(resolved.standard).toBe(cmp.standardQM);
    expect(resolved.model).toBe(cmp.woodyardModel);
  });

  it('predicts exactly zero separation for a spatially flat scalar field', () => {
    // The kernel model's observable is the NORMALIZED density
    // P_loc = χP_B/∫χP_B, in which a constant χ cancels completely. Reading the
    // separation off a single χ value reported ~0.1 here, which the model says
    // is not there at all.
    const flat: AnomalyParameters = { ...regime, phiA: 0.9, phiB: 0.9, alpha: 1.0 };
    const resolved = resolvePredictions('scalar_kernel', flat, comparisonFor('scalar_kernel', flat));
    expect(Math.abs(resolved.delta)).toBeLessThan(1e-12);
  });

  it('predicts exactly zero separation when the response strength is off', () => {
    const off: AnomalyParameters = { ...regime, phiA: -1.5, phiB: 1.5, alpha: 0 };
    const resolved = resolvePredictions('scalar_kernel', off, comparisonFor('scalar_kernel', off));
    expect(Math.abs(resolved.delta)).toBeLessThan(1e-12);
  });

  it('predicts a real, monotone separation for a genuine field gradient', () => {
    const at = (alpha: number) => {
      const p: AnomalyParameters = { ...regime, phiA: -1.5, phiB: 1.5, alpha };
      return resolvePredictions('scalar_kernel', p, comparisonFor('scalar_kernel', p)).delta;
    };
    // Guards the case where a fabricated Laplacian cancelled the βφ term and
    // pinned ω_loc at ω₀, leaving the kernel spatially flat and the field dead.
    expect(at(1.0)).toBeGreaterThan(1e-3);
    expect(at(1.0)).toBeGreaterThan(at(0.3));
    expect(at(0.3)).toBeGreaterThan(at(0.05));
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

  it('states the falsification test at the required precision, not the practical one', () => {
    // The old rule declared the model falsified whenever a result fell within
    // nσ·σ_total of the standard prediction. For a needs_more_integration card
    // |Δ| < nσ·σ_total by construction, so a measurement landing exactly ON the
    // proposed prediction satisfied it — the card described its own prediction
    // as falsifying itself. The test must be anchored to σ* = |Δ|/n instead.
    const marginal = transmon.systematicFloor * DETECTION_SIGMA * 1.000001;
    const card = buildExperimentCard('two_site', regime, transmon, {
      comparison: {
        standardQM: 0.5,
        woodyardModel: 0.5 + marginal,
        delta: marginal,
        percentDeviation: 100 * (marginal / 0.5),
        observableName: 'Site B Occupation Probability PB',
        assumptions: [],
        scientificStatus: 'Proposed',
        falsificationCondition: '',
      },
    });

    expect(card.testability).toBe('needs_more_integration');
    // Anchored to the required precision, and honest that the practical budget
    // cannot discriminate the two models at all.
    expect(card.falsificationCondition).toContain(card.requiredPrecision.toExponential(2));
    expect(card.falsificationCondition).toContain('cannot discriminate');
    // It must name the PROPOSED prediction as the thing being excluded, not
    // only the baseline.
    expect(card.falsificationCondition).toContain(card.modelPrediction.toFixed(6));
    expect(card.falsificationCondition).toContain('survives only if');
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
