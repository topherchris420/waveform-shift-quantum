import { describe, expect, it } from 'vitest';
import {
  createDefaultARFRConfig,
  createSimulation,
  createSourceArrangement,
  detectResonancePockets,
  evolveSources,
  fieldAt,
  phaseSteeringForTargets,
  runBuiltInExperiment,
  sourceFieldContribution,
  stepSimulation,
  superposeFieldContributions,
  validateARFRConfig,
  vec3,
} from '../arfr/engine';
import { createARFRPassport, verifyARFRPassport } from '../arfr/passport';
import type { FieldGrid, FieldResolution, MediumParameters } from '../arfr/types';

const medium: MediumParameters = {
  characteristicFrequency: 1.2,
  resonanceBandwidth: 0.48,
  responseAxis: vec3(0, 0, 1),
  charge: 1,
  mass: 1,
  damping: 0.62,
  coupling: 1.9,
  magneticStrength: 0.08,
  noiseAmplitude: 0,
  waveNumber: 4.2,
};

function testGrid(values: Array<{ x: number; y: number; z: number; value: number }>): FieldGrid {
  const resolution: FieldResolution = { x: 5, y: 5, z: 3 };
  const total = resolution.x * resolution.y * resolution.z;
  const potential = new Float32Array(total);
  const magnitude = new Float32Array(total);
  const coherence = new Float32Array(total);
  const gradientMagnitude = new Float32Array(total);
  const vectors = new Float32Array(total * 3);
  values.forEach(({ x, y, z, value }) => {
    const index = x + resolution.x * (y + resolution.y * z);
    potential[index] = value;
    magnitude[index] = value;
    coherence[index] = 1;
  });
  return {
    resolution,
    bounds: { min: vec3(-1, -1, -0.5), max: vec3(1, 1, 0.5) },
    potential,
    magnitude,
    coherence,
    gradientMagnitude,
    vectors,
  };
}

