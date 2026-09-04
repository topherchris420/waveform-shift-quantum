import { describe, it, expect } from 'vitest';
import {
  stateToDensityMatrix,
  densityMatrixMetrics,
  densityMatrixFidelity,
  applyDephasing,
  type TwoSiteStateVector,
  type DensityMatrix2x2,
} from '@/lib/physics';
import { validateDensityMatrix } from '@/quantum/validation/validateParameters';
import {
  NormalizationError,
  HermitianError,
  PositiveSemiDefiniteError,
} from '@/quantum/errors/QuantumError';

describe('2x2 Density Matrix Invariants & Physics', () => {
  it('converts pure state vector to normalized Hermitian density matrix with Tr(ρ) = 1', () => {
    const states: TwoSiteStateVector[] = [
      { cA: { re: 1.0, im: 0.0 }, cB: { re: 0.0, im: 0.0 } },
      { cA: { re: 0.0, im: 0.0 }, cB: { re: 1.0, im: 0.0 } },
      { cA: { re: 1 / Math.sqrt(2), im: 0.0 }, cB: { re: 1 / Math.sqrt(2), im: 0.0 } },
      { cA: { re: 0.6, im: 0.0 }, cB: { re: 0.0, im: 0.8 } },
    ];

    for (const state of states) {
      const rho = stateToDensityMatrix(state);
      const metrics = densityMatrixMetrics(rho);

      expect(metrics.trace).toBeCloseTo(1.0, 10);
      expect(metrics.purity).toBeCloseTo(1.0, 8); // Pure state Tr(ρ²) = 1
      expect(metrics.entropy).toBeCloseTo(0.0, 8); // Pure state S = 0
      expect(metrics.isHermitian).toBe(true);
      expect(metrics.isPositiveSemiDefinite).toBe(true);
      expect(metrics.eigenvalues[0] + metrics.eigenvalues[1]).toBeCloseTo(1.0, 8);
      expect(() => validateDensityMatrix(rho)).not.toThrow();
    }
  });

  it('environmental dephasing reduces purity and generates von Neumann entropy', () => {
    const pureSuperposition: TwoSiteStateVector = {
      cA: { re: 1 / Math.sqrt(2), im: 0 },
      cB: { re: 1 / Math.sqrt(2), im: 0 },
    };
    const rhoPure = stateToDensityMatrix(pureSuperposition);

    const dephasedLow = applyDephasing(rhoPure, 0.5);
    const metricsLow = densityMatrixMetrics(dephasedLow);

    const dephasedMax = applyDephasing(rhoPure, 10.0);
    const metricsMax = densityMatrixMetrics(dephasedMax);

    // Trace remains exactly 1
    expect(metricsLow.trace).toBeCloseTo(1.0, 10);
    expect(metricsMax.trace).toBeCloseTo(1.0, 10);

    // Purity drops from 1 towards 0.5 (maximally mixed 2-level state)
    expect(metricsLow.purity).toBeLessThan(1.0);
    expect(metricsLow.purity).toBeGreaterThan(0.5);
    expect(metricsMax.purity).toBeCloseTo(0.5, 3);

    // Entropy increases from 0 towards ln(2) ≈ 0.6931
    expect(metricsLow.entropy).toBeGreaterThan(0.0);
    expect(metricsMax.entropy).toBeCloseTo(Math.LN2, 3);

    // Coherence diminishes
    expect(metricsLow.coherence).toBeLessThan(0.5);
    expect(metricsMax.coherence).toBeCloseTo(0.0, 3);
  });

  it('computes Uhlmann fidelity: F(ρ, ρ) = 1 and F(|0⟩⟨0|, |1⟩⟨1|) = 0', () => {
    const state0: TwoSiteStateVector = { cA: { re: 1, im: 0 }, cB: { re: 0, im: 0 } };
    const state1: TwoSiteStateVector = { cA: { re: 0, im: 0 }, cB: { re: 1, im: 0 } };

    const rho0 = stateToDensityMatrix(state0);
    const rho1 = stateToDensityMatrix(state1);

    // Self fidelity = 1
    expect(densityMatrixFidelity(rho0, rho0)).toBeCloseTo(1.0, 10);
    expect(densityMatrixFidelity(rho1, rho1)).toBeCloseTo(1.0, 10);

    // Orthogonal states fidelity = 0
    expect(densityMatrixFidelity(rho0, rho1)).toBe(0);
  });

  it('rejects unphysical density matrices via validateDensityMatrix', () => {
    // Non-normalized matrix (Tr != 1)
    const nonNormalized: DensityMatrix2x2 = {
      rho00: { re: 0.8, im: 0 },
      rho01: { re: 0, im: 0 },
      rho10: { re: 0, im: 0 },
      rho11: { re: 0.8, im: 0 },
    };
    expect(() => validateDensityMatrix(nonNormalized)).toThrow(NormalizationError);

    // Non-Hermitian matrix (rho01 != rho10*)
    const nonHermitian: DensityMatrix2x2 = {
      rho00: { re: 0.5, im: 0 },
      rho01: { re: 0.3, im: 0.1 },
      rho10: { re: 0.3, im: 0.1 }, // Im should be negative for conjugate
      rho11: { re: 0.5, im: 0 },
    };
    expect(() => validateDensityMatrix(nonHermitian)).toThrow(HermitianError);

    // Not positive semi-definite (det < 0, giving negative eigenvalue)
    const nonPSD: DensityMatrix2x2 = {
      rho00: { re: 0.2, im: 0 },
      rho01: { re: 0.45, im: 0 },
      rho10: { re: 0.45, im: 0 },
      rho11: { re: 0.8, im: 0 },
    };
    expect(() => validateDensityMatrix(nonPSD)).toThrow(PositiveSemiDefiniteError);
  });
});
