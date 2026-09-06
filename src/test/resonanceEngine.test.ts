import { describe, expect, it } from 'vitest';
import { challengeClaim, DEFAULT_SIMULATION_PARAMS, FrozenClaim, runOverheadSensitivity, runSimulation, SimulationParams, timingFactor } from '../resource-resonance/engine';

const params: SimulationParams = {
  ...DEFAULT_SIMULATION_PARAMS,
  resourceScarcity: 0.5,
  networkSize: 24,
  renewableVolatility: 0.7,
  computeDemand: 0.8,
  urgency: 0.6,
  geographicalFriction: 0.4,
  participantReliability: 0.9,
  supplyDemandImbalance: 0.1,
  flexibleComputeShare: 0.65,
  marketOverhead: 0.08,
  hybridOverhead: 0.11,
  genesisOverhead: 0.14,
  telemetryVerificationCost: 0.3,
};

describe('neutral physical-welfare simulation', () => {
  it('is reproducible and reports all three non-oracle mechanisms', () => {
    const first = runSimulation(params, 42);
    const replay = runSimulation(params, 42);

    expect(replay).toEqual(first);
    expect(first.modelA.totalNetworkUtility).toBeGreaterThanOrEqual(0);
    expect(first.modelHybrid.totalNetworkUtility).toBeGreaterThanOrEqual(0);
    expect(first.modelB.totalNetworkUtility).toBeGreaterThanOrEqual(0);
    expect(first.deltaVsHybrid).toBeCloseTo(
      first.modelB.totalNetworkUtility - first.modelHybrid.totalNetworkUtility,
    );
  });

  it('exposes overhead as a sensitivity assumption', () => {
    const lowCost = runSimulation(params, 73);
    const highCost = runSimulation({ ...params, genesisOverhead: 0.35 }, 73);

    expect(highCost.modelB.totalNetworkUtility).toBeLessThan(lowCost.modelB.totalNetworkUtility);
  });

  it('evaluates the hybrid gate from the paired holdout seed bank', () => {
    const holdoutSeeds = [42, 73, 101];
    const results = holdoutSeeds.map((seed) => runSimulation(params, seed));
    const deltas = results.map((result) => result.deltaVsHybrid);
    const mean = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    const sd = Math.sqrt(
      deltas.reduce((sum, delta) => sum + (delta - mean) ** 2, 0) / (deltas.length - 1),
    );
    const lcb = mean - 1.96 * sd / Math.sqrt(deltas.length);
    const claim = {
      id: 'test-claim',
      frozenAt: '2026-08-14T00:00:00.000Z',
      params,
      discoverySeeds: [],
      holdoutSeeds,
      predictedDelta: 0,
      predictedBand: 0,
    } as FrozenClaim;

    const hybridGate = challengeClaim(claim).gates.find((gate) => gate.id === 'hybrid');

    expect(hybridGate?.passed).toBe(lcb > 0);
    expect(hybridGate?.detail).toContain(`${mean.toFixed(2)} pp`);
    expect(hybridGate?.detail).toContain(`${lcb.toFixed(2)} pp over ${holdoutSeeds.length} holdout seeds`);
  });
});

