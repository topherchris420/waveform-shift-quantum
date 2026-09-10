import { describe, expect, it } from 'vitest';
import { createSimulationClock } from '../arfr/clock';
import { createDefaultARFRConfig, createSimulation, runBuiltInExperiment, stepSimulation, summarizeExperiment, validateARFRConfig } from '../arfr/engine';
import { createARFRPassport, verifyARFRPassport } from '../arfr/passport';

const small = { particleCount: 12, fieldResolution: { x: 5, y: 5, z: 3 } };

describe('ARFR experiment integrity', () => {
  it('reports the mean and peak of all simulated steps in interactive exports', async () => {
    const run = runBuiltInExperiment('translation', small, 12);
    const passport = await createARFRPassport({ experiment: 'interactive_session', state: run.finalState });
    const mean = run.trace.reduce((sum, sample) => sum + sample.positionError, 0) / run.trace.length;
    expect(passport.results.meanPositionError).toBeCloseTo(mean, 12);
    expect(passport.results.peakLockQuality).toBe(Math.max(...run.trace.map(sample => sample.lockQuality)));
    expect(passport.results).toEqual(run.summary);
    expect(passport.provenance.completedSteps).toBe(12);
    expect(passport.provenance.elapsedSimulationTime).toBe(run.finalState.time);
  });

  it('retains topology history even after the visual event log is discarded', () => {
    const state = createSimulation(createDefaultARFRConfig(small));
    state.statistics.splitDetected = true;
    state.statistics.mergeDetected = true;
    state.events = [];
    const next = stepSimulation(state);
    expect(summarizeExperiment(next)).toMatchObject({ splitDetected: true, mergeDetected: true });
  });

  it('isolates the simulation grid settings from later caller mutations', () => {
    const config = createDefaultARFRConfig(small);
    const state = createSimulation(config);
    config.fieldResolution.x = 999;
    expect(state.config.fieldResolution.x).toBe(5);
  });

  it('hashes omitted-in-v1 numerical settings and snapshots them without aliases', async () => {
    const state = createSimulation(createDefaultARFRConfig(small));
    const first = await createARFRPassport({ experiment: 'test', state });
    state.config.dt = 0.1;
    const second = await createARFRPassport({ experiment: 'test', state });
    expect(first.integrity.identityHash).not.toBe(second.integrity.identityHash);
    expect(first.provenance.configuration.dt).toBe(0.05);
    await expect(verifyARFRPassport(first)).resolves.toBe(true);
    first.provenance.configuration.threshold = 0.7;
    await expect(verifyARFRPassport(first)).resolves.toBe(false);
  });

  it('rejects unsupported canonicalization and malformed artifacts without throwing', async () => {
    const passport = await createARFRPassport({ experiment: 'test', state: createSimulation(createDefaultARFRConfig(small)) });
    passport.integrity.canonicalNumberVersion = 'unknown';
    for (const value of [passport, null, [], {}, { integrity: {} }]) {
      await expect(verifyARFRPassport(value)).resolves.toBe(false);
    }
  });

  it.each([
    ['threshold', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.threshold = NaN; }],
    ['mass', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.medium.mass = NaN; }],
    ['bounds', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.bounds.min.x = -Infinity; }],
    ['particleCount', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.particleCount = 12.5; }],
    ['position', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.sources[0].position.y = NaN; }],
    ['controller', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.controller.maxPhaseStep = Infinity; }],
    ['resolution', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.fieldResolution = { x: 1000, y: 1000, z: 1000 }; }],
    ['route', (c: ReturnType<typeof createDefaultARFRConfig>) => { c.route.duration = 0; }],
  ])('rejects invalid %s before allocating or stepping', (_, mutate) => {
    const config = createDefaultARFRConfig(small);
    mutate(config);
    expect(() => validateARFRConfig(config)).toThrow();
  });

  it.each([-1, 1.5, NaN, Infinity])('rejects invalid step count %s', steps => {
    expect(() => runBuiltInExperiment('translation', small, steps)).toThrow(/steps/);
  });
});

describe('ARFR wall-time clock', () => {
  it('advances the same number of fixed steps at 30, 60 and 144 Hz', () => {
    for (const hz of [30, 60, 144]) {
      const clock = createSimulationClock(0.05);
      let steps = 0;
      for (let frame = 0; frame <= hz * 10; frame++) steps += clock.advance(frame * 1000 / hz);
      expect(steps).toBe(200);
    }
  });

  it('caps long frame gaps and discards paused time on reset', () => {
    const clock = createSimulationClock(0.05);
    clock.advance(0);
    expect(clock.advance(60000)).toBe(4);
    clock.reset();
    expect(clock.advance(120000)).toBe(0);
    expect(clock.advance(120050)).toBe(1);
  });
});
