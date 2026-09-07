import { describe, expect, it } from 'vitest';
import { createFourSourceRingArray, vec3 } from '../lib/arfr/sources';
import {
  calculateResonancePotential,
  detectPocketSplitAndMerge,
  detectResonancePockets,
} from '../lib/arfr/pockets';
import { ResonancePocket } from '../lib/arfr/types';

describe('ARFR Resonance Potential & Pocket Dynamics', () => {
  it('calculates scalar resonance potential bounded in [0, 1]', () => {
    const sources = createFourSourceRingArray();
    const res = calculateResonancePotential(sources, vec3(0, 0, 0), 0);

    expect(res.resonancePotential).toBeGreaterThanOrEqual(0);
    expect(res.resonancePotential).toBeLessThanOrEqual(1.0);
    expect(res.coherence).toBeGreaterThan(0);
  });

  it('detects contiguous resonance pockets exceeding threshold', () => {
    const sources = createFourSourceRingArray(vec3(0, 0, 0), 1.5, 10.0, 1.2, 2.5);
    const bounds = { min: vec3(-2, -2, 0), max: vec3(2, 2, 0), steps: 10 };
    const pockets = detectResonancePockets(sources, bounds, 0, 0.05);

    expect(pockets.length).toBeGreaterThan(0);
    expect(pockets[0].volume).toBeGreaterThan(0);
    expect(pockets[0].peakPotential).toBeGreaterThanOrEqual(0.05);
  });

  it('detects topological pocket splitting and merging events', () => {
    const p1: ResonancePocket = {
      id: 'p1',
      centroid: vec3(0, 0, 0),
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

    const p2: ResonancePocket = { ...p1, id: 'p2', centroid: vec3(-1, 0, 0) };
    const p3: ResonancePocket = { ...p1, id: 'p3', centroid: vec3(1, 0, 0) };

    const splitResult = detectPocketSplitAndMerge([p1], [p2, p3]);
    expect(splitResult.isSplit).toBe(true);
    expect(splitResult.isMerge).toBe(false);

    const mergeResult = detectPocketSplitAndMerge([p2, p3], [p1]);
    expect(mergeResult.isSplit).toBe(false);
    expect(mergeResult.isMerge).toBe(true);
  });
});
