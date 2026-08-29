import { describe, it, expect } from 'vitest';
import {
  ALPHA,
  BETA,
  X1_TRUE,
  X2_TRUE,
  X3_TRUE,
  KSS,
  YSS,
  CSS,
  Z_VALUES,
  NZ,
  N2,
  N3,
  M2,
  M3,
  S2,
  S3,
  computeError,
  policyValuationLoss,
  policyImprovementAnalytical,
  encodeQubitState,
  decodeQubitState,
  solveClassicalPPI,
  solveClassicalCombinatorial,
  solveQuantumQDP,
} from '../lib/qdp';

describe('Quantum Dynamic Programming (QDP) Invariant Tests', () => {
  it('RBC steady state parameters satisfy capital accumulation equation', () => {
    // KSS = (alpha * beta)^(1 / (1 - alpha))
    const expectedKSS = Math.pow(ALPHA * BETA, 1.0 / (1.0 - ALPHA));
    expect(KSS).toBeCloseTo(expectedKSS, 8);
    expect(YSS).toBeCloseTo(Math.pow(KSS, ALPHA), 8);
    expect(CSS).toBeCloseTo(YSS - KSS, 8);
  });

  it('Productivity shocks Z contain 5 states centered around 1.0', () => {
    expect(NZ).toBe(5);
    expect(Z_VALUES[2]).toBe(1.0);
    expect(Z_VALUES[0]).toBeLessThan(1.0);
    expect(Z_VALUES[4]).toBeGreaterThan(1.0);
  });

  it('Binary qubit encoding and decoding preserve continuous parameters x2 and x3 within step accuracy S2 and S3', () => {
    const testX2 = -18.28;
    const testX3 = 1.45;

    const { bits2, bits3 } = encodeQubitState(testX2, testX3);
    expect(bits2.length).toBe(N2);
    expect(bits3.length).toBe(N3);

    const decoded = decodeQubitState(bits2, bits3);
    expect(Math.abs(decoded.x2 - testX2)).toBeLessThanOrEqual(Math.abs(S2));
    expect(Math.abs(decoded.x3 - testX3)).toBeLessThanOrEqual(Math.abs(S3));
  });

  it('Analytical policy improvement function produces expected x1 from x3', () => {
    const x3 = X3_TRUE;
    const x1Expected = (ALPHA * BETA * x3) / (1.0 + ALPHA * BETA * x3);
    const x1Computed = policyImprovementAnalytical(x3);
    expect(x1Computed).toBeCloseTo(x1Expected, 8);
    expect(x1Computed).toBeCloseTo(X1_TRUE, 2);
  });

  it('Policy valuation loss at benchmark true parameters is close to minimum', () => {
    const trueLoss = policyValuationLoss(X1_TRUE, X2_TRUE, X3_TRUE);
    expect(trueLoss).toBeGreaterThanOrEqual(0);

    // Deviating x2 should increase loss
    const perturbedLoss = policyValuationLoss(X1_TRUE, X2_TRUE + 5.0, X3_TRUE);
    expect(perturbedLoss).toBeGreaterThan(trueLoss);
  });

  it('Classical PPI solver converges towards true RBC parameters within iterations', () => {
    const res = solveClassicalPPI(0.5, -0.5, 0.5, 4);
    expect(res.iterations.length).toBe(5);

    const lastIter = res.iterations[res.iterations.length - 1];
    expect(lastIter.x1Error).toBeLessThan(15);
    expect(lastIter.x2Error).toBeLessThan(15);
    expect(lastIter.x3Error).toBeLessThan(15);
  });

  it('Classical Combinatorial QUBO solver returns valid discrete qubit results', () => {
    const res = solveClassicalCombinatorial(0.5, -0.5, 0.5, 3);
    expect(res.solverType).toBe('combinatorial');
    expect(res.iterations.length).toBe(4);
    expect(res.finalX2).toBeGreaterThanOrEqual(M2);
    expect(res.finalX2).toBeLessThanOrEqual(0);
    expect(res.finalX3).toBeGreaterThanOrEqual(0);
    expect(res.finalX3).toBeLessThanOrEqual(M3);
  });

  it('Quantum QDP solver simulates anneals and QPU access time', () => {
    const res = solveQuantumQDP('quantum_oneshot', 0.5, -0.5, 0.5, 50, 3);
    expect(res.solverType).toBe('quantum');
    expect(res.iterations.length).toBe(4);
    expect(res.qpuAccessTimeMs).toBeGreaterThan(0);
    expect(res.quboSampleEnergy).toBeGreaterThanOrEqual(0);
  });
});
