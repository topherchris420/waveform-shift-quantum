import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMULATION_PARAMS,
  runSimulation,
  runAblationAnalysis,
  SimulationParams
} from '../resource-resonance/engine';

const baseParams: SimulationParams = {
  ...DEFAULT_SIMULATION_PARAMS,
  resourceScarcity: 0.5,
  networkSize: 24,
  renewableVolatility: 0.6,
  computeDemand: 0.8,
  urgency: 0.5,
  geographicalFriction: 0.3,
  participantReliability: 0.8,
  supplyDemandImbalance: 0.1,
  flexibleComputeShare: 0.65,
  marketOverhead: 0.04,
  hybridOverhead: 0.07,
  genesisOverhead: 0.09,
  telemetryVerificationCost: 0.08,
  creditAvailability: 0.78,
  liquidityStress: 0.18,
  counterpartyRisk: 0.1,
  collateralHaircut: 0.2,
  settlementReliability: 0.96,
  settlementLatency: 0.12,
  fundingCost: 0.05,
  priceSignalNoise: 0.08,
  centralBankBackstop: true,
  backstopCapacity: 0.45,
  telemetryReliability: 0.88,
};

describe('Multi-Layer Backward Compatibility', () => {
  it('preserves baseline simulation metrics when behavioral and institutional layers are neutral/off', () => {
    const defaultRun = runSimulation(baseParams, 42);
    const explicitOffRun = runSimulation({ ...baseParams, behavioralEnabled: false, institutionalEnabled: false }, 42);

    expect(defaultRun.modelA.totalNetworkUtility).toEqual(explicitOffRun.modelA.totalNetworkUtility);
    expect(defaultRun.modelA.unmetDemandDecomposition.physicalShortage).toEqual(explicitOffRun.modelA.unmetDemandDecomposition.physicalShortage);
    expect(defaultRun.modelA.unmetDemandDecomposition.financialExclusion).toEqual(explicitOffRun.modelA.unmetDemandDecomposition.financialExclusion);
  });
});

describe('Isolated Behavioral Layer Invariants', () => {
  it('increases unmet demand when precautionary hoarding and trust decay are enabled under stress', () => {
    const off = runSimulation({ ...baseParams, behavioralEnabled: false }, 101);
    const on = runSimulation({
      ...baseParams,
      behavioralEnabled: true,
      riskAversion: 0.8,
      liquidityPreference: 0.85,
      hoardingSensitivity: 0.9,
      trustSensitivity: 0.8,
      counterpartyRisk: 0.4
    }, 101);

    expect(on.modelA.unmetDemandDecomposition.behavioralFriction).toBeGreaterThan(0);
    expect(on.modelA.unmetDemand).toBeGreaterThanOrEqual(off.modelA.unmetDemand);
  });

  it('amplifies demand when hoarding sensitivity is triggered by scarcity', () => {
    const lowScarcity = runSimulation({ ...baseParams, behavioralEnabled: true, resourceScarcity: 0.1, hoardingSensitivity: 0.8 }, 202);
    const highScarcity = runSimulation({ ...baseParams, behavioralEnabled: true, resourceScarcity: 0.9, hoardingSensitivity: 0.8 }, 202);

    expect(highScarcity.modelA.hoardingFactor).toBeGreaterThan(lowScarcity.modelA.hoardingFactor);
  });
});

describe('Isolated Institutional Layer Invariants', () => {
  it('increases institutional friction when regulatory checks and capital holds are enabled', () => {
    const off = runSimulation({ ...baseParams, institutionalEnabled: false }, 303);
    const on = runSimulation({
      ...baseParams,
      institutionalEnabled: true,
      regulatoryFriction: 0.8,
      capitalConstraints: 0.7,
      governanceLatency: 0.6
    }, 303);

    expect(on.modelA.unmetDemandDecomposition.institutionalFriction).toBeGreaterThan(0);
    expect(on.modelA.routingLatency).toBeGreaterThan(off.modelA.routingLatency);
  });
});

describe('Multi-Layer Ablation Analysis & Interaction Coupling', () => {
  it('computes 4 canonical ablation layers and identifies non-linear interaction coupling', () => {
    const ablation = runAblationAnalysis({
      ...baseParams,
      liquidityStress: 0.7,
      resourceScarcity: 0.7,
      riskAversion: 0.8,
      hoardingSensitivity: 0.8,
      regulatoryFriction: 0.7,
      capitalConstraints: 0.6
    }, 505);

    expect(ablation.baseline.name).toContain('1. Baseline');
    expect(ablation.plusBehavior.name).toContain('2. + Behavioral');
    expect(ablation.plusInstitutions.name).toContain('3. + Institutional');
    expect(ablation.full.name).toContain('4. Full Genesis');

    expect(ablation.plusBehavior.behavioralFriction).toBeGreaterThan(0);
    expect(ablation.plusInstitutions.institutionalFriction).toBeGreaterThan(0);

    expect(typeof ablation.interactionEffectPct).toBe('number');
    expect(typeof ablation.isNonlinear).toBe('boolean');
    expect(ablation.explanation).toBeDefined();
  });
});

describe('Causal Attribution Methodology', () => {
  it('correctly attributes primary driver to physical scarcity during extreme physical shortage', () => {
    const res = runSimulation({
      ...baseParams,
      resourceScarcity: 0.95,
      supplyDemandImbalance: 0.8,
      liquidityStress: 0.05
    }, 606);

    expect(res.modelA.causalAttribution.primaryCausalFactor).toBe('physicalScarcity');
    expect(res.modelA.causalAttribution.certaintyLevel).toBe('HIGH');
  });

  it('correctly attributes primary driver to financial constraints during credit freeze', () => {
    const res = runSimulation({
      ...baseParams,
      resourceScarcity: 0.1,
      liquidityStress: 0.95,
      creditAvailability: 0.05,
      centralBankBackstop: false
    }, 707);

    expect(res.modelA.causalAttribution.primaryCausalFactor).toBe('financialConstraint');
    expect(res.modelA.causalAttribution.certaintyLevel).toBe('HIGH');
  });
});
