import { z } from "zod";
import { DEFAULT_SPLIT_PARAMS, simulateRealitySplit } from "@/lib/realitySplit";
import type { RealitySplitParams } from "@/lib/realitySplit";
import { canonicalJson, sha256Text } from "@/lib/passport/canonical";
import {
  RESEARCH_GATE_ORDER,
  RESEARCH_STATUSES,
  type ResearchStatus,
} from "@/lib/epistemics";
import { OBSERVABLES } from "@/lib/observables";
import { STANDARD_TWO_SITE, WOODYARD_TWO_SITE } from "@/lib/researchModels";
import { SIMULATION_UNITS, TWO_SITE_UNITS } from "@/lib/units";
import {
  CONVERGENCE_METRICS,
  assessRun,
  checkAtMost,
  checkBaselineClosedForm,
  checkCalibrationClaims,
  checkCommonModeDrivenNull,
  checkCommonModeStaticNull,
  checkCouplingSignSymmetry,
  checkDimensionalConsistency,
  checkFinite,
  checkPropagatorAgainstExpm,
  checkPropagatorUnitarity,
  checkStaticDetuningDegeneracy,
  checkStaticModelClosedForm,
  checkStepHamiltonians,
  checkTwoSiteDensityRendering,
  checkUniformFieldGlobalPhase,
  checkUnitLabels,
  checkZeroMixingLimit,
  compactResult,
  convergenceChecks,
  metadataWarning,
  runTimestepLadder,
  summarizeLadders,
  unitSpecificationWarning,
  zeroCouplingResult,
  type ConvergenceMetricId,
  type TwoSiteCheckConfig,
  type VerificationResult,
} from "@/quantum/validation";

export const SPEC_SCHEMA = z.strictObject({
  maxCoupling: z.number().finite().min(0).max(2),
  fieldContrast: z.number().finite().min(0).max(2),
  mixing: z.number().finite().min(0.05).max(1),
  driveAmplitude: z.number().finite().min(0).max(1),
  samples: z.number().int().min(2).max(41),
});
export type ExperimentSpec = z.infer<typeof SPEC_SCHEMA>;
export const DEFAULT_SPEC: ExperimentSpec = {
  maxCoupling: 1.6,
  fieldContrast: 1.2,
  mixing: 0.25,
  driveAmplitude: 0.4,
  samples: 21,
};

/**
 * Legacy protocol. Kept byte-for-byte so records exported before v2 replay
 * under the exact rules they were created with. New runs never use it.
 */
export const PROTOCOL_V1 = {
  id: "two-site-coupling-sweep.v1",
  duration: 12,
  dt: 0.02,
  initialState: "A",
  bareEnergyA: 1,
  bareEnergyB: 1,
  driveOmega: 1.5,
  normalizationTolerance: 1e-10,
  controlTolerance: 1e-12,
  convergenceTolerance: 1e-3,
} as const;

/**
 * Current protocol. Same physics and inputs as v1; adds a dt → dt/2 → dt/4
 * convergence ladder, limiting-case and invariant checks, a machine-readable
 * unit declaration, and a research question bound into the record.
 */
export const PROTOCOL = {
  id: "two-site-coupling-sweep.v2",
  modelId: WOODYARD_TWO_SITE.id,
  baselineModelId: STANDARD_TWO_SITE.id,
  units: SIMULATION_UNITS,
  duration: 12,
  dt: 0.02,
  timestepLadder: [1, 0.5, 0.25],
  initialState: "A",
  bareEnergyA: 1,
  bareEnergyB: 1,
  driveOmega: 1.5,
  integrator:
    "Exact exp(−iH dt) of each frozen step Hamiltonian; a driven H(t) is frozen at the step midpoint (exponential midpoint rule, global error O(dt²)). Static Hamiltonians carry no discretisation error.",
  normalizationTolerance: 1e-10,
  controlTolerance: 1e-12,
  analyticTolerance: 1e-10,
  convergenceTolerance: 1e-3,
  roundoffFloor: 1e-10,
  minimumObservedOrder: 1.5,
} as const;

