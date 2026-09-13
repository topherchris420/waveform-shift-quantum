import { z } from "zod";
import { clamp, sum } from "./accounting";
import { runPolicySimulation } from "./engine";
import { CollateralEngine } from "./collateral";
import type { PolicySimulationResult, Scenario, Shock } from "./types";
const boundedText = z.string().min(1).max(2000),
  identifier = z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9_.:/-]+$/),
  fraction = z.number().finite().min(0).max(1);
export const SIGNAL_METRICS = [
  "funding_pressure",
  "liquidity_shortfall",
  "collateral_value",
  "securities_value",
  "payment_delay",
  "peer_divergence",
] as const;
export const SystemicSignalSchema = z
  .strictObject({
    schema: z.literal("systemic-signal.v1"),
    id: identifier,
    institution: z.strictObject({ id: identifier, name: boundedText }),
    date: z.iso.date(),
    affectedMetrics: z
      .array(
        z.strictObject({
          metric: z.enum(SIGNAL_METRICS),
          direction: z.enum(["increase", "decrease", "unchanged"]),
          magnitude: z.number().finite().min(0).max(1e9),
          units: z.enum([
            "fraction",
            "percent",
            "USD million",
            "hours",
            "z-score",
          ]),
          baseline: z.number().finite().positive().max(1e9).nullable(),
        }),
      )
      .min(1)
      .max(6),
    peerContext: z.strictObject({
      group: boundedText,
      sampleSize: z.number().int().min(0).max(100000),
      percentile: fraction.nullable(),
    }),
    direction: z.enum(["deteriorating", "improving", "mixed", "unclear"]),
    magnitude: z.number().finite().min(0).max(1e9),
    persistenceDays: z.number().finite().min(0).max(10000),
    confidence: fraction,
    robustness: fraction,
    topologyChanges: z
      .array(
        z.strictObject({
          from: identifier,
          to: identifier,
          change: z.enum(["added", "removed", "strengthened", "weakened"]),
          evidenceId: identifier,
        }),
      )
      .max(100),
    leadLagRelationships: z
      .array(
        z.strictObject({
          leading: identifier,
          lagging: identifier,
          lagDays: z.number().finite().min(-10000).max(10000),
          association: z.number().finite().min(-1).max(1),
          evidenceId: identifier,
        }),
      )
      .max(100),
    provenance: z
      .array(
        z.strictObject({
          source: boundedText,
          sourceDate: z.iso.date(),
          method: boundedText,
        }),
      )
      .min(1)
      .max(100),
    evidenceIds: z.array(identifier).min(1).max(1000),
  })
  .superRefine((s, ctx) => {
    if (
      new Set(s.affectedMetrics.map((m) => m.metric)).size !==
      s.affectedMetrics.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate observed metric" });
    if (new Set(s.evidenceIds).size !== s.evidenceIds.length)
      ctx.addIssue({ code: "custom", message: "Duplicate signal evidence ID" });
    for (const edge of [...s.topologyChanges, ...s.leadLagRelationships])
      if (!s.evidenceIds.includes(edge.evidenceId))
        ctx.addIssue({
          code: "custom",
          message: "Unlinked topology/lead-lag evidence",
        });
  });
export type SystemicSignal = z.infer<typeof SystemicSignalSchema>;
export const HYPOTHESIS_NAMES = [
  "funding-run",
  "collateral-pressure",
  "market-loss",
  "settlement-pressure",
  "common-factor",
  "insufficient-evidence",
] as const;
export interface MechanismHypothesis {
  id: (typeof HYPOTHESIS_NAMES)[number];
  assumptions: string[];
  variablesAffected: string[];
  initialShock: Shock[];
  propagationRules: string[];
  predictedObservables: string[];
  falsificationConditions: string[];
  scenario: Scenario;
}
export interface SignalTranslationAssumptions {
  fractionalShock: number;
  outageHours: number;
  fitTolerance: number;
  minimumConfidence: number;
}
export const DEFAULT_SIGNAL_ASSUMPTIONS: SignalTranslationAssumptions = {
  fractionalShock: 0.2,
  outageHours: 8,
  fitTolerance: 0.15,
  minimumConfidence: 0.5,
};
/** Observation-to-synthetic-actor mapping must be explicit. No institution is silently substituted. */
export function initializeScenarioFromSystemicSignal(
  input: unknown,
  base: Scenario,
  targetActorId: string,
  assumptions = DEFAULT_SIGNAL_ASSUMPTIONS,
): {
  signal: SystemicSignal;
  hypotheses: MechanismHypothesis[];
  mapping: { observedInstitution: string; simulatedActor: string };
  assumptions: SignalTranslationAssumptions;
} {
  const signal = SystemicSignalSchema.parse(input);
  if (!base.actors.some((a) => a.id === targetActorId))
    throw new Error(
      "Select a known synthetic actor for the observed institution",
    );
  if (
    !Number.isFinite(assumptions.fractionalShock) ||
    assumptions.fractionalShock < 0 ||
    assumptions.fractionalShock > 1 ||
    !Number.isFinite(assumptions.outageHours) ||
    assumptions.outageHours < 0 ||
    assumptions.outageHours > base.horizonHours ||
    assumptions.fitTolerance <= 0 ||
    !Number.isFinite(assumptions.fitTolerance) ||
    assumptions.fitTolerance > 1 ||
    assumptions.minimumConfidence < 0 ||
    !Number.isFinite(assumptions.minimumConfidence) ||
    assumptions.minimumConfidence > 1
  )
    throw new Error("Invalid hypothesis assumptions");
  const target = base.actors.find((a) => a.id === targetActorId)!;
  const baseEvidenceIds = new Set(base.evidence.map((row) => row.id));
  const collisions = signal.evidenceIds.filter((id) => baseEvidenceIds.has(id));
  if (collisions.length)
    throw new Error(
      `Signal evidence IDs must not impersonate scenario parameters: ${collisions.join(", ")}`,
    );
  const referenceClass =
    target.collateral.find((c) => c.account === "securities")?.assetClass ??
    base.markets[0]?.assetClass;
  if (!referenceClass)
    throw new Error("Hypothesis needs an explicit reference asset market");
  const hypotheses = HYPOTHESIS_NAMES.map((id) => {
    const scenario = structuredClone(base);
    scenario.shocks = [];
    const source = signal.provenance
      .map((row) => `${row.source} (${row.method})`)
      .join("; ")
      .slice(0, 2000);
    scenario.evidence.push(
      ...signal.evidenceIds.map((evidenceId) => ({
        id: evidenceId,
        value: signal.magnitude,
        units: "source-defined signal index",
        lower: 0,
        upper: Math.max(1, signal.magnitude),
        source,
        sourceDate: signal.date,
        calibrationType: "EXPERIMENTAL" as const,
        confidence: signal.confidence,
        notes:
          "External DRR evidence link preserved for hypothesis construction; not independently verified by this simulator.",
      })),
    );
    scenario.provenance.sources = [
      ...new Set([
        ...scenario.provenance.sources,
        ...signal.provenance.map((row) => row.source),
      ]),
    ].slice(0, 100);
    const add = (
      kind: Shock["kind"],
      target: string,
      magnitude: number,
      durationHours = 0,
    ) =>
      scenario.shocks.push({
        id: `${id}-${scenario.shocks.length}`,
        kind,
        target,
        magnitude,
        hour: scenario.stepHours,
        durationHours,
        evidenceIds: signal.evidenceIds,
      });
    if (id === "funding-run" || id === "common-factor")
      add(
        "withdrawal",
        id === "common-factor" ? "all" : targetActorId,
        assumptions.fractionalShock,
      );
    if (id === "collateral-pressure" || id === "common-factor")
      add(
        "haircut",
        id === "common-factor" ? "all" : targetActorId,
        assumptions.fractionalShock,
      );
    if (id === "market-loss" || id === "common-factor")
      add("price", referenceClass, assumptions.fractionalShock);
    if (id === "settlement-pressure")
      add("outage", targetActorId, 0, assumptions.outageHours);
    // No-shock control can still exhibit endogenous stress from its opening obligations.
    scenario.id = `signal-${id}`;
    scenario.provenance.assumptions.push(
      `Observed institution ${signal.institution.id} explicitly mapped by researcher to synthetic actor ${targetActorId}.`,
      `Signal ${signal.id} motivates a competing mechanism; shock size ${assumptions.fractionalShock} is a researcher assumption, not inferred from the alert magnitude.`,
    );
    return {
      id,
      scenario,
      assumptions: [
        ...scenario.provenance.assumptions,
        `Evidence ${signal.evidenceIds.join(", ")}; signal confidence ${signal.confidence}, robustness ${signal.robustness}.`,
      ],
      variablesAffected: scenario.shocks.map((s) => `${s.kind}:${s.target}`),
      initialShock: scenario.shocks,
      propagationRules: [
        "Explicit contractual exposures",
        "Matched payment claims",
        "Collateral-constrained borrowing",
        "Recorded fire sales and margin",
      ],
      predictedObservables: signal.affectedMetrics.map((m) => m.metric),
      falsificationConditions: [
        `Normalized selected-feature RMSE exceeds ${assumptions.fitTolerance}.`,
        "Observed direction is inconsistent with modeled direction.",
        "Insufficient comparable observables prevents discrimination.",
      ],
    };
  });
  return {
    signal,
    hypotheses,
    mapping: {
      observedInstitution: signal.institution.id,
      simulatedActor: targetActorId,
    },
    assumptions,
  };
}
function observables(
  result: PolicySimulationResult,
  targetId: string,
): Partial<Record<(typeof SIGNAL_METRICS)[number], number>> {
  const initial = result.timeline[0].actors.find((a) => a.id === targetId)!,
    final = result.finalState.actors.find((a) => a.id === targetId)!;
  const funding = sum(Object.values(initial.balanceSheet.liabilities)),
    securities = initial.balanceSheet.assets.securities,
    collateral = CollateralEngine.inspect(initial).available;
  const withdrawals = sum(
    result.events
      .filter(
        (e) => e.actorId === targetId && e.mechanism === "funding-withdrawal",
      )
      .map((e) => e.amount),
  );
  const out: Partial<Record<(typeof SIGNAL_METRICS)[number], number>> = {
    funding_pressure: funding ? withdrawals / funding : 0,
    liquidity_shortfall:
      Math.max(
        ...result.timeline.map(
          (row) => row.liquidityPositions[targetId]?.shortfall ?? 0,
        ),
      ) / Math.max(1, funding),
    collateral_value: collateral
      ? (CollateralEngine.inspect(final).available - collateral) / collateral
      : 0,
    securities_value: securities
      ? (final.balanceSheet.assets.securities - securities) / securities
      : 0,
  };
  const completed = result.finalState.payments.filter(
    (p) => p.from === targetId && p.settledHour !== null,
  );
  if (completed.length)
    out.payment_delay =
      sum(completed.map((p) => (p.settledHour! - p.dueHour) * p.amount)) /
      sum(completed.map((p) => p.amount));
  return out;
}
export interface HypothesisComparison {
  signalId: string;
  signal: SystemicSignal;
  mapping: { observedInstitution: string; simulatedActor: string };
  assumptions: SignalTranslationAssumptions;
  hypotheses: MechanismHypothesis[];
  evidenceBoundary: string;
  ranking: {
    hypothesis: MechanismHypothesis["id"];
    status:
      "consistent" | "inconsistent" | "weakly supported" | "not discriminated";
    rmse: number | null;
    comparedFeatures: number;
    missingFeatures: string[];
    predicted: Partial<Record<(typeof SIGNAL_METRICS)[number], number>>;
    result: PolicySimulationResult;
  }[];
  summary: string;
}
export function compareHypotheses(
  prepared: ReturnType<typeof initializeScenarioFromSystemicSignal>,
): HypothesisComparison {
  const ranking = prepared.hypotheses
    .map((h) => {
      const result = runPolicySimulation(h.scenario),
        predicted = observables(result, prepared.mapping.simulatedActor),
        errors: number[] = [],
        missingFeatures: string[] = [];
      for (const m of prepared.signal.affectedMetrics) {
        const observed =
          m.magnitude *
          (m.direction === "decrease"
            ? -1
            : m.direction === "unchanged"
              ? 0
              : 1);
        const normalized: number | null =
          m.units === "percent"
            ? observed / 100
            : m.units === "fraction" || m.units === "hours"
              ? observed
              : m.units === "USD million" && m.baseline
                ? observed / m.baseline
                : null;
        const model = predicted[m.metric];
        if (
          model === undefined ||
          normalized === null ||
          (m.metric === "payment_delay" && m.units !== "hours")
        ) {
          missingFeatures.push(m.metric);
          continue;
        }
        errors.push(
          ((model - normalized) /
            (m.metric === "payment_delay"
              ? Math.max(1, prepared.assumptions.outageHours)
              : 1)) **
            2,
        );
      }
      const rmse = errors.length
        ? Math.sqrt(sum(errors) / errors.length)
        : null;
      const enough =
        errors.length >= 2 &&
        prepared.signal.confidence >= prepared.assumptions.minimumConfidence &&
        prepared.signal.robustness >= prepared.assumptions.minimumConfidence;
      const status: HypothesisComparison["ranking"][number]["status"] = !enough
        ? "not discriminated"
        : rmse! > prepared.assumptions.fitTolerance
          ? "inconsistent"
          : missingFeatures.length || result.numericalWarnings.length
            ? "weakly supported"
            : "consistent";
      return {
        hypothesis: h.id,
        status,
        rmse,
        comparedFeatures: errors.length,
        missingFeatures,
        predicted,
        result,
      };
    })
    .sort((a, b) => (a.rmse ?? Infinity) - (b.rmse ?? Infinity));
  // Fits that cannot be separated by the prespecified tolerance are not ranked as causal explanations.
  const plausible = ranking.filter(
    (r) => r.status === "consistent" || r.status === "weakly supported",
  );
  if (
    plausible.length > 1 &&
    Math.abs(plausible[0].rmse! - plausible[1].rmse!) <
      prepared.assumptions.fitTolerance / 4
  )
    for (const row of plausible) row.status = "not discriminated";
  return {
    signalId: prepared.signal.id,
    signal: structuredClone(prepared.signal),
    mapping: structuredClone(prepared.mapping),
    assumptions: structuredClone(prepared.assumptions),
    hypotheses: structuredClone(prepared.hypotheses),
    evidenceBoundary:
      "DRR is an observational diagnostic. These simulations test competing counterfactual mechanisms. Best fit does not identify causation or establish what happened to the observed institution.",
    ranking,
    summary: ranking.every((r) => r.status === "not discriminated")
      ? "Insufficient evidence to discriminate mechanisms."
      : `${ranking.filter((r) => r.status === "inconsistent").length} mechanisms inconsistent with selected features under the declared tolerance. Remaining fits are conditional, not causal findings.`,
  };
}
export const EXAMPLE_SYSTEMIC_SIGNAL: SystemicSignal = {
  schema: "systemic-signal.v1",
  id: "synthetic-drr-001",
  institution: { id: "synthetic-fbo", name: "Synthetic FBO observation" },
  date: "2026-09-12",
  affectedMetrics: [
    {
      metric: "funding_pressure",
      direction: "increase",
      magnitude: 20,
      units: "percent",
      baseline: null,
    },
    {
      metric: "collateral_value",
      direction: "decrease",
      magnitude: 15,
      units: "percent",
      baseline: null,
    },
  ],
  peerContext: { group: "Synthetic peers", sampleSize: 12, percentile: 0.9 },
  direction: "deteriorating",
  magnitude: 2,
  persistenceDays: 14,
  confidence: 0.7,
  robustness: 0.6,
  topologyChanges: [],
  leadLagRelationships: [],
  provenance: [
    {
      source: "Synthetic offline example",
      sourceDate: "2026-09-12",
      method:
        "Illustrative DRR-compatible artifact; no actual institution data.",
    },
  ],
  evidenceIds: ["synthetic-evidence-001"],
};
