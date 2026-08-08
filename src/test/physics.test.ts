import { describe, it, expect } from 'vitest';
import {
  bornProbabilities,
  twoSiteModel,
  barrierTransmission,
  wernerConcurrence,
  teleportationFidelity,
  localizationKernel,
  observedLocalizationDensity,
  evolveTwoSiteState,
  compareModels,
} from '../lib/physics';
import { searchAnomalies } from '../lib/anomalyEngine';

describe('Scientific Invariant Tests for Waveform Shift Quantum Laboratory', () => {
  it('Born probabilities normalize to 1 (P0 + P1 ≈ 1)', () => {
    const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI];
    for (const theta of angles) {
      const { p0, p1 } = bornProbabilities(theta);
      expect(p0 + p1).toBeCloseTo(1.0, 10);
      expect(p0).toBeGreaterThanOrEqual(0);
      expect(p1).toBeGreaterThanOrEqual(0);
    }
  });

  it('Two-site model eigenstate populations normalize to 1 (PA + PB ≈ 1)', () => {
    const paramsList = [
      { EA: 1.0, EB: 1.0, phiA: -0.5, phiB: 0.5, g: 0.8, delta: 0.25 },
      { EA: 0.5, EB: 1.5, phiA: -1.2, phiB: 1.2, g: 1.5, delta: 0.1 },
      { EA: 2.0, EB: 2.0, phiA: 0.0, phiB: 0.0, g: 0.0, delta: 0.5 },
    ];

    for (const params of paramsList) {
      const { PA, PB, norm } = twoSiteModel(params);
      expect(PA + PB).toBeCloseTo(1.0, 10);
      expect(PA).toBeGreaterThanOrEqual(0);
      expect(PB).toBeGreaterThanOrEqual(0);
      expect(norm).toBeGreaterThanOrEqual(0);
    }
  });

  it('Observed localization density normalizes to 1 (Σ Ploc ≈ 1)', () => {
    const PB_array = [0.1, 0.25, 0.3, 0.25, 0.1];
    const kernel_array = [
      { L: 0.2, chi: Math.exp(1.0 * 0.2) },
      { L: 0.5, chi: Math.exp(1.0 * 0.5) },
      { L: 0.9, chi: Math.exp(1.0 * 0.9) },
      { L: 0.5, chi: Math.exp(1.0 * 0.5) },
      { L: 0.2, chi: Math.exp(1.0 * 0.2) },
    ];

    const { Ploc } = observedLocalizationDensity(PB_array, kernel_array);
    const sumPloc = Ploc.reduce((acc, val) => acc + val, 0);
    expect(sumPloc).toBeCloseTo(1.0, 10);
  });

  it('Barrier transmission coefficient T satisfies 0 ≤ T ≤ 1', () => {
    const testCases = [
      { E: 1.0, V: 2.0, a: 0.4 }, // Tunneling regime
      { E: 2.0, V: 2.0, a: 0.4 }, // Resonant regime
      { E: 3.0, V: 2.0, a: 0.4 }, // Oscillatory regime
    ];

    for (const { E, V, a } of testCases) {
      const { T } = barrierTransmission(E, V, a);
      expect(T).toBeGreaterThanOrEqual(0);
      expect(T).toBeLessThanOrEqual(1.0);
    }
  });

  it('Werner concurrence collapses to C = 0 when purity p ≤ 1/3', () => {
    expect(wernerConcurrence(1 / 3)).toBe(0);
    expect(wernerConcurrence(0.2)).toBe(0);
    expect(wernerConcurrence(0.0)).toBe(0);
    expect(wernerConcurrence(1.0)).toBe(1.0);
    expect(wernerConcurrence(0.6)).toBeCloseTo(0.4, 10);
  });

  it('Ideal teleportation fidelity approaches 1 under ideal conditions', () => {
    const idealFidelity = teleportationFidelity(1.0, 0.0);
    expect(idealFidelity).toBeCloseTo(1.0, 10);
  });

  it('Zero localization response α → 0 reproduces unmodified Born distribution', () => {
    const kernelAlpha0 = localizationKernel({
      omega0: 10.0,
      beta: 0.5,
      kappa: 0.1,
      phi: 1.2,
      d2phi: 0.2,
      omega_w: 12.0,
      gamma: 1.5,
      alpha: 0.0, // Zero response strength
    });

    expect(kernelAlpha0.chi).toBe(1.0);

    const PB_array = [0.2, 0.6, 0.2];
    const kernel_array = [
      { L: 0.5, chi: 1.0 },
      { L: 0.8, chi: 1.0 },
      { L: 0.5, chi: 1.0 },
    ];

    const { Ploc, deltaP } = observedLocalizationDensity(PB_array, kernel_array);

    for (let i = 0; i < PB_array.length; i++) {
      expect(Ploc[i]).toBeCloseTo(PB_array[i], 10);
      expect(deltaP[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('Zero coupling g → 0 removes field-induced modification', () => {
    const twoSiteZeroG = twoSiteModel({
      EA: 1.0,
      EB: 1.0,
      phiA: -1.5,
      phiB: 1.5,
      g: 0.0, // Zero matter-scalar coupling
      delta: 0.25,
    });

    const bareTwoSite = twoSiteModel({
      EA: 1.0,
      EB: 1.0,
      phiA: 0.0,
      phiB: 0.0,
      g: 0.0,
      delta: 0.25,
    });

    expect(twoSiteZeroG.detuning).toBe(bareTwoSite.detuning);
    expect(twoSiteZeroG.PA).toBeCloseTo(bareTwoSite.PA, 10);
    expect(twoSiteZeroG.PB).toBeCloseTo(bareTwoSite.PB, 10);
  });

  it('Numerical time evolution state norm remains ≈ 1 (|cA|² + |cB|² = 1)', () => {
    let state = { cA: { re: 1.0, im: 0.0 }, cB: { re: 0.0, im: 0.0 } };
    const params = { EA: 1.0, EB: 1.0, phiA: -0.5, phiB: 0.5, g: 0.8, delta: 0.25 };
    const dt = 0.01;

    for (let step = 0; step < 100; step++) {
      const res = evolveTwoSiteState(state, params, dt);
      state = res.state;
      expect(res.norm).toBeCloseTo(1.0, 8);
      expect(res.PA + res.PB).toBeCloseTo(1.0, 8);
    }
  });

  it('Anomaly Engine produces deterministic results for fixed seed and parameters', () => {
    const run1 = searchAnomalies({ seed: 42, iterations: 100 });
    const run2 = searchAnomalies({ seed: 42, iterations: 100 });

    expect(run1.length).toBeGreaterThan(0);
    expect(run1.length).toBe(run2.length);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].id).toBe(run2[i].id);
      expect(run1[i].score).toBe(run2[i].score);
      expect(run1[i].deltaP).toBe(run2[i].deltaP);
      expect(run1[i].parameters).toEqual(run2[i].parameters);
    }
  });
});