export const QUESTION_INPUT_SCHEMA = z.strictObject({
  question: z.string().trim().min(1).max(600),
  hypothesis: z.string().trim().min(1).max(600),
  /** Smallest separation the proposed test could resolve, declared before running. */
  declaredResolution: z.number().finite().gt(0).max(1).nullable(),
});
export type ResearchQuestionInput = z.infer<typeof QUESTION_INPUT_SCHEMA>;

export const DEFAULT_QUESTION: ResearchQuestionInput = {
  question:
    "Does the proposed scalar coupling create a population evolution distinguishable from the g = 0 baseline?",
  hypothesis:
    "A spatially varying scalar contribution changes the predicted two-site trajectory.",
  declaredResolution: null,
};

export const PRESETS: {
  name: string;
  description: string;
  spec: ExperimentSpec;
  question: ResearchQuestionInput;
}[] = [
  {
    name: "Driven field",
    description: "Sweep coupling while the field oscillates.",
    spec: DEFAULT_SPEC,
    question: DEFAULT_QUESTION,
  },
  {
    name: "Static field",
    description: "Isolate the effect of static field contrast.",
    spec: { ...DEFAULT_SPEC, driveAmplitude: 0 },
    question: {
      question:
        "Does a static field contrast alone change the two-site trajectory relative to g = 0?",
      hypothesis:
        "A static gradient g(φB − φA) shifts the effective detuning and therefore the population evolution.",
      declaredResolution: null,
    },
  },
  {
    name: "Null control",
    description:
      "A spatially uniform, static field should not change populations.",
    spec: { ...DEFAULT_SPEC, fieldContrast: 0, driveAmplitude: 0 },
    question: {
      question: "Does the implementation produce any effect when the field is uniform?",
      hypothesis:
        "A uniform field adds g·φ·I to H — a global phase — so no population effect should appear at any coupling.",
      declaredResolution: null,
    },
  },
];

const questionCardSchema = z.strictObject({
  question: z.string(),
  hypothesis: z.string(),
  declaredResolution: z.number().finite().nullable(),
  baseline: z.string(),
  nulls: z.array(z.string()),
  independentVariables: z.array(z.string()),
  observables: z.array(z.string()),
  numericalRequirements: z.array(z.string()),
  rejectionCriteria: z.array(z.string()),
});
export type ResearchQuestion = z.infer<typeof questionCardSchema>;

/** The full card is generated from the user's intent and the protocol, never typed in. */
export function buildResearchQuestion(
  input: ResearchQuestionInput,
  spec: ExperimentSpec,
): ResearchQuestion {
  const q = QUESTION_INPUT_SCHEMA.parse(input);
  const s = SPEC_SCHEMA.parse(spec);
  return {
    question: q.question,
    hypothesis: q.hypothesis,
    declaredResolution: q.declaredResolution,
    baseline:
      "g = 0: established two-site QM from the same initial state |A⟩, on the same time grid and propagator.",
    nulls: [
      "g = 0 (first sweep sample; fields and drive left on)",
      "Uniform static field φA = φB at the largest sampled g",
      "Uniform driven field φA(t) = φB(t) at the largest sampled g",
    ],
    independentVariables: [
      `g swept 0 → ${s.maxCoupling} in ${s.samples} samples`,
      `field contrast φB − φA = ${s.fieldContrast}`,
      `mixing Δ = ${s.mixing} ε₀`,
      `drive amplitude a = ${s.driveAmplitude}`,
    ],
    observables: [
      "P_B(t)",
      "trace distance D(t)",
      "maximum divergence",
      "mean divergence",
    ],
    numericalRequirements: [
      `norm error ≤ ${PROTOCOL.normalizationTolerance}`,
      `controls ≤ ${PROTOCOL.controlTolerance}`,
      `ladder agreement ≤ ${PROTOCOL.convergenceTolerance} at dt, dt/2 and dt/4`,
      `observed order ≥ ${PROTOCOL.minimumObservedOrder}, or agreement at rounding level`,
    ],
    rejectionCriteria: [
      "Any numerical check fails → numerically unstable; no separation is interpreted.",
      "Any null control produces an effect → control failed; no separation is interpreted.",
      "Any limiting case or invariant fails → failed in the tested region (implementation level).",
      `Largest separation ≤ ${PROTOCOL.controlTolerance} → simulation effect absent.`,
      "Largest separation ≤ 10 × the finest ladder error → inconclusive.",
      q.declaredResolution === null
        ? "No resolution declared: the run cannot be judged below or above an instrument’s reach."
        : `Largest separation < ${q.declaredResolution} (declared before the run) → below declared resolution.`,
      "Whatever the simulation shows, the empirical question stays open.",
    ],
  };
}

