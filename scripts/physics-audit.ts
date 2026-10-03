// Waveform physics audit.
//
//   npm run physics:audit                 console report + physics-audit.json
//   npm run physics:audit -- --out path   choose the JSON path
//
// Runs the deterministic verification layer against every research model and
// reports what is established computationally and what is not. It produces no
// overall score: a model either survives each named check or it does not, and
// computational survival says nothing about nature.
//
// Exit status is 1 if any executed check FAILS, so a regression in the physics
// implementation breaks `npm run verify`. Warnings (uncalibrated units,
// identifiability limits, unknown sensitivity) are findings, not failures.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { DEFAULT_SPEC, PROTOCOL, runExperiment } from "../src/experiments/engine";
import { EPISTEMIC_CLASSES, COMPARISON_DERIVATIONS } from "../src/lib/epistemics";
import { observable } from "../src/lib/observables";
import { compareModels } from "../src/lib/physics";
import { DEFAULT_SPLIT_PARAMS, type RealitySplitParams } from "../src/lib/realitySplit";
import { RESEARCH_MODELS, WOODYARD_KERNEL, WOODYARD_TWO_SITE } from "../src/lib/researchModels";
import { KERNEL_UNITS } from "../src/lib/units";
import {
  checkAlphaZeroReduction,
  checkCalibrationClaims,
  checkConstantKernelCancels,
  checkDimensionalConsistency,
  checkFlatFieldNull,
  checkKernelCoefficientConsistency,
  checkKernelDensityNormalization,
  checkKernelGridConvergence,
  checkLinewidthDomain,
  checkUnitLabels,
  checkWeakResponseDomain,
  runTimestepLadder,
  unitSpecificationWarning,
  type VerificationResult,
} from "../src/quantum/validation";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : "physics-audit.json";

let sourceCommit = "unknown";
try {
  sourceCommit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  // Not a git checkout; the report says so.
}

// --- Two-site model: the workbench protocol at its default settings --------
const run = runExperiment(DEFAULT_SPEC);
const twoSite: VerificationResult[] = run.integrity;

// --- Numerical stability scan ---------------------------------------------
// Inside the protocol domain, and deliberately beyond it, at the protocol dt.
interface ScanPoint {
  g: number;
  fieldContrast: number;
  mixing: number;
  driveAmplitude: number;
  insideProtocolDomain: boolean;
  /** Worst error(dt/2, dt/4) over every ladder metric, coherence included. */
  errorHalfQuarter: number;
  worstMetric: string;
  /** Finest-pair P_B error alone, which large detuning can make small even when phases are poorly resolved. */
  populationError: number;
  observedOrder: number | null;
  withinTolerance: boolean;
}
function scanPoint(g: number, fieldContrast: number, mixing: number, driveAmplitude: number, inside: boolean): ScanPoint {
  const params: RealitySplitParams = {
    ...DEFAULT_SPLIT_PARAMS,
    EA: PROTOCOL.bareEnergyA,
    EB: PROTOCOL.bareEnergyB,
    driveOmega: PROTOCOL.driveOmega,
    phiA: -fieldContrast / 2,
    phiB: fieldContrast / 2,
    delta: mixing,
    driveAmplitude,
    g,
  };
  const ladder = runTimestepLadder(params, PROTOCOL.duration, PROTOCOL.dt);
  const [worstMetric, [e1, e2]] = Object.entries(ladder.errors).reduce((a, b) => (b[1][1] > a[1][1] ? b : a));
  return {
    g,
    fieldContrast,
    mixing,
    driveAmplitude,
    insideProtocolDomain: inside,
    errorHalfQuarter: e2,
    worstMetric,
    populationError: ladder.errors.PB[1],
    observedOrder: e2 > PROTOCOL.roundoffFloor && e1 > e2 ? Math.log2(e1 / e2) : null,
    withinTolerance: e2 <= PROTOCOL.convergenceTolerance,
  };
}
const scan: ScanPoint[] = [];
for (const g of [0.5, 2])
  for (const c of [0.5, 2])
    for (const m of [0.05, 0.25, 1])
      for (const a of [0.25, 1]) scan.push(scanPoint(g, c, m, a, true));
for (const g of [5, 20, 80]) scan.push(scanPoint(g, 2, 1, 1, false));
for (const m of [3, 10]) scan.push(scanPoint(2, 2, m, 1, false));

