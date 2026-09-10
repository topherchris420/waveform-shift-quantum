/** Fixed simulation steps per elapsed wall time, independent of display refresh.
 * Long gaps are discarded: a suspended tab must not trigger a catch-up storm.
 */
export function createSimulationClock(dt: number, maxStepsPerFrame = 4) {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
    throw new RangeError('Clock requires positive dt and a positive integer step budget');
  }
  let lastTimestamp: number | null = null;
  let accumulator = 0;
  return {
    reset() {
      lastTimestamp = null;
      accumulator = 0;
    },
    advance(timestamp: number): number {
      if (!Number.isFinite(timestamp)) throw new RangeError('Timestamp must be finite');
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        return 0;
      }
      const elapsed = Math.max(0, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      accumulator += Math.min(elapsed, dt * maxStepsPerFrame);
      const steps = Math.min(maxStepsPerFrame, Math.floor((accumulator + 1e-10) / dt));
      accumulator = Math.max(0, accumulator - steps * dt);
      return steps;
    },
  };
}