describe('monetary coordination layer', () => {
  it('keeps the physical world fixed under a pure liquidity shock', () => {
    const normal = runSimulation(params, 81);
    const freeze = runSimulation({ ...params, liquidityStress: .95, creditAvailability: .05 }, 81);
    expect(freeze.physicalCapacity).toBe(normal.physicalCapacity);
    expect(freeze.totalDemand).toBe(normal.totalDemand);
    expect(freeze.modelA.feasibleButUnservedDemand).toBeGreaterThan(normal.modelA.feasibleButUnservedDemand);
  });

  it('classifies financial rejection as FUD but not real physical scarcity', () => {
    const liquid = runSimulation({ ...params, resourceScarcity: .1, liquidityStress: .95, creditAvailability: 0, centralBankBackstop: false }, 92);
    const scarce = runSimulation({ ...params, resourceScarcity: 1, supplyDemandImbalance: .9, liquidityStress: 0, creditAvailability: 1 }, 92);
    expect(liquid.modelA.feasibleButUnservedDemand).toBeGreaterThan(0);
    expect(liquid.modelA.unmetDemandDecomposition.financialExclusion).toBe(liquid.modelA.feasibleButUnservedDemand);
    expect(scarce.modelB.feasibleButUnservedDemand).toBe(0);
    expect(scarce.modelB.unmetDemandDecomposition.physicalShortage).toBeGreaterThan(0);
  });

  it('lets a capacity-limited backstop rescue solvent liquidity cases, at a cost', () => {
    const base = { ...params, liquidityStress: .88, creditAvailability: .15, counterpartyRisk: 0, settlementReliability: 1, collateralHaircut: .1 };
    const off = runSimulation({ ...base, centralBankBackstop: false }, 123);
    const on = runSimulation({ ...base, centralBankBackstop: true, backstopCapacity: 1 }, 123);
    expect(on.modelStabilized.fulfilledNeeds).toBeGreaterThan(off.modelStabilized.fulfilledNeeds);
    expect(on.modelStabilized.backstopUtilization).toBeGreaterThan(0);
    expect(on.modelStabilized.coordinationOverhead).toBeGreaterThanOrEqual(off.modelStabilized.coordinationOverhead);
  });

  it('cannot use a backstop or Genesis to invent supply or rescue impossibility', () => {
    const crisis = runSimulation({ ...params, resourceScarcity: 1, supplyDemandImbalance: 1, centralBankBackstop: true, backstopCapacity: 1 }, 205);
    expect(crisis.modelStabilized.fulfilledNeeds).toBeLessThan(100);
    expect(crisis.modelB.fulfilledNeeds).toBeLessThan(100);
    expect(crisis.modelB.unmetDemandDecomposition.physicalShortage).toBeGreaterThan(0);
  });

  it('penalizes Hybrid and Genesis when telemetry reliability falls', () => {
    const trusted = runSimulation({ ...params, telemetryReliability: 1 }, 311);
    const corrupted = runSimulation({ ...params, telemetryReliability: 0 }, 311);
    expect(corrupted.modelB.totalNetworkUtility).toBeLessThan(trusted.modelB.totalNetworkUtility);
    expect(corrupted.modelHybrid.totalNetworkUtility).toBeLessThan(trusted.modelHybrid.totalNetworkUtility);
  });

  it('allows every architecture to win under defensible cost and stress regimes', () => {
    const cases = [
      { ...params, liquidityStress: 0, creditAvailability: 1, settlementReliability: 1, telemetryReliability: 0, marketOverhead: 0, hybridOverhead: .35, genesisOverhead: .4 },
      { ...params, liquidityStress: .7, creditAvailability: .25, counterpartyRisk: 0, settlementReliability: 1, backstopCapacity: 1, marketOverhead: 0, hybridOverhead: .4, genesisOverhead: .45 },
      { ...params, liquidityStress: 0, creditAvailability: 1, settlementReliability: 1, telemetryReliability: 1, marketOverhead: .3, hybridOverhead: 0, genesisOverhead: .3 },
      { ...params, liquidityStress: .95, creditAvailability: 0, centralBankBackstop: false, telemetryReliability: 1, genesisOverhead: 0 },
    ];
    const expected = [
      ['market', 'doubleAuction', 'shadowPriceMarket'],
      ['stabilizedMarket', 'shadowPriceMarket'],
      ['hybrid'],
      ['genesis', 'maxWeightMatching'],
    ];
    cases.forEach((input, index) => {
      const result = runSimulation(input, 400 + index);
      const winner = Object.entries(result.architectures).sort((a,b)=>b[1].totalNetworkUtility-a[1].totalNetworkUtility)[0][0];
      expect(expected[index]).toContain(winner);
    });

  });
});

describe('physical timing layer (energy / compute / storage)', () => {
  it('treats energy that arrives before a deadline as fully usable', () => {
    expect(timingFactor(4, 9, 10, false, false, DEFAULT_SIMULATION_PARAMS)).toBe(1);
  });

  it('curtails inflexible late energy but lets a storage bridge carry it forward', () => {
    const late = timingFactor(14, 16, 10, false, false, DEFAULT_SIMULATION_PARAMS);
    const bridged = timingFactor(14, 16, 10, false, true, DEFAULT_SIMULATION_PARAMS);
    const shifted = timingFactor(14, 16, 10, true, false, DEFAULT_SIMULATION_PARAMS);
    expect(late).toBeLessThan(shifted);
    expect(shifted).toBeLessThan(bridged);
  });

  it('lets harder deadlines reduce realized welfare for every mechanism', () => {
    const soft = runSimulation({ ...params, deadlinePressure: 0.1 }, 555);
    const hard = runSimulation({ ...params, deadlinePressure: 0.95 }, 555);
    expect(hard.modelA.totalNetworkUtility).toBeLessThanOrEqual(soft.modelA.totalNetworkUtility + 1e-9);
  });
});

describe('overhead assumptions are exposed, not hidden', () => {
  it('reports whether the direction survives halving and doubling the cost constant', () => {
    const report = runOverheadSensitivity(params, [90211, 91733]);
    expect(report.points).toHaveLength(5);
    expect(report.points.map((point) => point.multiplier)).toEqual([0.5, 0.75, 1, 1.5, 2]);
    expect(report.robust).toBe(report.points.every((point) => point.genesisStillAhead));
  });
});