// --- Localization kernel ---------------------------------------------------
const kernelParams = DEFAULT_SPLIT_PARAMS;
const kernel: VerificationResult[] = [
  checkDimensionalConsistency(KERNEL_UNITS),
  checkUnitLabels(KERNEL_UNITS),
  checkCalibrationClaims(KERNEL_UNITS),
  checkAlphaZeroReduction(kernelParams),
  checkFlatFieldNull(kernelParams),
  checkConstantKernelCancels(),
  checkKernelDensityNormalization(kernelParams),
  checkKernelGridConvergence(kernelParams),
  checkWeakResponseDomain(kernelParams.alpha),
  checkLinewidthDomain(kernelParams.gamma),
  checkKernelCoefficientConsistency(),
  unitSpecificationWarning(KERNEL_UNITS),
];

// --- Every declared invariant and limit must be backed by an executed check -
function claimCoverage(model: typeof WOODYARD_TWO_SITE, results: VerificationResult[]) {
  return [...model.invariants, ...model.limitingCases].map((claim) => {
    const r = results.find((x) => x.id === claim.checkId);
    return {
      statement: claim.statement,
      checkId: claim.checkId,
      status: r ? r.status : "missing",
    };
  });
}
const coverage = {
  [WOODYARD_TWO_SITE.id]: claimCoverage(WOODYARD_TWO_SITE, twoSite),
  [WOODYARD_KERNEL.id]: claimCoverage(WOODYARD_KERNEL, kernel),
};

// --- compareModels classification -----------------------------------------
const comparisonParams = { g: 0.8, phiA: -0.6, phiB: 0.6, delta: 0.25, alpha: 1.2, gamma: 1.5, omega_w: 12 };
const comparisons = ["two_site", "scalar_kernel", "teleportation", "interference"].map((type) => {
  const c = compareModels(type, comparisonParams);
  return {
    experimentType: type,
    derivation: c.derivation,
    isModelPrediction: COMPARISON_DERIVATIONS[c.derivation].isModelPrediction,
    scientificStatus: c.scientificStatus,
    observable: c.observableName,
    note: c.derivationNote,
  };
});

// --- Report ----------------------------------------------------------------
const executedFailures = [...twoSite, ...kernel].filter((r) => r.source === "executed" && r.status === "fail");
const missingCoverage = Object.values(coverage)
  .flat()
  .filter((c) => c.status === "missing");
const unexercisedCoverage = Object.values(coverage)
  .flat()
  .filter((c) => c.status === "not_applicable");

const report = {
  schema: "waveform-physics-audit.v1",
  generatedAt: new Date().toISOString(),
  sourceCommit,
  protocol: PROTOCOL.id,
  scientificConclusion: "none",
  scope:
    "Computational and internal-consistency properties only. No result here bears on whether nature exhibits any proposed effect.",
  models: RESEARCH_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    epistemicClass: m.epistemicClass,
    encodedAssumptions: m.assumptions,
    proseOnlyAssumptions: m.proseOnlyAssumptions,
    underspecifiedUnits: m.units.underspecified,
    observables: m.observables.map((id) => {
      const o = observable(id);
      return {
        id,
        kind: o.kind,
        predictionDefined: o.predictionDefined,
        requiredSensitivity: o.requiredSensitivity,
        calibration: o.calibration,
      };
    }),
    falsification: m.falsificationConditions,
  })),
  twoSite: {
    model: WOODYARD_TWO_SITE.id,
    spec: DEFAULT_SPEC,
    researchStatus: run.assessment.status,
    gates: run.assessment.gates.map((g) => ({ id: g.id, outcome: g.outcome })),
    checks: twoSite,
    convergence: run.convergence,
    stabilityScan: scan,
  },
  kernel: { model: WOODYARD_KERNEL.id, params: kernelParams, checks: kernel },
  claimCoverage: coverage,
  compareModels: comparisons,
  summary: {
    executedFailures: executedFailures.map((r) => r.id),
    claimsWithoutExecutedCheck: missingCoverage.map((c) => c.checkId),
    claimsNotExercisedAtAuditedPoint: unexercisedCoverage.map((c) => c.checkId),
  },
};

const LINE = "=".repeat(22);
const tag = (s: string) =>
  ({ pass: "PASS", fail: "FAIL", warning: "WARNING", not_applicable: "N/A" })[s] ?? s.toUpperCase();
