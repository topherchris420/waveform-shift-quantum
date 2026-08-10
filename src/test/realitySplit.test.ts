import { describe, it, expect } from 'vitest';
import {
  computeDivergenceField,
  computeDivergenceMap,
  DEFAULT_SPLIT_PARAMS,
  sampleTrajectory,
  simulateRealitySplit,
  type RealitySplitParams,
  type SplitMode,
} from '../lib/realitySplit';

const params = (overrides: Partial<RealitySplitParams> = {}): RealitySplitParams => ({
  ...DEFAULT_SPLIT_PARAMS,
  ...overrides,
});

const integrate = (values: number[]) => {
  const dx = 2 / (values.length - 1);
  return values.reduce((acc, v) => acc + v, 0) * dx;
};

describe('Reality Split engine', () => {
  it('starts both branches from identical initial conditions with zero divergence', () => {
    const trajectory = simulateRealitySplit(params(), { duration: 4, dt: 0.02 });
    const first = trajectory.frames[0];

    expect(first.t).toBe(0);
    expect(first.standard.PA).toBe(1);
    expect(first.model.PA).toBe(1);
    expect(first.deltaPB).toBe(0);
    expect(first.traceDistance).toBe(0);
  });

  it('collapses the split entirely when the coupling is switched off (g = 0)', () => {
    // The engine's central falsifiable invariant: with no matter-scalar
    // coupling the proposed model must reduce exactly to standard QM, so any
    // divergence anywhere is attributable to g alone.
    const trajectory = simulateRealitySplit(
      params({ g: 0, phiA: -1.8, phiB: 1.7, driveAmplitude: 1.2 }),
      { duration: 8, dt: 0.02 }
    );

    for (const frame of trajectory.frames) {
      expect(frame.standard.PA).toBeCloseTo(frame.model.PA, 12);
      expect(frame.standard.PB).toBeCloseTo(frame.model.PB, 12);
      expect(frame.traceDistance).toBeCloseTo(0, 12);
    }
    expect(trajectory.maxDivergence).toBeCloseTo(0, 12);
  });

  it('produces a genuine split once the coupling is non-zero', () => {
    const trajectory = simulateRealitySplit(
      params({ g: 1.4, phiA: -1.0, phiB: 1.0 }),
      { duration: 8, dt: 0.02 }
    );

    expect(trajectory.maxDivergence).toBeGreaterThan(1e-3);
    expect(trajectory.maxDivergenceTime).toBeGreaterThan(0);
    expect(trajectory.meanDivergence).toBeGreaterThan(0);
  });

  it('conserves norm in both branches throughout the evolution', () => {
    const trajectory = simulateRealitySplit(
      params({ g: 2.2, phiA: -1.9, phiB: 1.9, driveAmplitude: 1.4, driveOmega: 4 }),
      { duration: 10, dt: 0.02 }
    );

    for (const frame of trajectory.frames) {
      expect(frame.standard.norm).toBeCloseTo(1, 8);
      expect(frame.model.norm).toBeCloseTo(1, 8);
      expect(frame.standard.PA + frame.standard.PB).toBeCloseTo(1, 8);
      expect(frame.model.PA + frame.model.PB).toBeCloseTo(1, 8);
    }
  });

  it('reports the first time the split clears a supplied noise floor', () => {
    const noiseFloor = 1e-3;
    const trajectory = simulateRealitySplit(params({ g: 1.4 }), {
      duration: 8,
      dt: 0.02,
      noiseFloor,
    });

    expect(trajectory.firstDetectableTime).not.toBeNull();
    const t = trajectory.firstDetectableTime as number;
    const frame = trajectory.frames.find((f) => f.t === t);
    expect(frame?.traceDistance).toBeGreaterThan(noiseFloor);

    // Nothing before that time may exceed the floor.
    for (const earlier of trajectory.frames.filter((f) => f.t < t)) {
      expect(earlier.traceDistance).toBeLessThanOrEqual(noiseFloor);
    }
  });

  it('never reports a detectable time when the models are identical', () => {
    const trajectory = simulateRealitySplit(params({ g: 0 }), {
      duration: 8,
      dt: 0.02,
      noiseFloor: 1e-9,
    });
    expect(trajectory.firstDetectableTime).toBeNull();
  });

  it('is deterministic for identical inputs', () => {
    const a = simulateRealitySplit(params({ g: 1.1 }), { duration: 5, dt: 0.02 });
    const b = simulateRealitySplit(params({ g: 1.1 }), { duration: 5, dt: 0.02 });

    expect(a.frames.length).toBe(b.frames.length);
    expect(a.maxDivergence).toBe(b.maxDivergence);
    for (let i = 0; i < a.frames.length; i += 1) {
      expect(a.frames[i].deltaPB).toBe(b.frames[i].deltaPB);
    }
  });

  it('interpolates between frames when scrubbing and clamps outside the window', () => {
    const trajectory = simulateRealitySplit(params({ g: 1.1 }), { duration: 4, dt: 0.02 });

    const mid = sampleTrajectory(trajectory, 1.01);
    expect(mid.t).toBeGreaterThan(1.0);
    expect(mid.t).toBeLessThan(1.02);
    expect(mid.model.PA + mid.model.PB).toBeCloseTo(1, 6);

    const past = sampleTrajectory(trajectory, 999);
    expect(past.t).toBeCloseTo(trajectory.duration, 6);

    const before = sampleTrajectory(trajectory, -5);
    expect(before.t).toBe(0);
  });
});

