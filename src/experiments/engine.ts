import { z } from "zod";
import { DEFAULT_SPLIT_PARAMS, simulateRealitySplit } from "@/lib/realitySplit";
import { canonicalJson, sha256Text } from "@/lib/passport/canonical";

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
export const PROTOCOL = {
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
export const PRESETS = [
  {
    name: "Driven field",
    description: "Sweep coupling while the field oscillates.",
    spec: DEFAULT_SPEC,
  },
  {
    name: "Static field",
    description: "Isolate the effect of static field contrast.",
    spec: { ...DEFAULT_SPEC, driveAmplitude: 0 },
  },
  {
    name: "Null control",
    description:
      "A spatially uniform, static field should not change populations.",
    spec: { ...DEFAULT_SPEC, fieldContrast: 0, driveAmplitude: 0 },
  },
];

const pointSchema = z.strictObject({
  coupling: z.number().finite(),
  maxSeparation: z.number().finite(),
  meanSeparation: z.number().finite(),
  peakTime: z.number().finite(),
  normError: z.number().finite(),
  timestepError: z.number().finite(),
});
const resultsSchema = z.strictObject({
  points: z.array(pointSchema).min(2).max(41),
  checks: z.strictObject({
    zeroCoupling: z.boolean(),
    normalization: z.boolean(),
    timestepConvergence: z.boolean(),
  }),
});
export type ExperimentResults = z.infer<typeof resultsSchema>;

export function runExperiment(input: ExperimentSpec): ExperimentResults {
  const spec = SPEC_SCHEMA.parse(input);
  const points = Array.from({ length: spec.samples }, (_, index) => {
    const coupling = (spec.maxCoupling * index) / (spec.samples - 1);
    const params = {
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
    const coarse = simulateRealitySplit(params, {
      duration: PROTOCOL.duration,
      dt: PROTOCOL.dt,
    });
    const fine = simulateRealitySplit(params, {
      duration: PROTOCOL.duration,
      dt: PROTOCOL.dt / 2,
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
  return resultsSchema.parse({
    points,
    checks: {
      zeroCoupling: points[0].maxSeparation <= PROTOCOL.controlTolerance,
      normalization: points.every(
        (p) => p.normError <= PROTOCOL.normalizationTolerance,
      ),
      timestepConvergence: points.every(
        (p) => p.timestepError <= PROTOCOL.convergenceTolerance,
      ),
    },
  });
}

const recordSchema = z.strictObject({
  schema: z.literal("waveform-experiment.v1"),
  classification: z.literal("simulation-only"),
  protocol: z.unknown(),
  sourceCommit: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  spec: SPEC_SCHEMA,
  results: resultsSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ExperimentRecord = z.infer<typeof recordSchema>;
export const MAX_RECORD_BYTES = 100_000;

export async function createExperimentRecord(
  spec: ExperimentSpec,
  sourceCommit: string,
): Promise<ExperimentRecord> {
  const validated = SPEC_SCHEMA.parse(spec);
  const body = {
    schema: "waveform-experiment.v1" as const,
    classification: "simulation-only" as const,
    protocol: PROTOCOL,
    sourceCommit,
    createdAt: new Date().toISOString(),
    spec: validated,
    results: runExperiment(validated),
  };
  return recordSchema.parse({
    ...body,
    digest: await sha256Text(canonicalJson(body)),
  });
}

/** Integrity and computational replay are separate from authenticity or empirical validity. */
export async function replayExperiment(
  text: string,
): Promise<ExperimentRecord> {
  if (new TextEncoder().encode(text).length > MAX_RECORD_BYTES)
    throw new Error("Record exceeds the 100 KB limit.");
  const parsed = recordSchema.safeParse(JSON.parse(text));
  if (!parsed.success)
    throw new Error("Unsupported or invalid experiment record.");
  const { digest, ...body } = parsed.data;
  if (canonicalJson(body.protocol) !== canonicalJson(PROTOCOL))
    throw new Error("Unsupported experiment protocol.");
  if ((await sha256Text(canonicalJson(body))) !== digest)
    throw new Error("Integrity check failed: the record was changed.");
  const replay = runExperiment(body.spec);
  if (
    JSON.stringify(replay.checks) !== JSON.stringify(body.results.checks) ||
    replay.points.length !== body.results.points.length
  ) {
    throw new Error("Replay failed: recorded checks or sample count differ.");
  }
  const keys = Object.keys(
    replay.points[0],
  ) as (keyof (typeof replay.points)[number])[];
  const agrees = replay.points.every((point, i) =>
    keys.every(
      (key) => Math.abs(point[key] - body.results.points[i][key]) <= 1e-10,
    ),
  );
  if (!agrees)
    throw new Error("Replay failed: recorded results differ from this engine.");
  return parsed.data;
}

export function experimentCsv(record: ExperimentRecord): string {
  const columns = [
    "coupling",
    "maxSeparation",
    "meanSeparation",
    "peakTime",
    "normError",
    "timestepError",
  ] as const;
  return (
    [
      columns.join(","),
      ...record.results.points.map((p) => columns.map((k) => p[k]).join(",")),
    ].join("\n") + "\n"
  );
}
