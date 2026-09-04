import { describe, it, expect } from 'vitest';
import {
  computeInterferometerFringes,
  computeRamseyFringes,
  interferometryPhaseShift,
  clockComparisonPhase,
} from '@/lib/physics';

describe('Matter-Wave Interferometry & Ramsey Clock Fringes', () => {
  it('phase shift scales linearly with coupling g, arm separation, and interrogation time', () => {
    // Δφ = (g / ħ) * ∇φ * Δx * T
    const baseParams = {
      armSeparation_um: 10.0,
      interrogationTime_ms: 2.0,
      fieldGradient_per_um: 0.5,
      coupling_g: 1.0,
      dephasingNoise: 0.0,
    };

    const baseResult = computeInterferometerFringes(baseParams, 20);
    // Double coupling g
    const doubleG = computeInterferometerFringes({ ...baseParams, coupling_g: 2.0 }, 20);
    expect(doubleG.phaseShift_rad).toBeCloseTo(baseResult.phaseShift_rad * 2, 8);

    // Double arm separation
    const doubleArm = computeInterferometerFringes({ ...baseParams, armSeparation_um: 20.0 }, 20);
    expect(doubleArm.phaseShift_rad).toBeCloseTo(baseResult.phaseShift_rad * 2, 8);

    // Double interrogation time
    const doubleTime = computeInterferometerFringes({ ...baseParams, interrogationTime_ms: 4.0 }, 20);
    expect(doubleTime.phaseShift_rad).toBeCloseTo(baseResult.phaseShift_rad * 2, 8);
  });

  it('interferometer fringe intensities remain strictly bounded in [0, 1]', () => {
    const params = {
      armSeparation_um: 15.0,
      interrogationTime_ms: 3.5,
      fieldGradient_per_um: 1.2,
      coupling_g: 0.75,
      dephasingNoise: 0.1,
    };

    const result = computeInterferometerFringes(params, 50);

    for (const point of result.fringePoints) {
      expect(point.standardIntensity).toBeGreaterThanOrEqual(0);
      expect(point.standardIntensity).toBeLessThanOrEqual(1);
      expect(point.modelIntensity).toBeGreaterThanOrEqual(0);
      expect(point.modelIntensity).toBeLessThanOrEqual(1);
      expect(point.deltaIntensity).toBeCloseTo(point.modelIntensity - point.standardIntensity, 8);
    }
  });

  it('dephasing noise monotonically degrades interferometer visibility', () => {
    const base = {
      armSeparation_um: 10.0,
      interrogationTime_ms: 2.0,
      fieldGradient_per_um: 0.5,
      coupling_g: 1.0,
    };

    const noiseless = computeInterferometerFringes({ ...base, dephasingNoise: 0.0 });
    const noisyLow = computeInterferometerFringes({ ...base, dephasingNoise: 0.1 });
    const noisyHigh = computeInterferometerFringes({ ...base, dephasingNoise: 1.0 });

    expect(noiseless.visibility).toBeCloseTo(1.0, 8);
    expect(noisyLow.visibility).toBeLessThan(noiseless.visibility);
    expect(noisyHigh.visibility).toBeLessThan(noisyLow.visibility);
  });

  it('Ramsey spectroscopy frequency shift obeys exact physical relation Δf = η δφ / (2π)', () => {
    const eta = 1.5;
    const fieldDiff = 0.8; // au
    const params = {
      detuning_kHz: 2.0,
      interrogationTime_ms: 5.0,
      fieldDiff_au: fieldDiff,
      eta: eta,
      decoherenceRate: 0.05,
    };

    const result = computeRamseyFringes(params, 40);
    const expectedFreqShiftHz = (eta * fieldDiff * 1000) / (2 * Math.PI);
    expect(result.frequencyShift_Hz).toBeCloseTo(expectedFreqShiftHz, 6);

    for (const pt of result.fringePoints) {
      expect(pt.standardProb).toBeGreaterThanOrEqual(0);
      expect(pt.standardProb).toBeLessThanOrEqual(1);
      expect(pt.modelProb).toBeGreaterThanOrEqual(0);
      expect(pt.modelProb).toBeLessThanOrEqual(1);
    }
  });
});
