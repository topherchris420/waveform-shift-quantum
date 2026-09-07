import { describe, expect, it } from 'vitest';
import {
  createCounterRotatingPair,
  createFourSourceRingArray,
  evaluateSingleSourceField,
  evaluateSuperposedField,
  vec3,
  vec3Add,
  vec3Len,
} from '../lib/arfr/sources';

describe('ARFR Field Sources & Superposition', () => {
  it('creates counter-rotating field source pairs with opposite angular velocities', () => {
    const pair = createCounterRotatingPair({
      id: 'cr_pair_1',
      center: vec3(0, 0, 0),
      separation: 2.0,
      axis: vec3(0, 0, 1),
      frequency: 10.0,
      rotationRate: 5.0,
      phaseOffset: Math.PI / 4,
      amplitude: 1.5,
      effectiveRadius: 3.0,
    });

    expect(pair).toHaveLength(2);
    expect(pair[0].angularVelocity).toBe(5.0);
    expect(pair[1].angularVelocity).toBe(-5.0);
    expect(vec3Len(vec3Add(pair[0].position, pair[1].position))).toBeLessThan(1e-6);
  });

  it('creates four-source ring array correctly', () => {
    const ring = createFourSourceRingArray(vec3(0, 0, 0), 2.0, 10.0, 1.0, 3.0);
    expect(ring).toHaveLength(4);
  });

  it('evaluates single source field roll-off and rotation', () => {
    const ring = createFourSourceRingArray();
    const source = ring[0];
    const near = evaluateSingleSourceField(source, source.position, 0);
    const far = evaluateSingleSourceField(source, vec3(10, 10, 10), 0);

    expect(near.magnitude).toBeGreaterThan(far.magnitude);
  });

  it('evaluates superposed field with vector linear superposition', () => {
    const sources = createFourSourceRingArray(vec3(0, 0, 0), 2.0, 10.0, 1.0, 3.0);
    const superposed = evaluateSuperposedField(sources, vec3(0, 0, 0), 0);

    expect(superposed.netIntensity).toBeGreaterThanOrEqual(0);
    expect(superposed.coherence).toBeGreaterThanOrEqual(0);
    expect(superposed.coherence).toBeLessThanOrEqual(1.0001);
  });
});
