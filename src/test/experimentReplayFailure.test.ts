import { describe, expect, it, vi } from "vitest";

// Simulate an implementation whose Δ = 0 limit is broken. The same broken code
// is used to create and to replay the record, so the computation reproduces —
// and the record must still report the failure.
vi.mock("@/quantum/validation/twoSite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/quantum/validation/twoSite")>();
  return {
    ...actual,
    checkZeroMixingLimit: () => ({
      id: "zero-mixing-limit",
      label: "Δ = 0: no population transfer",
      category: "limit" as const,
      gate: "model" as const,
      status: "fail" as const,
      source: "executed" as const,
      measured: 0.25,
      tolerance: 1e-12,
      explanation: "Injected failure.",
    }),
  };
});

const { createExperimentRecord, DEFAULT_SPEC, inspectReplay } = await import("@/experiments/engine");

describe("reproducibility is not validity", () => {
  it("replays a record whose invariant failed and keeps it failed", async () => {
    const record = await createExperimentRecord({ ...DEFAULT_SPEC, samples: 3 }, "test-source");
    if (record.schema !== "waveform-experiment.v2") throw new Error("expected v2");
    expect(record.results.assessment.status).toBe("falsified_in_tested_parameter_region");
    expect(record.results.assessment.gates.find((g) => g.id === "model")?.outcome).toBe("fail");

    const { record: replayed } = await inspectReplay(JSON.stringify(record));
    expect(replayed).toEqual(record);
    if (replayed.schema !== "waveform-experiment.v2") throw new Error("expected v2");
    expect(replayed.results.integrity.find((c) => c.id === "zero-mixing-limit")?.status).toBe("fail");
    expect(replayed.results.assessment.statement).toContain("not an empirical falsification");
  });
});
