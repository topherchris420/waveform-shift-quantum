import { describe, it, expect } from "vitest";
import {
  SystemicSignalSchema,
  initializeScenarioFromSystemicSignal,
  compareHypotheses,
  EXAMPLE_SYSTEMIC_SIGNAL,
} from "../../systemic-lab/bridge";
import { createDemo } from "../../systemic-lab/scenarios";
describe("DRR signal as competing scenario hypotheses", () => {
  it("creates six distinct hypotheses without mutating the observation or base", () => {
    const base = createDemo();
    const before = structuredClone(base);
    const x = initializeScenarioFromSystemicSignal(
      EXAMPLE_SYSTEMIC_SIGNAL,
      base,
      "us-branch",
    );
    expect(x.hypotheses).toHaveLength(6);
    expect(
      x.hypotheses.find((h) => h.id === "insufficient-evidence")?.initialShock,
    ).toEqual([]);
    for (const hypothesis of x.hypotheses)
      expect(
        hypothesis.scenario.evidence.some(
          (row) => row.id === EXAMPLE_SYSTEMIC_SIGNAL.evidenceIds[0],
        ),
      ).toBe(true);
    expect(base).toEqual(before);
  });
  it("requires an explicit simulation actor mapping and strict source metadata", () => {
    expect(() =>
      initializeScenarioFromSystemicSignal(
        EXAMPLE_SYSTEMIC_SIGNAL,
        createDemo(),
        "not-present",
      ),
    ).toThrow();
    expect(() =>
      SystemicSignalSchema.parse({ ...EXAMPLE_SYSTEMIC_SIGNAL, confidence: 2 }),
    ).toThrow();
    expect(() =>
      SystemicSignalSchema.parse({
        ...EXAMPLE_SYSTEMIC_SIGNAL,
        provenance: [],
      }),
    ).toThrow();
    expect(() =>
      SystemicSignalSchema.parse({
        ...EXAMPLE_SYSTEMIC_SIGNAL,
        evidenceIds: ["same", "same"],
      }),
    ).toThrow("Duplicate signal evidence ID");
  });
  it("does not pretend z-scores are dollars or proof of causality", () => {
    const s = structuredClone(EXAMPLE_SYSTEMIC_SIGNAL);
    s.affectedMetrics.forEach((m) => (m.units = "z-score"));
    const result = compareHypotheses(
      initializeScenarioFromSystemicSignal(
        s,
        createDemo("intraday-settlement"),
        "us-branch",
      ),
    );
    expect(result.ranking.every((r) => r.status === "not discriminated")).toBe(
      true,
    );
    expect(result.summary).toContain("Insufficient evidence");
    expect(result.evidenceBoundary).toContain("does not identify causation");
    expect(result.signal).toEqual(s);
    expect(result.hypotheses).toHaveLength(6);
  });
});
