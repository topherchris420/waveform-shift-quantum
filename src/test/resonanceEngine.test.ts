import { describe, expect, it } from 'vitest';
import { ARCHITECTURES, buildWorld, challengeClaim, DEFAULT_SIMULATION_PARAMS, evaluateArchitecture, FrozenClaim, runSimulation, SimulationParams } from '../resource-resonance/engine';

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

  it('reports stronger comparators without forcing a Genesis win', () => {
    const result = runSimulation({ ...params, ensembleSize: 4 }, 400);
    expect(Object.keys(result.architectures)).toEqual(ARCHITECTURES);
    expect(result.architectures.doubleAuction.clearingPrice).toBeGreaterThanOrEqual(0);
    expect(result.architectures.shadowPriceMarket.shadowPrice).toBeGreaterThan(0);
    expect(result.architectureVerdict).toBeDefined();
  });
});

describe('counterfactual and oracle validity', () => {
  it('deep-clones worlds and makes architecture order irrelevant', () => {
    const world = buildWorld(params, 991, 0.03);
    const before = structuredClone(world);
    const forward = ARCHITECTURES.map(mode => [mode, evaluateArchitecture(world, params, mode, 77).welfare]);
    const reverse = [...ARCHITECTURES].reverse().map(mode => [mode, evaluateArchitecture(world, params, mode, 77).welfare]);
    expect(Object.fromEntries(reverse)).toEqual(Object.fromEntries(forward));
    expect(world).toEqual(before);
  });

  it('keeps failure and oracle counterfactuals isolated from ordinary allocation', () => {
    const world = buildWorld(params, 992, -0.02);
    const ordinary = evaluateArchitecture(world, params, 'market', 88);
    evaluateArchitecture(world, params, 'market', 88, 0);
    evaluateArchitecture(world, params, 'oracle', 88);
    expect(evaluateArchitecture(world, params, 'market', 88)).toEqual(ordinary);
  });

  it('conserves resources and never exceeds the optimized physical oracle', () => {
    const result = runSimulation({ ...params, ensembleSize: 5 }, 993);
    for (const metrics of Object.values(result.architectures)) {
      expect(metrics.fulfilledNeeds).toBeLessThanOrEqual(100 + 1e-8);
      expect(metrics.efficiencyRatio).toBeLessThanOrEqual(1 + 1e-8);
      expect(metrics.oracleGap).toBeGreaterThanOrEqual(-1e-8);
    }
  });

  it('keeps hidden true state separate from strategic reports', () => {
    const world = buildWorld({ ...params, misreportProbability: 1, misreportMagnitude: .8 }, 994, 0);
    expect(world.needs.some(n => n.reportedUrgency !== n.trueUrgency)).toBe(true);
    expect(world.needs.every(n => n.trueUrgency === n.vector.urgency && n.trueDemand === n.vector.demand)).toBe(true);
  });
});