describe('Adaptive Resonant Field Router numerical core', () => {
  it('preserves linear field superposition', () => {
    const sources = createSourceArrangement('ring', { radius: 1.2, rotationRate: 0 });
    const point = vec3(0.25, -0.2, 0.1);
    const contributions = sources.map((source) => sourceFieldContribution(source, point, 0.3, medium));
    const combined = fieldAt(point, sources, 0.3, medium);
    expect(combined.vector.x).toBeCloseTo(superposeFieldContributions(contributions).x, 10);
    expect(combined.vector.y).toBeCloseTo(superposeFieldContributions(contributions).y, 10);
    expect(combined.vector.z).toBeCloseTo(superposeFieldContributions(contributions).z, 10);
  });

  it('keeps source positions fixed while counter-rotating phases evolve', () => {
    const sources = createSourceArrangement('counter_rotating_pair', { rotationRate: 1.5 });
    const next = evolveSources(sources, 0.2);
    expect(next[0].angularVelocity).toBeCloseTo(1.5, 10);
    expect(next[1].angularVelocity).toBeCloseTo(-1.5, 10);
    expect(next[0].phase).not.toBe(sources[0].phase);
    expect(next[1].phase).not.toBe(sources[1].phase);
    expect(next[0].position).toEqual(sources[0].position);
    expect(next[1].position).toEqual(sources[1].position);
  });

  it('steers resonance potential by changing relative phase, not source geometry', () => {
    const sources = createSourceArrangement('ring', { radius: 1.35, rotationRate: 0 });
    const target = vec3(0.78, 0.1, 0);
    const phases = phaseSteeringForTargets(sources, [target], [1], medium);
    const steered = sources.map((source, index) => ({ ...source, phase: phases[index] }));
    const focused = fieldAt(target, steered, 0, medium).resonancePotential;
    const offAxis = fieldAt(vec3(-1.1, 0.9, 0), steered, 0, medium).resonancePotential;
    expect(focused).toBeGreaterThan(offAxis);
    expect(steered.map((source) => source.position)).toEqual(sources.map((source) => source.position));
  });

  it('detects a contiguous pocket and computes its centroid', () => {
    const grid = testGrid([
      { x: 2, y: 2, z: 1, value: 0.95 },
      { x: 3, y: 2, z: 1, value: 0.9 },
      { x: 2, y: 3, z: 1, value: 0.9 },
    ]);
    const pockets = detectResonancePockets(grid, 0.5);
    expect(pockets).toHaveLength(1);
    expect(pockets[0].centroid.x).toBeGreaterThan(-0.1);
    expect(pockets[0].centroid.y).toBeGreaterThan(-0.1);
    expect(pockets[0].volume).toBeGreaterThan(0);
  });

  it('detects split and merge topology transitions from the sampled field', () => {
    const one = testGrid([
      { x: 2, y: 2, z: 1, value: 0.95 },
      { x: 2, y: 3, z: 1, value: 0.9 },
    ]);
    const two = testGrid([
      { x: 1, y: 2, z: 1, value: 0.95 },
      { x: 1, y: 3, z: 1, value: 0.9 },
      { x: 3, y: 2, z: 1, value: 0.95 },
      { x: 3, y: 3, z: 1, value: 0.9 },
    ]);
    const onePockets = detectResonancePockets(one, 0.5);
    const twoPockets = detectResonancePockets(two, 0.5, onePockets);
    const mergedPockets = detectResonancePockets(one, 0.5, twoPockets);
    expect(onePockets).toHaveLength(1);
    expect(twoPockets).toHaveLength(2);
    expect(mergedPockets).toHaveLength(1);
  });

  it('is deterministic for a fixed seed and fixed stepping schedule', () => {
    const a = runBuiltInExperiment('translation', { seed: 911 }, 24);
    const b = runBuiltInExperiment('translation', { seed: 911 }, 24);
    expect(a.trace).toEqual(b.trace);
    expect(a.summary).toEqual(b.summary);
    expect(a.finalState.sources).toEqual(b.finalState.sources);
  });

  it('follows a translation target with a closed-loop controller', () => {
    const run = runBuiltInExperiment('translation', { seed: 43 }, 80);
    expect(run.summary.finalPositionError).toBeLessThan(1.35);
    expect(run.summary.peakLockQuality).toBeGreaterThan(0);
    expect(run.summary.routedDistance).toBeGreaterThanOrEqual(0);
  });

  it('accounts for energy monotonically and responds after a disturbance', () => {
    const run = runBuiltInExperiment('disturbance_recovery', { seed: 52 }, 70);
    for (let index = 1; index < run.trace.length; index += 1) {
      expect(run.trace[index].energy).toBeGreaterThanOrEqual(run.trace[index - 1].energy);
    }
    expect(run.finalState.events.some((event) => event.includes('disturbance applied'))).toBe(true);
    expect(run.summary.totalEnergy).toBeGreaterThan(0);
  });

  it('supports direct stepping and rejects invalid configuration values', () => {
    const config = createDefaultARFRConfig({ seed: 12, dt: 0.04 });
    let state = createSimulation(config);
    state = stepSimulation(state);
    expect(state.step).toBe(1);
    expect(state.energy.fieldInput).toBeGreaterThan(0);
    expect(() => createDefaultARFRConfig({ threshold: 1.01 })).toThrow(/threshold/i);
    expect(() => validateARFRConfig({ ...config, particleCount: 2 })).toThrow(/particleCount/i);
  });

  it('creates and verifies a canonical reproducible experiment passport', async () => {
    const run = runBuiltInExperiment('translation', { seed: 101 }, 10);
    const first = await createARFRPassport({ experiment: 'translation', state: run.finalState, summary: run.summary });
    const second = await createARFRPassport({ experiment: 'translation', state: run.finalState, summary: run.summary });
    expect(first.integrity.identityHash).toBe(second.integrity.identityHash);
    await expect(verifyARFRPassport(first)).resolves.toBe(true);
    expect(first.sourceGeometry.positionsStayedFixed).toBe(true);
    expect(first.energyProfile).toBe(run.config.energyProfile);
  });
});
