import { describe, expect, it } from 'vitest';
import { createFourSourceRingArray, vec3 } from '../lib/arfr/sources';
import {
  createInitialControllerState,
  createInitialEnergyLedger,
  getProfileWeights,
  updateAdaptiveController,
  updateEnergyLedger,
} from '../lib/arfr/controller';
import { ResonancePocket } from '../lib/arfr/types';
import { generateARFRPassportRecord } from '../lib/arfr/passport';

describe('ARFR Adaptive Controller & Energy Ledger & Passport', () => {
  it('returns operating profile weights', () => {
    const precision = getProfileWeights('PRECISION');
    const lowEnergy = getProfileWeights('LOW_ENERGY');

    expect(precision.positionError).toBeGreaterThan(lowEnergy.positionError);
    expect(lowEnergy.controlEnergy).toBeGreaterThan(precision.controlEnergy);
  });

  it('updates controller state and phase shifts toward target position', () => {
    const sources = createFourSourceRingArray();
    const ctrlState = createInitialControllerState('PRECISION');
    const target = vec3(0.55, 0, 0);

    const pocket: ResonancePocket = {
      id: 'p1',
      centroid: vec3(0.5, 0, 0),
      volume: 1.0,
      velocity: vec3(0, 0, 0),
      coherence: 0.9,
      lifetime: 1.0,
      energy: 2.0,
      particleOccupancy: 10,
      fieldGradient: vec3(0, 0, 0),
      shape: 'sphere',
      peakPotential: 0.8,
    };

    const { updatedSources, nextState } = updateAdaptiveController(
      sources,
      pocket,
      target,
      0.1,
      ctrlState
    );

    expect(nextState.lockState).toBe('ACQUIRING');
    expect(updatedSources[0].phase).not.toBe(sources[0].phase);
  });

  it('updates energy ledger metrics accurately', () => {
    const sources = createFourSourceRingArray();
    const ctrlState = createInitialControllerState('BALANCED');
    const prevLedger = createInitialEnergyLedger();

    const updatedLedger = updateEnergyLedger(
      prevLedger,
      sources,
      ctrlState,
      1.5,
      20,
      2.0,
      0.1
    );

    expect(updatedLedger.fieldInput).toBeGreaterThan(0);
    expect(updatedLedger.effectiveCoupledEnergy).toBeGreaterThan(0);
    expect(updatedLedger.joulesPerMeter).toBeGreaterThan(0);
  });

  it('generates reproducible ARFR passport record with sha256 hash', async () => {
    const sources = createFourSourceRingArray();
    const ctrlState = createInitialControllerState('BALANCED');
    const ledger = createInitialEnergyLedger();

    const record = await generateARFRPassportRecord(
      {
        id: 'exp1',
        name: 'Test Exp',
        description: 'Test',
        mode: 'ROUTE',
        profile: 'BALANCED',
        routeType: 'LINE',
        sources,
        seed: 123,
      },
      ctrlState,
      ledger,
      0.85,
      10.5
    );

    expect(record.simulationVersion).toBe('ARFR-v1.0.0');
    expect(record.results.reproducibilityHash).toHaveLength(64); // SHA-256 hex length
  });
});