const out: string[] = ["WAVEFORM PHYSICS AUDIT", LINE, "", `Source commit: ${sourceCommit}`, `Protocol: ${PROTOCOL.id}`, ""];
function section(title: string, body: string[]) {
  out.push(`${title}:`, ...body.map((b) => `  ${b}`), "");
}
function checks(results: VerificationResult[]) {
  for (const r of results) {
    const m = r.measured !== undefined ? ` (measured ${r.measured.toExponential(2)}${r.tolerance !== undefined ? `, tolerance ${r.tolerance.toExponential(1)}` : ""})` : "";
    out.push(`${r.label}:`, `  ${tag(r.status)}${r.source === "metadata" ? " [declared]" : ""}${m}`, `  ${r.explanation}`, "");
  }
}

section("Model", [WOODYARD_TWO_SITE.id]);
section("Epistemic class", [EPISTEMIC_CLASSES[WOODYARD_TWO_SITE.epistemicClass].label]);
checks(twoSite);
section(
  "Convergence ladder (dt → dt/2 → dt/4, worst sample per metric)",
  run.convergence.map(
    (m) =>
      `${m.metric.padEnd(15)} ${m.coarseVsHalf.toExponential(2)} → ${m.halfVsQuarter.toExponential(2)}  ${m.observedOrder === null ? "order —   " : `order ${m.observedOrder.toFixed(2)}`}  ${m.regime}`
  )
);
section(
  "Numerical stability scan (worst metric, error(dt/2, dt/4) at dt = 0.02)",
  [
    `Inside protocol domain: ${scan.filter((s) => s.insideProtocolDomain).length} points, worst ${Math.max(...scan.filter((s) => s.insideProtocolDomain).map((s) => s.errorHalfQuarter)).toExponential(2)}, all within ${PROTOCOL.convergenceTolerance}: ${scan.filter((s) => s.insideProtocolDomain).every((s) => s.withinTolerance) ? "YES" : "NO"}`,
    ...scan
      .filter((s) => !s.insideProtocolDomain)
      .map(
        (s) =>
          `Outside domain g=${s.g}, Δ=${s.mixing}: ${s.worstMetric} ${s.errorHalfQuarter.toExponential(2)}${s.observedOrder !== null ? ` (order ${s.observedOrder.toFixed(2)})` : ""}, P_B ${s.populationError.toExponential(2)} — ${s.withinTolerance ? "within tolerance" : "EXCEEDS tolerance"}`
      ),
  ]
);
section("Observables", WOODYARD_TWO_SITE.observables.map((id) => {
  const o = observable(id);
  return `${o.name}: ${o.kind.replace(/_/g, " ")}; prediction for a real apparatus ${o.predictionDefined ? "defined" : "NOT DEFINED"}; required sensitivity ${o.requiredSensitivity}`;
}));
section("Empirical calibration", ["NOT ESTABLISHED"]);
for (const f of WOODYARD_TWO_SITE.falsificationConditions) {
  section(`Falsification (${f.level.replace("_", " ")})`, [
    `DEFINED; ${f.operational ? "OPERATIONAL" : "NOT OPERATIONAL"}`,
    ...f.missing.map((m) => `missing: ${m}`),
  ]);
}

out.push("", `Model: ${WOODYARD_KERNEL.id}`, `Epistemic class: ${EPISTEMIC_CLASSES[WOODYARD_KERNEL.epistemicClass].label}`, "");
checks(kernel);

section(
  "compareModels() classification",
  comparisons.map((c) => `${c.experimentType.padEnd(14)} ${COMPARISON_DERIVATIONS[c.derivation].label}${c.isModelPrediction ? "" : " — not a model prediction"}`)
);
section("Claim coverage (declared invariants and limits backed by executed checks)", [
  missingCoverage.length === 0 ? "All declared claims map to an executed check." : `MISSING: ${missingCoverage.map((c) => c.checkId).join(", ")}`,
  unexercisedCoverage.length === 0
    ? "Every claim was exercised at the audited point."
    : `NOT EXERCISED at the audited point (N/A): ${unexercisedCoverage.map((c) => c.checkId).join(", ")}`,
]);
section("Executed failures", [executedFailures.length ? executedFailures.map((r) => r.id).join(", ") : "none"]);
section("Scientific conclusion", ["NONE"]);
out.push(
  "This report establishes computational and internal-consistency",
  "properties only. A reproducible simulation can establish what the",
  "code predicts. It cannot establish that nature behaves that way.",
  ""
);

console.log(out.join("\n"));
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(`Machine-readable report: ${outPath}`);
process.exitCode = executedFailures.length || missingCoverage.length ? 1 : 0;
