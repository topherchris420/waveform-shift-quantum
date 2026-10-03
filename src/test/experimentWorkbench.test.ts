import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Text } from "@/lib/passport/canonical";
import {
  buildResearchQuestion,
  createExperimentRecord,
  DEFAULT_QUESTION,
  DEFAULT_SPEC,
  experimentCsv,
  inspectReplay,
  MAX_RECORD_BYTES,
  PRESETS,
  PROTOCOL,
  replayExperiment,
  runExperiment,
  type ExperimentRecord,
} from "@/experiments/engine";
import { WOODYARD_TWO_SITE } from "@/lib/researchModels";

const small = { ...DEFAULT_SPEC, samples: 3 };
async function resign(
  record: Awaited<ReturnType<typeof createExperimentRecord>> | Record<string, unknown>,
) {
  const { digest: _digest, ...body } = record as Record<string, unknown>;
  (record as Record<string, unknown>).digest = await sha256Text(canonicalJson(body));
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
      "coupling,maxSeparation,meanSeparation,peakTime,normError,timestepError,quarterStepError," +
        "PA_dt_vs_dt2,PA_dt2_vs_dt4,PB_dt_vs_dt2,PB_dt2_vs_dt4,traceDistance_dt_vs_dt2,traceDistance_dt2_vs_dt4," +
        "maxDivergence_dt_vs_dt2,maxDivergence_dt2_vs_dt4,meanDivergence_dt_vs_dt2,meanDivergence_dt2_vs_dt4," +
        "coherence_dt_vs_dt2,coherence_dt2_vs_dt4",
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
    ).rejects.toThrow("256 KB");
  });
});

const fixture = readFileSync("src/test/fixtures/waveform-experiment.v1.json", "utf8");

describe("protocol v1 compatibility", () => {
  it("replays a record exported before v2 under its own protocol, without reinterpreting it", async () => {
    const outcome = await inspectReplay(fixture);
    expect(outcome.record.schema).toBe("waveform-experiment.v1");
    expect(outcome.record.digest).toBe(JSON.parse(fixture).digest);
    expect(outcome.notices.join(" ")).toContain("Legacy v1 record");
    // v1 CSV keeps its original six columns.
    expect(experimentCsv(outcome.record).split("\n")[0]).toBe(
      "coupling,maxSeparation,meanSeparation,peakTime,normError,timestepError",
    );
  });

  it("still detects tampering in a v1 record", async () => {
    const record = JSON.parse(fixture);
    record.results.points[1].maxSeparation = 0;
    await expect(replayExperiment(await resign(record))).rejects.toThrow("Replay failed");
    record.spec.mixing = 0.5;
    await expect(replayExperiment(JSON.stringify(record))).rejects.toThrow("Integrity check failed");
  });

  it("refuses a v1 record that claims the v2 protocol", async () => {
    const record = JSON.parse(fixture);
    record.protocol = PROTOCOL;
    await expect(replayExperiment(await resign(record))).rejects.toThrow("Unsupported experiment protocol");
  });
});

