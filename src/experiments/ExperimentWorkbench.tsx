import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Download,
  FlaskConical,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESEARCH_GATES, RESEARCH_STATUSES } from "@/lib/epistemics";
import { TWO_SITE_UNITS, unitFor } from "@/lib/units";
import { CONVERGENCE_METRICS } from "@/quantum/validation/convergence";
import type { VerificationResult } from "@/quantum/validation/results";
import {
  DEFAULT_QUESTION,
  DEFAULT_SPEC,
  PRESETS,
  PROTOCOL,
  MAX_RECORD_BYTES,
  QUESTION_INPUT_SCHEMA,
  createExperimentRecord,
  experimentCsv,
  inspectReplay,
  type AnyExperimentRecord,
  type ExperimentRecord,
  type ExperimentSpec,
  type ResearchQuestionInput,
} from "./engine";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const controls = [
  {
    key: "maxCoupling",
    unitKey: "g",
    label: "Maximum coupling g",
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "fieldContrast",
    unitKey: "phiA",
    label: "Static field contrast φB − φA",
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "mixing",
    unitKey: "delta",
    label: "Inter-site mixing Δ",
    min: 0.05,
    max: 1,
    step: 0.05,
  },
  {
    key: "driveAmplitude",
    unitKey: "driveAmplitude",
    label: "Antisymmetric drive amplitude",
    min: 0,
    max: 1,
    step: 0.05,
  },
] as const;

const STATUS_STYLE: Record<VerificationResult["status"], [string, string]> = {
  pass: ["PASS", "text-primary"],
  fail: ["FAIL", "text-destructive"],
  warning: ["WARN", "text-amber-300"],
  not_applicable: ["N/A", "text-muted-foreground"],
};
const GATE_STYLE = {
  pass: "text-primary",
  fail: "text-destructive",
  warning: "text-amber-300",
  not_evaluable: "text-muted-foreground",
} as const;

const fmt = (v: number | undefined) =>
  v === undefined
    ? ""
    : v === 0
      ? "0"
      : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4
        ? v.toExponential(2)
        : v.toFixed(4);