const finite = z.number().finite();
const ladderSchema = z.strictObject(
  Object.fromEntries(
    CONVERGENCE_METRICS.map(({ id }) => [id, z.tuple([finite, finite])]),
  ) as Record<ConvergenceMetricId, z.ZodTuple<[typeof finite, typeof finite]>>,
);

const pointSchemaV1 = z.strictObject({
  coupling: finite,
  maxSeparation: finite,
  meanSeparation: finite,
  peakTime: finite,
  normError: finite,
  timestepError: finite,
});
const pointSchema = pointSchemaV1.extend({
  /** error(dt/2, dt/4) for P_B, both branches — the finest ladder rung. */
  quarterStepError: finite,
  ladder: ladderSchema,
});

const verificationSchema = z.strictObject({
  id: z.string().max(120),
  label: z.string().max(200),
  category: z.enum([
    "structure",
    "conservation",
    "convergence",
    "control",
    "limit",
    "symmetry",
    "invariant",
    "domain",
    "units",
    "identifiability",
    "calibration",
  ]),
  gate: z.enum(RESEARCH_GATE_ORDER as [string, ...string[]]),
  status: z.enum(["pass", "fail", "warning", "not_applicable"]),
  source: z.enum(["executed", "metadata"]),
  measured: finite.optional(),
  tolerance: finite.optional(),
  explanation: z.string().max(2000),
});