describe('Divergence field', () => {
  const modes: SplitMode[] = ['two_site', 'scalar_kernel'];

  it.each(modes)('conserves probability in %s mode: the field integrates to zero', (mode) => {
    const p = params({ g: 1.6, phiA: -1.2, phiB: 1.1 });
    const trajectory = simulateRealitySplit(p, { duration: 4, dt: 0.02 });
    const frame = sampleTrajectory(trajectory, 2.4);
    const field = computeDivergenceField(mode, p, frame, 240);

    // Both predicted distributions are normalized, so their difference must
    // integrate to zero: the proposed model redistributes probability, it
    // never creates or destroys it.
    expect(integrate(field.rhoStandard)).toBeCloseTo(1, 6);
    expect(integrate(field.rhoModel)).toBeCloseTo(1, 6);
    expect(integrate(field.divergence)).toBeCloseTo(0, 6);
  });

  it.each(modes)('is identically zero in %s mode when its own coupling is off', (mode) => {
    // Each sector has its own gating coupling: g for the two-site Hamiltonian,
    // α for the response kernel. compareModels' kernel branch never reads g, so
    // gating the kernel on g would contradict every number shown elsewhere.
    const p =
      mode === 'scalar_kernel'
        ? params({ alpha: 0, phiA: -1.5, phiB: 1.5 })
        : params({ g: 0, phiA: -1.5, phiB: 1.5 });
    const trajectory = simulateRealitySplit(p, { duration: 4, dt: 0.02 });
    const frame = sampleTrajectory(trajectory, 3);
    const field = computeDivergenceField(mode, p, frame, 160);

    expect(field.maxAbs).toBeCloseTo(0, 12);
    expect(field.l1).toBeCloseTo(0, 12);
  });

  it('produces a live kernel field whenever the scalar field actually varies', () => {
    // Regression guard: the field profile was linear in x while the code passed
    // a fabricated Laplacian −2(φB−φA)x. A linear field has ∇²φ ≡ 0, and for
    // β = 2, κ = 0.5 the bogus term cancelled βφ exactly — pinning ω_loc at ω₀,
    // making χ spatially constant, and leaving the scalar divergence field
    // identically empty for every parameter choice.
    const p = params({ alpha: 1.0, phiA: -1.5, phiB: 1.5 });
    const frame = sampleTrajectory(simulateRealitySplit(p, { duration: 1, dt: 0.05 }), 0);
    const field = computeDivergenceField('scalar_kernel', p, frame, 320);

    expect(field.maxAbs).toBeGreaterThan(1e-3);
    expect(field.l1).toBeGreaterThan(1e-3);
  });

  it('cancels the kernel effect exactly for a spatially flat field', () => {
    // A constant χ cancels in P_loc = χP_B/∫χP_B however large it is.
    const p = params({ alpha: 2.0, phiA: 0.9, phiB: 0.9 });
    const frame = sampleTrajectory(simulateRealitySplit(p, { duration: 1, dt: 0.05 }), 0);
    const field = computeDivergenceField('scalar_kernel', p, frame, 320);

    expect(field.maxAbs).toBeCloseTo(0, 12);
    expect(field.l1).toBeCloseTo(0, 12);
  });

  it('never makes the spatial field more distinguishable than the populations', () => {
    const p = params({ g: 1.8, phiA: -1.4, phiB: 1.4 });
    const trajectory = simulateRealitySplit(p, { duration: 6, dt: 0.02 });
    const frame = sampleTrajectory(trajectory, trajectory.maxDivergenceTime);
    const field = computeDivergenceField('two_site', p, frame, 400);

    // Data-processing inequality: coarse-graining site populations into a
    // spatial density cannot create distinguishability. The spatial L1
    // separation must therefore stay at or below 2 × the population trace
    // distance, the deficit being exactly the Gaussian overlap of the wells.
    expect(field.l1).toBeGreaterThan(0);
    expect(field.l1).toBeLessThanOrEqual(2 * frame.traceDistance + 1e-9);
    // The wells are separated enough that most of the signal survives.
    expect(field.l1).toBeGreaterThan(1.6 * frame.traceDistance);
  });

  it('builds an (x, t) map with one column per sampled instant', () => {
    const p = params({ g: 1.2 });
    const trajectory = simulateRealitySplit(p, { duration: 6, dt: 0.02 });
    const map = computeDivergenceMap('two_site', p, trajectory, 32, 48);

    expect(map.columns.length).toBe(32);
    expect(map.times.length).toBe(32);
    expect(map.columns[0].length).toBe(48);
    expect(map.times[0]).toBe(0);
    expect(map.times[31]).toBeCloseTo(trajectory.duration, 6);
    expect(map.maxAbs).toBeGreaterThan(0);
  });
});