function PhysicsIntegrity({ record }: { record: ExperimentRecord }) {
  const { integrity, assessment } = record.results;
  const status = RESEARCH_STATUSES[assessment.status];
  return (
    <div className="mt-6 border-t pt-5" aria-labelledby="integrity-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3
          id="integrity-heading"
          className="font-mono text-xs uppercase tracking-widest"
        >
          Physics integrity
        </h3>
        <span className="text-xs text-muted-foreground">
          {integrity.filter((c) => c.source === "executed").length} executed ·{" "}
          {integrity.filter((c) => c.source === "metadata").length} declared
        </span>
      </div>
      {assessment.gates.map((gate) => (
        <section key={gate.id} className="mt-4">
          <h4 className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            <span>{RESEARCH_GATES[gate.id as keyof typeof RESEARCH_GATES].question}</span>
            <span className={`font-mono text-xs ${GATE_STYLE[gate.outcome]}`}>
              {gate.outcome === "not_evaluable"
                ? "NOT EVALUABLE BY SIMULATION"
                : gate.outcome.toUpperCase()}
            </span>
          </h4>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {integrity
              .filter((c) => c.gate === gate.id)
              .map((c) => {
                const [label, tone] = STATUS_STYLE[c.status];
                return (
                  <li key={c.id}>
                    <details>
                      <summary className="flex cursor-pointer flex-wrap gap-x-3">
                        <strong className={`w-10 shrink-0 ${tone}`}>{label}</strong>
                        <span className="min-w-0 flex-1 font-sans">
                          {c.label}
                          {c.source === "metadata" && (
                            <span className="ml-2 text-muted-foreground">
                              (declared)
                            </span>
                          )}
                        </span>
                        {c.measured !== undefined && (
                          <span className="text-muted-foreground">
                            {fmt(c.measured)}
                            {c.tolerance !== undefined && ` / ${fmt(c.tolerance)}`}
                          </span>
                        )}
                      </summary>
                      <p className="mb-2 ml-12 mt-1 font-sans leading-relaxed text-muted-foreground">
                        {c.explanation}
                      </p>
                    </details>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <div className="mt-5 rounded border p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Research status
        </p>
        <p className="mt-2 font-mono text-lg">{status.label}</p>
        <p className="mt-2 text-sm text-muted-foreground">{assessment.statement}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {RESEARCH_STATUSES.empirical_result_required.label}:{" "}
          {RESEARCH_STATUSES.empirical_result_required.meaning}
        </p>
      </div>
    </div>
  );
}

function ConvergenceLadder({ record }: { record: ExperimentRecord }) {
  return (
    <details className="mt-5">
      <summary className="cursor-pointer text-sm text-primary">
        Convergence ladder: dt = {PROTOCOL.dt} → {PROTOCOL.dt / 2} →{" "}
        {PROTOCOL.dt / 4}
      </summary>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Each step applies the exact exponential of a frozen Hamiltonian. A
        static H therefore has no discretisation error (rounding only); a
        driven H is frozen at each step’s midpoint, an O(dt²) approximation,
        so errors should fall about 4× per halving. Errors are compared at the
        shared coarse-grid times. Each row reports the sample with the largest
        finest-pair error.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <caption className="sr-only">Timestep convergence ladder</caption>
          <thead>
            <tr>
              {["Metric", "err(dt, dt/2)", "err(dt/2, dt/4)", "Reduction", "Order", "Regime"].map(
                (h) => (
                  <th key={h} scope="col" className="p-2">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {record.results.convergence.map((m) => (
              <tr key={m.metric} className="border-t">
                <td className="p-2">
                  {CONVERGENCE_METRICS.find((c) => c.id === m.metric)?.label}
                </td>
                <td className="p-2">{m.coarseVsHalf.toExponential(2)}</td>
                <td className="p-2">{m.halfVsQuarter.toExponential(2)}</td>
                <td className="p-2">
                  {m.reduction === null ? "—" : `${m.reduction.toFixed(2)}×`}
                </td>
                <td className="p-2">
                  {m.observedOrder === null ? "—" : m.observedOrder.toFixed(2)}
                </td>
                <td className="p-2">{m.regime.replace("_", "-")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function RecordedQuestion({ record }: { record: ExperimentRecord }) {
  const q = record.question;
  const rows: [string, string | string[]][] = [
    ["Question", q.question],
    ["Hypothesis", q.hypothesis],
    ["Baseline", q.baseline],
    ["Nulls", q.nulls],
    ["Independent variables", q.independentVariables],
    ["Observables", q.observables],
    ["Numerical requirements", q.numericalRequirements],
    [
      "Declared resolution",
      q.declaredResolution === null ? "Not declared" : String(q.declaredResolution),
    ],
    ["Rejection criteria", q.rejectionCriteria],
  ];
  return (
    <details className="mt-5">
      <summary className="cursor-pointer text-sm text-primary">
        Research question bound into this record
      </summary>
      <dl className="mt-3 space-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {k}
            </dt>
            <dd className="mt-1">
              {Array.isArray(v) ? (
                <ul className="list-disc space-y-1 pl-5">
                  {v.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        The card is serialised at run start and covered by the digest. That
        binds it to the result; it cannot prove the question was written before
        anyone saw an earlier run.
      </p>
    </details>
  );
}

export default function ExperimentWorkbench() {
  const [spec, setSpec] = useState<ExperimentSpec>({ ...DEFAULT_SPEC });
  const [question, setQuestion] = useState<ResearchQuestionInput>({
    ...DEFAULT_QUESTION,
  });
  const [record, setRecord] = useState<AnyExperimentRecord | null>(null);
  // What "Save record" writes: the run as created, or an import exactly as
  // uploaded (its digest still verifies). The screen shows `record`, whose
  // text for an import is regenerated by this build.
  const [exportable, setExportable] = useState<AnyExperimentRecord | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Choose a preset, state the question, then run your first comparison.",
  );
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const sourceCommit =
    typeof __SOURCE_COMMIT__ === "string" ? __SOURCE_COMMIT__ : "unknown";
  const v2 = record?.schema === "waveform-experiment.v2" ? record : null;
  const stale =
    record !== null &&
    (JSON.stringify(record.spec) !== JSON.stringify(spec) ||
      (v2 !== null &&
        (v2.question.question !== question.question.trim() ||
          v2.question.hypothesis !== question.hypothesis.trim() ||
          v2.question.declaredResolution !== question.declaredResolution)));
  const points = record?.results.points ?? [];
  const max = points.reduce(
    (best, p) => (p.maxSeparation > best.maxSeparation ? p : best),
    points[0],
  );
  const integrity = v2?.results.integrity ?? [];
  const failed = integrity.filter((c) => c.status === "fail").length;
  const executedPassed = integrity.filter(
    (c) => c.status === "pass" && c.source === "executed",
  ).length;
  const legacyChecks = record && !v2 ? Object.values(record.results.checks) : [];

  async function run() {
    setBusy(true);
    setError("");
    setNotices([]);
    setMessage("Running paired trajectories, the timestep ladder and controls…");
    // Let the pending state paint before the bounded synchronous computation.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    try {
      if (!QUESTION_INPUT_SCHEMA.safeParse(question).success) {
        throw new Error(
          "State the question and hypothesis (1–600 characters each). A declared resolution, if given, must lie in (0, 1].",
        );
      }
      const next = await createExperimentRecord(spec, sourceCommit, question);
      setRecord(next);
      setExportable(next);
      setMessage(
        "Run complete. Review physics integrity before interpreting the separation.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Experiment failed.");
      setMessage("Run failed. Any previous result remains unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function importRecord(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("Checking record integrity and replaying the experiment…");
    try {
      if (file.size > MAX_RECORD_BYTES)
        throw new Error("Record exceeds the 256 KB limit.");
      const outcome = await inspectReplay(await file.text());
      const next = outcome.display;
      setSpec({ ...next.spec });
      if (next.schema === "waveform-experiment.v2") {
        setQuestion({
          question: next.question.question,
          hypothesis: next.question.hypothesis,
          declaredResolution: next.question.declaredResolution,
        });
      }
      setRecord(next);
      setExportable(outcome.record);
      setNotices(outcome.notices);
      const version =
        next.sourceCommit === sourceCommit
          ? "Source commit matches."
          : "Source commit differs; results agree with the current engine.";
      setMessage(
        `Replay verified. ${version} A matching digest does not authenticate the author, and a reproduced result is not a valid one: read the integrity checks.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read this record.",
      );
      setMessage("Import rejected. Any previous result remains unchanged.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-16">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary">
        <FlaskConical size={16} /> Waveform / Experiment workbench
      </div>
      <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-6xl">
        Ask a sharper question.
        <br />
        <span className="text-muted-foreground">Keep the result.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        When does a proposed field coupling change a two-site system? Sweep one
        variable, compare against standard quantum mechanics, and replay every
        result locally.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-xs font-mono">
        <span className="rounded border border-primary/40 px-3 py-2 text-primary">
          SIMULATION ONLY
        </span>
        <span className="rounded border px-3 py-2">No account or API key</span>
        <span className="rounded border px-3 py-2">
          Deterministic · SHA-256 record
        </span>
        <span className="rounded border px-3 py-2">
          Simulation units · ħ = 1
        </span>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[340px_1fr]">
        <section
          className="rounded-lg border bg-card p-6"
          aria-labelledby="configure-heading"
        >
          <h2 id="configure-heading" className="font-display text-xl font-bold">
            01 / Set the question
          </h2>
          <fieldset disabled={busy} className="mt-6 space-y-5">
            <legend className="sr-only">Experiment settings</legend>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => {
                    setSpec({ ...p.spec });
                    setQuestion({ ...p.question });
                  }}
                  className="block w-full rounded border p-3 text-left transition-colors hover:border-primary focus-visible:outline-primary"
                >
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p.description}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-3 rounded border p-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Research question
              </p>
              <label className="block text-xs" htmlFor="rq-question">
                Question
                <textarea
                  id="rq-question"
                  className="mt-1 block w-full rounded border bg-background p-2 text-sm"
                  rows={3}
                  maxLength={600}
                  value={question.question}
                  onChange={(e) =>
                    setQuestion((q) => ({ ...q, question: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs" htmlFor="rq-hypothesis">
                Hypothesis
                <textarea
                  id="rq-hypothesis"
                  className="mt-1 block w-full rounded border bg-background p-2 text-sm"
                  rows={3}
                  maxLength={600}
                  value={question.hypothesis}
                  onChange={(e) =>
                    setQuestion((q) => ({ ...q, hypothesis: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs" htmlFor="rq-resolution">
                Declared resolution on |ΔP_B| (optional, before running)
                <input
                  id="rq-resolution"
                  type="number"
                  min={0}
                  max={1}
                  step="any"
                  placeholder="Not declared"
                  className="mt-1 block w-full rounded border bg-background p-2 text-sm"
                  value={question.declaredResolution ?? ""}
                  onChange={(e) =>
                    setQuestion((q) => ({
                      ...q,
                      declaredResolution:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Baseline, nulls, observables and rejection criteria are fixed by
                the protocol and recorded with the run.
              </p>
            </div>
            {controls.map((c) => (
              <div key={c.key}>
                <label
                  htmlFor={c.key}
                  className="flex justify-between gap-2 text-xs"
                >
                  <span>
                    {c.label}
                    <span className="block text-[11px] text-muted-foreground">
                      {unitFor(TWO_SITE_UNITS, c.unitKey)}
                    </span>
                  </span>
                  <output htmlFor={c.key} className="font-mono text-primary">
                    {spec[c.key].toFixed(2)}
                  </output>
                </label>
                <input
                  className="mt-3 w-full accent-cyan-400"
                  id={c.key}
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={spec[c.key]}
                  onChange={(e) =>
                    setSpec((s) => ({ ...s, [c.key]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
            <Button className="w-full" onClick={run}>
              <Play size={14} />
              {busy ? "Working…" : "Run comparison"}
            </Button>
          </fieldset>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {spec.samples} samples from g = 0 to {spec.maxCoupling}. Both
            branches start at site A. Duration {PROTOCOL.duration} ħ/ε₀
            (simulation units, not seconds); Δt = {PROTOCOL.dt}, checked against
            Δt/2 and Δt/4. No random sampling.
          </p>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-primary">Units</summary>
            <p className="mt-2 leading-relaxed">{TWO_SITE_UNITS.system.description}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {TWO_SITE_UNITS.underspecified.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </details>
        </section>

        <section
          className="min-w-0 rounded-lg border bg-card p-6 sm:p-8"
          aria-labelledby="results-heading"
          aria-busy={busy}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="font-display text-xl font-bold">
              02 / Compare the predictions
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              TWO-SITE MODEL · {record?.schema === "waveform-experiment.v1" ? "PROTOCOL V1" : "PROTOCOL V2"}
            </span>
          </div>
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {message}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded border border-destructive p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {notices.map((n) => (
            <p
              key={n}
              className="mt-3 rounded border border-amber-400/50 p-3 text-sm text-amber-300"
            >
              {n}
            </p>
          ))}
          {stale && (
            <p className="mt-3 rounded border border-amber-400/50 p-3 text-sm text-amber-300">
              Settings or question changed. The chart and downloads still
              describe the last completed run. Run again to update them.
            </p>
          )}
          {record ? (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Largest population separation
                  </p>
                  <p className="mt-2 font-mono text-3xl">
                    {max.maxSeparation.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    At sampled coupling
                  </p>
                  <p className="mt-2 font-mono text-3xl">
                    {max.coupling.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {v2 ? "Research status" : "Numerical checks (v1)"}
                  </p>
                  {v2 ? (
                    <p
                      className={`mt-2 font-mono text-base ${failed ? "text-destructive" : "text-primary"}`}
                    >
                      {RESEARCH_STATUSES[v2.results.assessment.status].label}
                      <span className="block text-xs text-muted-foreground">
                        {executedPassed} executed passed · {failed} failed
                      </span>
                    </p>
                  ) : (
                    <p
                      className={`mt-2 font-mono text-2xl ${legacyChecks.every(Boolean) ? "text-primary" : "text-amber-300"}`}
                    >
                      {legacyChecks.filter(Boolean).length} / {legacyChecks.length} passed
                    </p>
                  )}
                </div>
              </div>
              <figure className="mt-8">
                <svg
                  viewBox="0 0 640 270"
                  className="w-full"
                  role="img"
                  aria-label="Maximum and mean population separation versus coupling; values are also available in the results table"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((y) => (
                    <g key={y}>
                      <line
                        x1="48"
                        x2="620"
                        y1={225 - y * 200}
                        y2={225 - y * 200}
                        stroke="currentColor"
                        opacity="0.12"
                      />
                      <text
                        x="6"
                        y={229 - y * 200}
                        fill="currentColor"
                        fontSize="11"
                      >
                        {y.toFixed(2)}
                      </text>
                    </g>
                  ))}
                  <polyline
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3"
                    points={points
                      .map(
                        (p, i) =>
                          `${48 + (i / (points.length - 1)) * 572},${225 - p.maxSeparation * 200}`,
                      )
                      .join(" ")}
                  />
                  <polyline
                    fill="none"
                    stroke="#c4b5fd"
                    strokeDasharray="6 5"
                    strokeWidth="2"
                    points={points
                      .map(
                        (p, i) =>
                          `${48 + (i / (points.length - 1)) * 572},${225 - p.meanSeparation * 200}`,
                      )
                      .join(" ")}
                  />
                  <text x="48" y="248" fill="currentColor" fontSize="11">
                    0
                  </text>
                  <text x="310" y="264" fill="currentColor" fontSize="12">
                    Coupling g
                  </text>
                  <text
                    x="620"
                    y="248"
                    textAnchor="end"
                    fill="currentColor"
                    fontSize="11"
                  >
                    {record.spec.maxCoupling}
                  </text>
                </svg>
                <figcaption className="flex flex-wrap gap-5 text-xs">
                  <span className="text-cyan-400">━ Maximum |ΔPᵦ|</span>
                  <span className="text-violet-300">┄ Mean |ΔPᵦ|</span>
                  <span className="text-muted-foreground">
                    Population separation, 0–1
                  </span>
                </figcaption>
              </figure>
              {v2 ? (
                <>
                  <PhysicsIntegrity record={v2} />
                  <ConvergenceLadder record={v2} />
                  <RecordedQuestion record={v2} />
                </>
              ) : (
                record && (
                  <div className="mt-6 space-y-2 border-t pt-5 text-sm">
                    {(
                      [
                        ["Zero-coupling control", record.results.checks.zeroCoupling],
                        ["Probability conservation", record.results.checks.normalization],
                        ["Half-timestep agreement", record.results.checks.timestepConvergence],
                      ] as const
                    ).map(([label, passed]) => (
                      <div key={label} className="flex flex-wrap justify-between gap-2">
                        <span>{label}</span>
                        <strong className={passed ? "text-primary" : "text-amber-300"}>
                          {passed ? "PASS" : "FAIL"}
                        </strong>
                      </div>
                    ))}
                  </div>
                )
              )}
              <p className="mt-5 text-sm text-muted-foreground">
                Separation is a difference between two model predictions, not a
                measurement or detection significance. The largest sampled
                separation is not necessarily an optimum.
              </p>
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-primary">
                  Inspect all {points.length} samples
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <caption className="sr-only">
                      Completed sweep results
                    </caption>
                    <thead>
                      <tr>
                        {[
                          "g",
                          "Max |ΔPᵦ|",
                          "Mean |ΔPᵦ|",
                          "Norm error",
                          "dt→dt/2",
                          ...(v2 ? ["dt/2→dt/4"] : []),
                        ].map((h) => (
                          <th key={h} scope="col" className="p-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{p.coupling.toFixed(3)}</td>
                          <td className="p-2">{p.maxSeparation.toFixed(6)}</td>
                          <td className="p-2">{p.meanSeparation.toFixed(6)}</td>
                          <td className="p-2">
                            {p.normError.toExponential(2)}
                          </td>
                          <td className="p-2">
                            {p.timestepError.toExponential(2)}
                          </td>
                          {v2 && (
                            <td className="p-2">
                              {v2.results.points[i].quarterStepError.toExponential(2)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded border border-dashed px-6 text-center">
              <FlaskConical className="mb-4 h-10 w-10 text-primary" />
              <h3 className="font-display text-2xl">
                A result starts with a control.
              </h3>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                Try the driven field, then the null control. A useful instrument
                should show you when an effect disappears.
              </p>
            </div>
          )}
        </section>
      </div>
      <section
        className="mt-6 rounded-lg border bg-card p-6 sm:p-8"
        aria-labelledby="record-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <h2 id="record-heading" className="font-display text-xl font-bold">
              03 / Keep it. Replay it.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The JSON record contains the protocol, model assumptions, unit
              declaration, research question, results, convergence ladder,
              every integrity check (failures included), source commit, and an
              integrity digest. Importing recomputes everything and rejects
              mismatches. Version 1 records still replay under their own
              protocol. Files stay in your browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!record || busy}
              onClick={() =>
                exportable &&
                download(
                  `waveform-${exportable.digest.slice(0, 12)}.json`,
                  JSON.stringify(exportable, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={14} />
              Save record
            </Button>
            <Button
              variant="outline"
              disabled={!record || busy}
              onClick={() =>
                record &&
                download(
                  `waveform-${record.digest.slice(0, 12)}.csv`,
                  experimentCsv(record),
                  "text/csv",
                )
              }
            >
              <Download size={14} />
              CSV
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <RotateCcw size={14} />
              Import & replay
            </Button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Import experiment record"
              disabled={busy}
              onChange={(e) => void importRecord(e.target.files?.[0])}
            />
          </div>
        </div>
        {record && (
          <p className="mt-5 break-all border-t pt-4 font-mono text-[11px] text-muted-foreground">
            SHA-256 {record.digest}
            <br />
            Source {record.sourceCommit} · {record.createdAt}
          </p>
        )}
      </section>
      <aside
        className="mt-10 grid gap-4 sm:grid-cols-3"
        aria-label="Continue exploring"
      >
        {[
          ["/", "Physics lab", "Inspect the equations and live trajectories."],
          ["/arfr", "Field routing", "Explore spatial wavefront control."],
          [
            "/systemic-lab",
            "Systemic stress",
            "Explore a separate financial network model.",
          ],
        ].map(([to, title, description]) => (
          <Link
            key={to}
            to={to}
            className="rounded border p-5 hover:border-primary"
          >
            <span className="flex items-center justify-between font-semibold">
              {title}
              <ArrowUpRight size={16} />
            </span>
            <span className="mt-2 block text-sm text-muted-foreground">
              {description}
            </span>
          </Link>
        ))}
      </aside>
    </main>
  );
}