const assessmentSchema = z.strictObject({
  status: z.enum(Object.keys(RESEARCH_STATUSES) as [ResearchStatus, ...ResearchStatus[]]),
  empiricalStatus: z.literal("empirical_result_required"),
  gates: z.array(
    z.strictObject({
      id: z.enum(RESEARCH_GATE_ORDER as [string, ...string[]]),
      question: z.string(),
      outcome: z.enum(["pass", "fail", "warning", "not_evaluable"]),
      decidingChecks: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
  statement: z.string(),
});

const convergenceSchema = z.strictObject({
  metric: z.enum(CONVERGENCE_METRICS.map((m) => m.id) as [ConvergenceMetricId, ...ConvergenceMetricId[]]),
  coupling: finite,
  coarseVsHalf: finite,
  halfVsQuarter: finite,
  reduction: finite.nullable(),
  observedOrder: finite.nullable(),
  regime: z.enum(["roundoff", "asymptotic", "pre_asymptotic", "not_converging"]),
});

const resultsSchemaV1 = z.strictObject({
  points: z.array(pointSchemaV1).min(2).max(41),
  checks: z.strictObject({
    zeroCoupling: z.boolean(),
    normalization: z.boolean(),
    timestepConvergence: z.boolean(),
  }),
});
const resultsSchema = z.strictObject({
  points: z.array(pointSchema).min(2).max(41),
  checks: z.strictObject({
    zeroCoupling: z.boolean(),
    normalization: z.boolean(),
    timestepConvergence: z.boolean(),
    quarterStepConvergence: z.boolean(),
    convergenceTrend: z.boolean(),
  }),
  convergence: z.array(convergenceSchema),
  integrity: z.array(verificationSchema).max(64),
  assessment: assessmentSchema,
});
export type ExperimentResultsV1 = z.infer<typeof resultsSchemaV1>;
export type ExperimentResults = z.infer<typeof resultsSchema>;

function sweepParams(spec: ExperimentSpec, coupling: number): RealitySplitParams {
  return {
    ...DEFAULT_SPLIT_PARAMS,
    EA: PROTOCOL.bareEnergyA,
    EB: PROTOCOL.bareEnergyB,
    phiA: -spec.fieldContrast / 2,
    phiB: spec.fieldContrast / 2,
    delta: spec.mixing,
    driveAmplitude: spec.driveAmplitude,
    driveOmega: PROTOCOL.driveOmega,
    g: coupling,
  };
}

const couplingAt = (spec: ExperimentSpec, index: number) =>
  (spec.maxCoupling * index) / (spec.samples - 1);

/** Legacy v1 computation, unchanged. Used only to replay v1 records. */
export function runExperimentV1(input: ExperimentSpec): ExperimentResultsV1 {
  const spec = SPEC_SCHEMA.parse(input);
  const points = Array.from({ length: spec.samples }, (_, index) => {
    const coupling = couplingAt(spec, index);
    const params = sweepParams(spec, coupling);
    const coarse = simulateRealitySplit(params, {
      duration: PROTOCOL_V1.duration,
      dt: PROTOCOL_V1.dt,
    });
    const fine = simulateRealitySplit(params, {
      duration: PROTOCOL_V1.duration,
      dt: PROTOCOL_V1.dt / 2,
    });
    let normError = 0;
    let timestepError = 0;
    for (const frame of [...coarse.frames, ...fine.frames]) {
      normError = Math.max(
        normError,
        Math.abs(frame.standard.norm - 1),
        Math.abs(frame.model.norm - 1),
      );
    }
    coarse.frames.forEach((frame, i) => {
      // Compare both trajectories at identical times, not just their maxima.
      timestepError = Math.max(
        timestepError,
        Math.abs(frame.model.PB - fine.frames[i * 2].model.PB),
        Math.abs(frame.standard.PB - fine.frames[i * 2].standard.PB),
      );
    });
    return {
      coupling,
      maxSeparation: coarse.maxDivergence,
      meanSeparation: coarse.meanDivergence,
      peakTime: coarse.maxDivergenceTime,
      normError,
      timestepError,
    };
  });
  // Refuse non-finite engine output before checks or serialization can mask it.
  return resultsSchemaV1.parse({
    points,
    checks: {
      zeroCoupling: points[0].maxSeparation <= PROTOCOL_V1.controlTolerance,
      normalization: points.every(
        (p) => p.normError <= PROTOCOL_V1.normalizationTolerance,
      ),
      timestepConvergence: points.every(
        (p) => p.timestepError <= PROTOCOL_V1.convergenceTolerance,
      ),
    },
  });
}

/**
 * Run the v2 protocol. Every integrity item is computed here from this run's
 * inputs; metadata items can only warn. A failed check is returned, never
 * thrown, so it stays visible and exportable.
 */
export function runExperiment(
  input: ExperimentSpec,
  questionInput: ResearchQuestionInput = DEFAULT_QUESTION,
): ExperimentResults {
  const spec = SPEC_SCHEMA.parse(input);
  const question = QUESTION_INPUT_SCHEMA.parse(questionInput);
  const sampleParams: RealitySplitParams[] = [];
  let peakTrajectory = null as ReturnType<typeof simulateRealitySplit> | null;
  const points = Array.from({ length: spec.samples }, (_, index) => {
    const coupling = couplingAt(spec, index);
    const params = sweepParams(spec, coupling);
    sampleParams.push(params);
    const ladder = runTimestepLadder(params, PROTOCOL.duration, PROTOCOL.dt);
    const coarse = ladder.trajectories[0];
    if (index === spec.samples - 1) peakTrajectory = coarse;
    return {
      coupling,
      maxSeparation: coarse.maxDivergence,
      meanSeparation: coarse.meanDivergence,
      peakTime: coarse.maxDivergenceTime,
      normError: ladder.normError,
      timestepError: ladder.errors.PB[0],
      quarterStepError: ladder.errors.PB[1],
      ladder: ladder.errors,
    };
  });

  const convergence = summarizeLadders(
    points,
    PROTOCOL.roundoffFloor,
    PROTOCOL.minimumObservedOrder,
  );
  const config: TwoSiteCheckConfig = {
    params: sampleParams[sampleParams.length - 1],
    duration: PROTOCOL.duration,
    dt: PROTOCOL.dt,
    controlTolerance: PROTOCOL.controlTolerance,
    analyticTolerance: PROTOCOL.analyticTolerance,
  };
  const numbers = points.flatMap((p) => [
    p.coupling,
    p.maxSeparation,
    p.meanSeparation,
    p.peakTime,
    p.normError,
    ...Object.values(p.ladder).flat(),
  ]);
  const [dtHalf, halfQuarter, trend] = convergenceChecks(
    convergence,
    PROTOCOL.convergenceTolerance,
    PROTOCOL.minimumObservedOrder,
  );
  const integrity: VerificationResult[] = (
    [
    checkFinite(
      { id: "finite-outputs", label: "Finite outputs", category: "structure", gate: "code" },
      numbers,
    ),
    checkStepHamiltonians(sampleParams, PROTOCOL.duration, PROTOCOL.dt),
    checkPropagatorUnitarity(config),
    checkPropagatorAgainstExpm(config),
    checkAtMost(
      {
        id: "probability-conservation",
        label: "Probability conservation",
        category: "conservation",
        gate: "numerics",
      },
      Math.max(...points.map((p) => p.normError)),
      PROTOCOL.normalizationTolerance,
      "Largest |P_A + P_B − 1| over every frame of every ladder rung, both branches, every sample.",
    ),
    checkBaselineClosedForm(config),
    dtHalf,
    halfQuarter,
    trend,
    checkTwoSiteDensityRendering(config, peakTrajectory!),
    checkDimensionalConsistency(TWO_SITE_UNITS),
    zeroCouplingResult(points[0].maxSeparation, PROTOCOL.controlTolerance),
    checkCommonModeStaticNull(config),
    checkCommonModeDrivenNull(config),
    checkUniformFieldGlobalPhase(config),
    checkZeroMixingLimit(config),
    checkCouplingSignSymmetry(config),
    checkStaticModelClosedForm(config),
    checkUnitLabels(TWO_SITE_UNITS),
    checkCalibrationClaims(TWO_SITE_UNITS),
    checkStaticDetuningDegeneracy(config),
    unitSpecificationWarning(TWO_SITE_UNITS),
    metadataWarning(
      {
        id: "experimental-sensitivity",
        label: "Experimental sensitivity unknown",
        category: "calibration",
        gate: "empirical",
      },
      "No apparatus, resolution or noise model is specified for P_B. The required sensitivity is unknown, so no simulated separation can be called detectable.",
    ),
    ] satisfies VerificationResult[]
  ).map(compactResult);
  const status = (id: string) => integrity.find((c) => c.id === id)?.status;
  const maxSeparation = Math.max(...points.map((p) => p.maxSeparation));
  const numericalUncertainty = Math.max(
    ...points.map((p) => Math.max(p.ladder.traceDistance[1], p.ladder.maxDivergence[1])),
  );
  return resultsSchema.parse({
    points,
    checks: {
      zeroCoupling: status("g-zero-reduction") === "pass",
      normalization: status("probability-conservation") === "pass",
      timestepConvergence: status("timestep-dt-half") === "pass",
      quarterStepConvergence: status("timestep-half-quarter") === "pass",
      convergenceTrend: status("convergence-trend") !== "fail",
    },
    convergence,
    integrity,
    assessment: assessRun({
      checks: integrity,
      maxSeparation,
      effectFloor: PROTOCOL.controlTolerance,
      numericalUncertainty,
      declaredResolution: question.declaredResolution,
    }),
  });
}

/** Model metadata carried by every v2 record, so the record describes itself. */
export function modelMetadata() {
  return {
    proposed: WOODYARD_TWO_SITE,
    baseline: STANDARD_TWO_SITE,
    observables: OBSERVABLES.filter((o) =>
      WOODYARD_TWO_SITE.observables.includes(o.id),
    ),
  };
}

const recordSchemaV1 = z.strictObject({
  schema: z.literal("waveform-experiment.v1"),
  classification: z.literal("simulation-only"),
  protocol: z.unknown(),
  sourceCommit: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  spec: SPEC_SCHEMA,
  results: resultsSchemaV1,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
const recordSchema = z.strictObject({
  schema: z.literal("waveform-experiment.v2"),
  classification: z.literal("simulation-only"),
  protocol: z.unknown(),
  model: z.strictObject({
    proposed: z.unknown(),
    baseline: z.unknown(),
    observables: z.unknown(),
  }),
  question: questionCardSchema,
  sourceCommit: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  spec: SPEC_SCHEMA,
  results: resultsSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type LegacyExperimentRecord = z.infer<typeof recordSchemaV1>;
export type ExperimentRecord = z.infer<typeof recordSchema>;
export type AnyExperimentRecord = ExperimentRecord | LegacyExperimentRecord;
export const MAX_RECORD_BYTES = 262_144;

export async function createExperimentRecord(
  spec: ExperimentSpec,
  sourceCommit: string,
  questionInput: ResearchQuestionInput = DEFAULT_QUESTION,
): Promise<ExperimentRecord> {
  const validated = SPEC_SCHEMA.parse(spec);
  const body = {
    schema: "waveform-experiment.v2" as const,
    classification: "simulation-only" as const,
    protocol: PROTOCOL,
    model: modelMetadata(),
    question: buildResearchQuestion(questionInput, validated),
    sourceCommit,
    createdAt: new Date().toISOString(),
    spec: validated,
    results: runExperiment(validated, questionInput),
  };
  return recordSchema.parse({
    ...body,
    digest: await sha256Text(canonicalJson(body)),
  });
}

/**
 * Text that may be reworded between builds without changing any result. It is
 * not compared, so it is never trusted either: replay displays the text this
 * build generates (ReplayOutcome.display), not the text in the file.
 */
const PROSE_KEYS = new Set(["explanation", "statement", "label", "question"]);

/** Numbers agree to 1e-10 absolute (rounding across runtimes); all else exactly. */
function agrees(a: unknown, b: unknown, key = ""): boolean {
  if (PROSE_KEYS.has(key) && typeof a === "string" && typeof b === "string") return true;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= 1e-10 + 1e-9 * Math.abs(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => agrees(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.length === kb.length &&
      ka.every(
        (k, i) =>
          k === kb[i] &&
          agrees(
            (a as Record<string, unknown>)[k],
            (b as Record<string, unknown>)[k],
            k,
          ),
      )
    );
  }
  return a === b;
}

export interface ReplayOutcome {
  /** The record exactly as imported; its digest still verifies, so it is what gets re-saved. */
  record: AnyExperimentRecord;
  /**
   * What to show. For v2 its results are the freshly recomputed ones, so every
   * label, explanation and statement on screen comes from this build, never
   * from the file.
   */
  display: AnyExperimentRecord;
  /** Disclosures that do not invalidate the replay but must be shown. */
  notices: string[];
}

async function replayV1(data: LegacyExperimentRecord): Promise<ReplayOutcome> {
  const { digest, ...body } = data;
  if (canonicalJson(body.protocol) !== canonicalJson(PROTOCOL_V1))
    throw new Error("Unsupported experiment protocol.");
  if ((await sha256Text(canonicalJson(body))) !== digest)
    throw new Error("Integrity check failed: the record was changed.");
  const replay = runExperimentV1(body.spec);
  if (
    JSON.stringify(replay.checks) !== JSON.stringify(body.results.checks) ||
    replay.points.length !== body.results.points.length
  ) {
    throw new Error("Replay failed: recorded checks or sample count differ.");
  }
  const keys = Object.keys(
    replay.points[0],
  ) as (keyof (typeof replay.points)[number])[];
  const ok = replay.points.every((point, i) =>
    keys.every(
      (key) => Math.abs(point[key] - body.results.points[i][key]) <= 1e-10,
    ),
  );
  if (!ok)
    throw new Error("Replay failed: recorded results differ from this engine.");
  return {
    record: data,
    display: data,
    notices: [
      "Legacy v1 record, replayed under its own protocol (two-site-coupling-sweep.v1). It carries no convergence ladder, limiting-case checks, unit declaration or research question. Run it again to obtain those under v2.",
    ],
  };
}

async function replayV2(data: ExperimentRecord): Promise<ReplayOutcome> {
  const { digest, ...body } = data;
  if (canonicalJson(body.protocol) !== canonicalJson(PROTOCOL))
    throw new Error("Unsupported experiment protocol.");
  if ((await sha256Text(canonicalJson(body))) !== digest)
    throw new Error("Integrity check failed: the record was changed.");
  const input = {
    question: body.question.question,
    hypothesis: body.question.hypothesis,
    declaredResolution: body.question.declaredResolution,
  };
  const card = buildResearchQuestion(input, body.spec);
  if (canonicalJson(card) !== canonicalJson(body.question))
    throw new Error("Replay failed: the research question card differs from the protocol.");
  const replay = runExperiment(body.spec, input);
  if (
    JSON.stringify(replay.checks) !== JSON.stringify(body.results.checks) ||
    replay.points.length !== body.results.points.length
  ) {
    throw new Error("Replay failed: recorded checks or sample count differ.");
  }
  if (!agrees(replay, body.results))
    throw new Error("Replay failed: recorded results differ from this engine.");
  const notices: string[] = [];
  if (canonicalJson(replay) !== canonicalJson(body.results)) {
    notices.push(
      "The record’s explanatory text differs from this build’s. Numbers and statuses agree; the text shown is generated by this build, not taken from the file.",
    );
  }
  if (canonicalJson(body.model) !== canonicalJson(modelMetadata())) {
    notices.push(
      "The record’s model description differs from this build’s. Computational results agree; review the recorded assumptions.",
    );
  }
  return { record: data, display: { ...data, results: replay }, notices };
}

/**
 * Integrity and computational replay are separate from authenticity or empirical
 * validity. A record whose checks failed replays successfully and stays failed:
 * reproducibility is not validity.
 */
export async function inspectReplay(text: string): Promise<ReplayOutcome> {
  if (new TextEncoder().encode(text).length > MAX_RECORD_BYTES)
    throw new Error("Record exceeds the 256 KB limit.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Unsupported or invalid experiment record.");
  }
  const schema = (json as { schema?: unknown } | null)?.schema;
  if (schema === "waveform-experiment.v1") {
    const parsed = recordSchemaV1.safeParse(json);
    if (!parsed.success) throw new Error("Unsupported or invalid experiment record.");
    return replayV1(parsed.data);
  }
  const parsed = recordSchema.safeParse(json);
  if (!parsed.success) throw new Error("Unsupported or invalid experiment record.");
  return replayV2(parsed.data);
}

export async function replayExperiment(
  text: string,
): Promise<AnyExperimentRecord> {
  return (await inspectReplay(text)).record;
}

const CSV_COLUMNS_V1 = [
  "coupling",
  "maxSeparation",
  "meanSeparation",
  "peakTime",
  "normError",
  "timestepError",
] as const;

export function experimentCsv(record: AnyExperimentRecord): string {
  if (record.schema === "waveform-experiment.v1") {
    return (
      [
        CSV_COLUMNS_V1.join(","),
        ...record.results.points.map((p) =>
          CSV_COLUMNS_V1.map((k) => p[k]).join(","),
        ),
      ].join("\n") + "\n"
    );
  }
  const ladderColumns = CONVERGENCE_METRICS.flatMap(({ id }) => [
    `${id}_dt_vs_dt2`,
    `${id}_dt2_vs_dt4`,
  ]);
  return (
    [
      [...CSV_COLUMNS_V1, "quarterStepError", ...ladderColumns].join(","),
      ...record.results.points.map((p) =>
        [
          ...CSV_COLUMNS_V1.map((k) => p[k]),
          p.quarterStepError,
          ...CONVERGENCE_METRICS.flatMap(({ id }) => p.ladder[id]),
        ].join(","),
      ),
    ].join("\n") + "\n"
  );
}
