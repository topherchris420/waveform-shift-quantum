import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Text } from "@/lib/passport/canonical";
import {
  createExperimentRecord,
  DEFAULT_SPEC,
  experimentCsv,
  MAX_RECORD_BYTES,
  PRESETS,
  replayExperiment,
  runExperiment,
} from "@/experiments/engine";

const small = { ...DEFAULT_SPEC, samples: 3 };
async function resign(
  record: Awaited<ReturnType<typeof createExperimentRecord>>,
) {
  const { digest: _digest, ...body } = record;
  record.digest = await sha256Text(canonicalJson(body));
  return JSON.stringify(record);
}

describe("replayable two-site experiment", () => {
  it("is deterministic, includes both endpoints, and passes independent numerical controls", () => {
    const result = runExperiment(small);
    expect(runExperiment(small)).toEqual(result);
    expect(result.points.map((p) => p.coupling)).toEqual([0, 0.8, 1.6]);
    expect(result.points[0].maxSeparation).toBe(0);
    expect(result.points[1].maxSeparation).toBeGreaterThan(0.1);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
  });

  it("the uniform static field control cannot produce a population effect", () => {
    const result = runExperiment({ ...PRESETS[2].spec, samples: 5 });
    expect(result.points.every((p) => p.maxSeparation === 0)).toBe(true);
  });

  it("retains a zero-coupling sweep without NaN or divide-by-zero output", () => {
    const result = runExperiment({ ...small, maxCoupling: 0 });
    expect(result.points.every((p) => p.maxSeparation === 0)).toBe(true);
  });

  it.each([
    { samples: 1000000 },
    { samples: 2.5 },
    { samples: 1 },
    { maxCoupling: Infinity },
    { fieldContrast: NaN },
    { mixing: 0 },
    { driveAmplitude: -1 },
    { duration: 1e9 },
  ])("rejects invalid or unbounded input %j before running", (patch) => {
    expect(() => runExperiment({ ...small, ...patch })).toThrow();
  });

  it("exports and replays a complete record, retaining provenance", async () => {
    const record = await createExperimentRecord(small, "test-source");
    expect(await replayExperiment(JSON.stringify(record))).toEqual(record);
    expect(record.classification).toBe("simulation-only");
    expect(record.digest).toMatch(/^[0-9a-f]{64}$/);
    const csv = experimentCsv(record).trim().split("\n");
    expect(csv).toHaveLength(4);
    expect(csv[0]).toBe(
      "coupling,maxSeparation,meanSeparation,peakTime,normError,timestepError",
    );
    expect(csv[2].split(",").map(Number)[0]).toBe(0.8);
  });

  it("rejects corruption before trusting the recorded checks", async () => {
    const record = await createExperimentRecord(small, "test-source");
    record.spec.mixing = 0.5;
    await expect(replayExperiment(JSON.stringify(record))).rejects.toThrow(
      "Integrity check failed",
    );
  });

  it("rejects fabricated results even with a valid recomputed digest", async () => {
    const record = await createExperimentRecord(small, "test-source");
    record.results.points[1].maxSeparation = 0;
    await expect(replayExperiment(await resign(record))).rejects.toThrow(
      "Replay failed",
    );
  });

  it("rejects fabricated checks and missing rows even when rehashed", async () => {
    const record = await createExperimentRecord(small, "test-source");
    record.results.checks.normalization = false;
    await expect(replayExperiment(await resign(record))).rejects.toThrow(
      "Replay failed",
    );
    record.results.checks.normalization = true;
    record.results.points.pop();
    await expect(replayExperiment(await resign(record))).rejects.toThrow(
      "Replay failed",
    );
  });

  it("does not silently replay a different integration protocol", async () => {
    const record = await createExperimentRecord(small, "test-source");
    record.protocol = { dt: 0.1 };
    await expect(replayExperiment(await resign(record))).rejects.toThrow(
      "Unsupported experiment protocol",
    );
  });

  it("rejects non-finite JSON numbers, unknown properties, and oversized files", async () => {
    const record = await createExperimentRecord(small, "test-source");
    await expect(
      replayExperiment(
        JSON.stringify(record).replace(
          '"maxCoupling":1.6',
          '"maxCoupling":1e999',
        ),
      ),
    ).rejects.toThrow("invalid experiment record");
    await expect(
      replayExperiment(JSON.stringify({ ...record, extra: true })),
    ).rejects.toThrow("invalid experiment record");
    await expect(
      replayExperiment(" ".repeat(MAX_RECORD_BYTES + 1)),
    ).rejects.toThrow("100 KB");
  });
});
