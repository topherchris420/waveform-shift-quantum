import { describe, it, expect } from "vitest";
import { createDemo } from "../../systemic-lab/scenarios";
import {
  createPolicyPassport,
  verifyPolicyPassport,
  replaySimulation,
  exactCanonical,
} from "../../systemic-lab/passport";
describe("Replayable policy passports", () => {
  it("round trips through JSON and replays every event and outcome", async () => {
    const p = await createPolicyPassport(createDemo("intraday-settlement"));
    const decoded = JSON.parse(JSON.stringify(p));
    expect(await verifyPolicyPassport(decoded)).toBe(true);
    const replay = await replaySimulation(decoded);
    expect(replay.equivalent).toBe(true);
    expect(replay.result).toEqual(p.outcome);
    expect(Object.isFrozen(p.scenario.actors[0])).toBe(true);
  });
  it("detects changed input, timestamp, model version, events and output", async () => {
    const p = await createPolicyPassport(createDemo());
    for (const mutate of [
      (v: typeof p) => {
        v.scenario.actors[0].balanceSheet.equity++;
      },
      (v: typeof p) => {
        v.generatedAt = "2026-01-01T00:00:00.000Z";
      },
      (v: typeof p) => {
        v.outcome.summary.liquidityShortfall++;
      },
      (v: typeof p) => {
        v.outcome.events[0].amount++;
      },
    ]) {
      const c = structuredClone(p);
      mutate(c);
      expect(await verifyPolicyPassport(c)).toBe(false);
    }
    expect(
      await verifyPolicyPassport({
        ...p,
        canonicalVersion: "scientific-e13.v1",
      }),
    ).toBe(false);
  });
  it("preserves round-trip numeric precision and rejects non-finite data", () => {
    expect(exactCanonical({ b: 1.000000000000001, a: 2 })).toBe(
      '{"a":2,"b":1.000000000000001}',
    );
    expect(() => exactCanonical({ a: NaN })).toThrow();
  });
});