describe("protocol v2 record", () => {
  it("preserves everything needed to audit the calculation", async () => {
    const record = (await createExperimentRecord(small, "test-source")) as ExperimentRecord;
    expect(record.schema).toBe("waveform-experiment.v2");
    expect(record.protocol).toMatchObject({ id: "two-site-coupling-sweep.v2", timestepLadder: [1, 0.5, 0.25] });
    expect((record.protocol as typeof PROTOCOL).units).toMatchObject({ kind: "dimensionless", hbar: 1, timeUnit: "ħ/ε₀" });
    const proposed = record.model.proposed as typeof WOODYARD_TWO_SITE;
    expect(proposed.id).toBe("woodyard-two-site-v1");
    expect(proposed.epistemicClass).toBe("proposed");
    expect(proposed.assumptions.length).toBeGreaterThan(3);
    expect(proposed.parameters.every((p) => p.bounds || p.value !== undefined)).toBe(true);
    expect(proposed.units.quantities.find((q) => q.symbol === "g")?.calibration).toBe("underspecified");
    expect((record.model.observables as { id: string }[]).map((o) => o.id)).toContain("site-b-occupation");
    expect(record.question.nulls.length).toBeGreaterThanOrEqual(3);
    expect(record.question.rejectionCriteria.length).toBeGreaterThan(0);
    const ids = record.results.integrity.map((c) => c.id);
    for (const id of [
      "g-zero-reduction",
      "uniform-field-null-static",
      "uniform-field-null-driven",
      "zero-mixing-limit",
      "equal-energy-sign-symmetry",
      "timestep-dt-half",
      "timestep-half-quarter",
      "convergence-trend",
      "hamiltonian-hermiticity",
      "probability-conservation",
    ]) {
      expect(ids).toContain(id);
    }
    expect(record.results.convergence.map((m) => m.metric)).toEqual([
      "PA",
      "PB",
      "traceDistance",
      "maxDivergence",
      "meanDivergence",
      "coherence",
    ]);
    expect(record.results.points[1].ladder.PB).toHaveLength(2);
    expect(record.sourceCommit).toBe("test-source");
    expect(record.createdAt).toMatch(/^\d{4}-/);
  });

  it("backs every declared invariant and limiting case with an executed check", () => {
    const { integrity } = runExperiment(DEFAULT_SPEC);
    for (const claim of [...WOODYARD_TWO_SITE.invariants, ...WOODYARD_TWO_SITE.limitingCases]) {
      const check = integrity.find((c) => c.id === claim.checkId);
      expect(check, claim.checkId).toBeDefined();
      expect(check?.source).toBe("executed");
    }
  });

  it("never lets declared metadata pass, and keeps the empirical gate closed", () => {
    const { integrity, assessment } = runExperiment(DEFAULT_SPEC);
    for (const c of integrity.filter((x) => x.source === "metadata")) {
      expect(c.status).toBe("warning");
    }
    expect(assessment.gates.find((g) => g.id === "empirical")?.outcome).toBe("not_evaluable");
    expect(assessment.empiricalStatus).toBe("empirical_result_required");
    expect(JSON.stringify(assessment).toLowerCase()).not.toContain("confirmed");
  });

  it("reports the effect as present for the driven preset and absent for the null control", () => {
    expect(runExperiment(small).assessment.status).toBe("simulation_effect_present");
    expect(runExperiment({ ...PRESETS[2].spec, samples: 3 }, PRESETS[2].question).assessment.status).toBe(
      "simulation_effect_absent",
    );
  });

  it("judges against a resolution declared before the run", () => {
    const below = runExperiment(small, { ...DEFAULT_QUESTION, declaredResolution: 0.99 });
    expect(below.assessment.status).toBe("prediction_below_declared_resolution");
  });

  it("rejects a tampered integrity check or research question even when rehashed", async () => {
    const record = await createExperimentRecord(small, "test-source");
    const original = JSON.stringify(record);
    const tampered = JSON.parse(original);
    tampered.results.integrity.find((c: { id: string }) => c.id === "zero-mixing-limit").status = "fail";
    await expect(replayExperiment(await resign(tampered))).rejects.toThrow("Replay failed");
    const reworded = JSON.parse(original);
    reworded.question.baseline = "anything";
    await expect(replayExperiment(await resign(reworded))).rejects.toThrow("research question card");
  });

  it("never displays prose taken from an imported file", async () => {
    const record = await createExperimentRecord(small, "test-source");
    const forged = JSON.parse(JSON.stringify(record));
    const check = forged.results.integrity.find((c: { id: string }) => c.id === "static-detuning-degeneracy");
    check.label = "Coupling confirmed";
    check.explanation = "The effect is established in nature.";
    forged.results.assessment.statement = "Theory confirmed.";
    const outcome = await inspectReplay(await resign(forged));
    // Numbers and statuses still agree, so the replay is accepted…
    expect(outcome.record).toEqual(forged);
    // …but what is shown is regenerated by this build, and the difference is disclosed.
    if (outcome.display.schema !== "waveform-experiment.v2") throw new Error("expected v2");
    const shown = outcome.display.results.integrity.find((c) => c.id === "static-detuning-degeneracy");
    expect(shown?.label).toBe("Static coupling indistinguishable from bare detuning");
    expect(shown?.explanation).not.toContain("established in nature");
    expect(outcome.display.results.assessment.statement).not.toContain("Theory confirmed");
    expect(outcome.notices.join(" ")).toContain("explanatory text differs");
  });

  it("adds no notice when an unmodified record replays", async () => {
    const record = await createExperimentRecord(small, "test-source");
    const outcome = await inspectReplay(JSON.stringify(record));
    expect(outcome.notices).toEqual([]);
    expect(outcome.display).toEqual(record);
  });

  it("builds the question card from intent and protocol, not free text", () => {
    const card = buildResearchQuestion(DEFAULT_QUESTION, small);
    expect(card.independentVariables[0]).toContain("0 → 1.6 in 3 samples");
    expect(() => buildResearchQuestion({ ...DEFAULT_QUESTION, question: " " }, small)).toThrow();
    expect(() => buildResearchQuestion({ ...DEFAULT_QUESTION, declaredResolution: 0 }, small)).toThrow();
  });
});
