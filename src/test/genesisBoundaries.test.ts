import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMULATION_PARAMS,
  ResourceVector,
  SubjectivePreference,
  buildWorld,
  evaluateArchitecture,
  evaluateSubjectivePreference,
  genesisOperatingPolicy,
  runSimulation,
} from '../resource-resonance/engine';

const vector: ResourceVector = {
  scarcity: .4,
  demand: .7,
  urgency: .6,
  quality: .8,
  locationCost: .6,
  energyCost: .7,
  reliability: .9,
  compatibility: .9,
};

const preference = (overrides: Partial<SubjectivePreference> = {}): SubjectivePreference => ({
  declaredReservationValue: .8,
  priorityWeight: .7,
  qualityWeight: .8,
  localityWeight: .7,
  consent: true,
  communityDecision: 'approved',
  source: 'human-declared',
  ...overrides,
});

describe('Genesis operating boundaries', () => {
  it('does not invent a subjective value when none was declared', () => {
    const decision = evaluateSubjectivePreference({ vector }, { vector });
    expect(decision.allowed).toBe(true);
    expect(decision.score).toBe(1);
    expect(decision.reason).toContain('neutral logistics');
  });

  it('honors consent and community decisions instead of repricing disagreement', () => {
    const offer = { vector, subjectivePreference: preference() };
    expect(evaluateSubjectivePreference(offer, { vector, subjectivePreference: preference({ consent: false }) }).allowed).toBe(false);
    expect(evaluateSubjectivePreference(offer, { vector, subjectivePreference: preference({ communityDecision: 'rejected' }) }).allowed).toBe(false);
    expect(evaluateSubjectivePreference(offer, { vector, subjectivePreference: preference({ communityDecision: 'pending' }) }).allowed).toBe(false);
  });

  it('counts a held community decision once per unmet request', () => {
    const params = { ...DEFAULT_SIMULATION_PARAMS, networkSize: 6, geographicalFriction: 0 };
    const world = buildWorld(params, 42, 0);
    world.needs.forEach((need) => {
      need.subjectivePreference = preference({ communityDecision: 'pending', source: 'community-declared' });
    });
    const outcome = evaluateArchitecture(world, params, 'genesis', 42);

    expect(outcome.delivered).toBe(0);
    expect(outcome.subjectiveRejected).toBeCloseTo(outcome.demand);
  });

  it('keeps cash-first Genesis subject to liquidity and settlement constraints', () => {
    const stressed = runSimulation({
      ...DEFAULT_SIMULATION_PARAMS,
      ensembleSize: 3,
      genesisSettlementMode: 'cash-first',
      liquidityStress: 1,
      creditAvailability: 0,
      centralBankBackstop: false,
      settlementReliability: 1,
    }, 1234);

    expect(stressed.modelB.genesisFallbackRate).toBe(0);
    expect(stressed.modelB.unmetDemandDecomposition.financialExclusion).toBeGreaterThan(0);
  });

  it('offers advisory mode without pretending to be a settlement rail', () => {
    const advisory = runSimulation({
      ...DEFAULT_SIMULATION_PARAMS,
      ensembleSize: 3,
      genesisSettlementMode: 'advisory',
      liquidityStress: 1,
      creditAvailability: 0,
      centralBankBackstop: false,
    }, 1234);

    expect(advisory.modelB.settlementFailureRate).toBe(0);
    expect(advisory.modelB.unmetDemandDecomposition.financialExclusion).toBe(0);
  });

  it('falls back to cash/market coordination during an outage or node failure', () => {
    const outage = { ...DEFAULT_SIMULATION_PARAMS, ensembleSize: 3, infrastructureOutage: 1 };
    const result = runSimulation(outage, 42);

    expect(genesisOperatingPolicy(outage).mode).toBe('cash-market-fallback');
    expect(genesisOperatingPolicy(outage).reason).toContain('cash/market');
    expect(genesisOperatingPolicy(DEFAULT_SIMULATION_PARAMS, 0).mode).toBe('cash-market-fallback');
    expect(result.modelB.genesisFallbackRate).toBe(1);
  });
});
