import { describe, expect, it } from 'vitest';
import { runSimulation, SimulationParams } from '../resource-resonance/engine';

const params: SimulationParams = {
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
});
