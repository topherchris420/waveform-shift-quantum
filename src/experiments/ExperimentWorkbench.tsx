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
import {
  DEFAULT_SPEC,
  PRESETS,
  PROTOCOL,
  MAX_RECORD_BYTES,
  createExperimentRecord,
  experimentCsv,
  replayExperiment,
  type ExperimentRecord,
  type ExperimentSpec,
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
    label: "Maximum coupling g",
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "fieldContrast",
    label: "Static field contrast φB − φA",
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "mixing",
    label: "Inter-site mixing Δ",
    min: 0.05,
    max: 1,
    step: 0.05,
  },
  {
    key: "driveAmplitude",
    label: "Antisymmetric drive amplitude",
    min: 0,
    max: 1,
    step: 0.05,
  },
] as const;

export default function ExperimentWorkbench() {
  const [spec, setSpec] = useState<ExperimentSpec>({ ...DEFAULT_SPEC });
  const [record, setRecord] = useState<ExperimentRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Choose a preset, then run your first comparison.",
  );
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const sourceCommit =
    typeof __SOURCE_COMMIT__ === "string" ? __SOURCE_COMMIT__ : "unknown";
  const stale =
    record !== null && JSON.stringify(record.spec) !== JSON.stringify(spec);
  const points = record?.results.points ?? [];
  const max = points.reduce(
    (best, p) => (p.maxSeparation > best.maxSeparation ? p : best),
    points[0],
  );
  const allPassed =
    record && Object.values(record.results.checks).every(Boolean);

  async function run() {
    setBusy(true);
    setError("");
    setMessage("Running paired trajectories and numerical controls…");
    // Let the pending state paint before the bounded synchronous computation.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    try {
      const next = await createExperimentRecord(spec, sourceCommit);
      setRecord(next);
      setMessage(
        "Run complete. Review the controls before interpreting the separation.",
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
        throw new Error("Record exceeds the 100 KB limit.");
      const next = await replayExperiment(await file.text());
      setSpec({ ...next.spec });
      setRecord(next);
      const version =
        next.sourceCommit === sourceCommit
          ? "Source commit matches."
          : "Source commit differs; results agree with the current engine.";
      setMessage(
        `Replay verified. ${version} A matching digest does not authenticate the author.`,
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
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">
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
                  onClick={() => setSpec({ ...p.spec })}
                  className="block w-full rounded border p-3 text-left transition-colors hover:border-primary focus-visible:outline-primary"
                >
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p.description}
                  </span>
                </button>
              ))}
            </div>
            {controls.map((c) => (
              <div key={c.key}>
                <label
                  htmlFor={c.key}
                  className="flex justify-between gap-2 text-xs"
                >
                  <span>{c.label}</span>
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
            branches start at site A. Duration {PROTOCOL.duration} in engine
            units; Δt = {PROTOCOL.dt}, checked against Δt/2. No random sampling.
          </p>
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
              TWO-SITE MODEL
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
          {stale && (
            <p className="mt-3 rounded border border-amber-400/50 p-3 text-sm text-amber-300">
              Settings changed. The chart and downloads still describe the last
              completed run. Run again to update them.
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
                    Numerical checks
                  </p>
                  <p
                    className={`mt-2 font-mono text-2xl ${allPassed ? "text-primary" : "text-amber-300"}`}
                  >
                    {allPassed ? "3 / 3 passed" : "Review required"}
                  </p>
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
              <div className="mt-6 space-y-2 border-t pt-5 text-sm">
                {[
                  [
                    "Zero-coupling control",
                    record.results.checks.zeroCoupling,
                    `≤ ${PROTOCOL.controlTolerance}`,
                  ],
                  [
                    "Probability conservation",
                    record.results.checks.normalization,
                    `≤ ${PROTOCOL.normalizationTolerance}`,
                  ],
                  [
                    "Half-timestep agreement",
                    record.results.checks.timestepConvergence,
                    `≤ ${PROTOCOL.convergenceTolerance}`,
                  ],
                ].map(([label, passed, tolerance]) => (
                  <div
                    key={String(label)}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <span>
                      {label}{" "}
                      <span className="text-xs text-muted-foreground">
                        {tolerance}
                      </span>
                    </span>
                    <strong
                      className={passed ? "text-primary" : "text-amber-300"}
                    >
                      {passed ? "PASS" : "FAIL"}
                    </strong>
                  </div>
                ))}
              </div>
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
                          "Step error",
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
              The JSON record contains parameters, protocol, results, checks,
              source commit, and an integrity digest. Importing recomputes the
              sweep and rejects mismatches. Files stay in your browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!record || busy}
              onClick={() =>
                record &&
                download(
                  `waveform-${record.digest.slice(0, 12)}.json`,
                  JSON.stringify(record, null, 2),
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
