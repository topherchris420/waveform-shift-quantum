import { describe, it, expect } from 'vitest';
import { runTargetLock } from '../lib/targetLock';
import { ANY_PLATFORM_ID, getPlatform } from '../lib/platforms';
import { sampleParameters, searchAnomalies } from '../lib/anomalyEngine';

describe('Parameter sampler', () => {
  it('is reproducible from (seed, index) alone', () => {
    for (const index of [0, 7, 133, 599]) {
      expect(sampleParameters(42, index)).toEqual(sampleParameters(42, index));
    }
  });

  it('samples different points at different indices and seeds', () => {
    expect(sampleParameters(42, 0)).not.toEqual(sampleParameters(42, 1));
    expect(sampleParameters(42, 0)).not.toEqual(sampleParameters(43, 0));
  });

  it('stays inside the declared physical bounds', () => {
    for (let i = 0; i < 400; i += 1) {
      const p = sampleParameters(7, i);
      expect(p.g).toBeGreaterThanOrEqual(0.1);
      expect(p.g).toBeLessThanOrEqual(3.0);
      expect(p.delta).toBeGreaterThanOrEqual(0.05);
      expect(p.delta).toBeLessThanOrEqual(1.0);
      expect(Math.abs(p.phiA)).toBeLessThanOrEqual(2.0);
      expect(Math.abs(p.phiB)).toBeLessThanOrEqual(2.0);
      expect(p.alpha).toBeGreaterThanOrEqual(0.1);
      expect(p.omega_w).toBeGreaterThanOrEqual(5.0);
      expect(p.omega_w).toBeLessThanOrEqual(25.0);
    }
  });
});

describe('Target Lock', () => {
  it('is deterministic for a fixed seed', () => {
    const a = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 11 });
    const b = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 11 });

    expect(a.verdict).toBe(b.verdict);
    expect(a.cards.length).toBe(b.cards.length);
    expect(a.scanned).toBe(b.scanned);
    for (let i = 0; i < a.cards.length; i += 1) {
      expect(a.cards[i].id).toBe(b.cards[i].id);
      expect(a.cards[i].delta).toBe(b.cards[i].delta);
      expect(a.cards[i].significance).toBe(b.cards[i].significance);
      expect(a.cards[i].parameters).toEqual(b.cards[i].parameters);
    }
  });

  it('honours a platform lock', () => {
    const result = runTargetLock({
      platformId: 'optical_lattice_clock',
      sensitivityLimit: 0,
      seed: 5,
    });
    expect(result.cards.length).toBeGreaterThan(0);
    for (const card of result.cards) {
      expect(card.platform.id).toBe('optical_lattice_clock');
      // A locked platform must only be offered modes it can actually run.
      expect(card.platform.supportedModes).toContain(card.experimentType);
    }
  });

  it('honours the sensitivity limit', () => {
    const limit = 1e-2;
    const result = runTargetLock({
      platformId: ANY_PLATFORM_ID,
      sensitivityLimit: limit,
      seed: 3,
    });
    for (const card of result.cards) {
      expect(Math.abs(card.delta)).toBeGreaterThanOrEqual(limit);
    }
    expect(result.rejected.belowSensitivity).toBeGreaterThan(0);
  });

  it('ranks apparatus-ready regimes ahead of integration-limited ones', () => {
    const result = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 21 });
    const readiness = result.cards.map((c) => (c.testability === 'testable_now' ? 0 : 1));
    for (let i = 1; i < readiness.length; i += 1) {
      expect(readiness[i]).toBeGreaterThanOrEqual(readiness[i - 1]);
    }
    // Within a single readiness/validity tier, stronger significance comes first.
    const tier = result.cards.filter(
      (c) => c.testability === 'testable_now' && c.modelValidity === 'perturbative'
    );
    for (let i = 1; i < tier.length; i += 1) {
      expect(tier[i].significance).toBeLessThanOrEqual(tier[i - 1].significance);
    }
  });

  it('keeps every reported separation inside bounded observable units', () => {
    // Guards the units mismatch that would otherwise compare an unbounded
    // kernel factor against a fractional-frequency noise floor and manufacture
    // million-sigma "predictions".
    const result = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 17 });
    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.strongestDeltaSeen).toBeLessThanOrEqual(1);
    for (const card of result.cards) {
      expect(Math.abs(card.delta)).toBeLessThanOrEqual(1);
      expect(card.significance).toBeLessThan(1e6);
    }
  });

  it('ranks regimes the model actually predicts above extrapolations of it', () => {
    const result = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 21 });
    const ready = result.cards.filter((c) => c.testability === 'testable_now');
    const derived = ready.map((c) => (c.modelValidity === 'perturbative' ? 0 : 1));
    for (let i = 1; i < derived.length; i += 1) {
      expect(derived[i]).toBeGreaterThanOrEqual(derived[i - 1]);
    }
  });

  it('spreads unlocked results across apparatus instead of repeating one', () => {
    const result = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 42 });
    const counts = new Map<string, number>();
    for (const card of result.cards) {
      counts.set(card.platform.id, (counts.get(card.platform.id) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('still fills the list when a single platform is locked', () => {
    const result = runTargetLock({
      platformId: 'atom_interferometer',
      sensitivityLimit: 0,
      seed: 42,
    });
    expect(result.cards.length).toBeGreaterThan(2);
    for (const card of result.cards) {
      expect(card.platform.id).toBe('atom_interferometer');
    }
  });

  it('never returns a card whose prediction sits under its platform floor', () => {
    const result = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 8 });
    for (const card of result.cards) {
      expect(card.testability).not.toBe('below_systematic_floor');
      expect(Number.isFinite(card.requiredShots)).toBe(true);
    }
  });

  it('reports an actionable verdict and guidance when nothing survives', () => {
    // Every comparison is expressed in bounded observable units (|Δ| ≤ 1), so a
    // limit of 2 is unreachable and the sweep must fail loudly rather than
    // returning a weak candidate.
    const result = runTargetLock({
      platformId: ANY_PLATFORM_ID,
      sensitivityLimit: 2,
      seed: 4,
    });

    expect(result.cards.length).toBe(0);
    expect(result.best).toBeNull();
    expect(result.verdict).toBe('no_regime_above_sensitivity');
    expect(result.guidance.length).toBeGreaterThan(0);
    // The guidance must name the strongest separation actually found, so the
    // user knows exactly how far to relax the constraint.
    expect(result.guidance.join(' ')).toContain(result.strongestDeltaSeen.toExponential(2));
  });

  it('suggests a better apparatus when the locked one cannot resolve anything', () => {
    const transmon = getPlatform('transmon_circuit')!;
    const result = runTargetLock({
      platformId: 'transmon_circuit',
      // Force everything under the transmon's systematic floor.
      sensitivityLimit: 0,
      seed: 6,
      nSigma: 5,
    });

    if (result.cards.length === 0) {
      expect(result.guidance.join(' ')).toMatch(/Switch Target Lock|No registered apparatus/);
    } else {
      for (const card of result.cards) {
        expect(Math.abs(card.delta) / 5).toBeGreaterThan(transmon.systematicFloor);
      }
    }
  });

  it('counts every rejection so the sweep is auditable', () => {
    const result = runTargetLock({ platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 13 });
    const total =
      result.rejected.unstable +
      result.rejected.degenerate +
      result.rejected.belowSensitivity +
      result.scanned;
    expect(total).toBeGreaterThanOrEqual(result.request.iterations);
    expect(result.scanned).toBeGreaterThan(0);
  });
});

describe('Anomaly engine compatibility', () => {
  it('still produces deterministic ranked candidates', () => {
    const run1 = searchAnomalies({ seed: 42, iterations: 100 });
    const run2 = searchAnomalies({ seed: 42, iterations: 100 });

    expect(run1.length).toBeGreaterThan(0);
    expect(run1).toEqual(run2);
    for (let i = 1; i < run1.length; i += 1) {
      expect(run1[i].score).toBeLessThanOrEqual(run1[i - 1].score);
    }
  });
});
