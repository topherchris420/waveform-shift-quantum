import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  FlaskConical,
  Play,
  ShieldCheck,
  StopCircle,
  Upload,
} from "lucide-react";
import { createDemo, type DemoId } from "./scenarios";
import { EVIDENCE_BOUNDARIES, MODEL_CARDS } from "./modelCards";
import { FinancialNetwork } from "./FinancialNetwork";
import { BalanceSheetInspector } from "./BalanceSheetInspector";
import { TimelineChart } from "./TimelineChart";
import { useLabWorker } from "./useLabWorker";
import { parseBoundedJSON, parseScenario } from "./schema";
import {
  EXAMPLE_SYSTEMIC_SIGNAL,
  SystemicSignalSchema,
  type HypothesisComparison,
} from "./bridge";
import {
  syntheticMacroPath,
  FedScenarioAdapter,
  type runNineQuarterScenario,
} from "./adapters";
import {
  type PolicySimulationPassport,
  type replaySimulation,
} from "./passport";
import { POLICY_VARIANTS, type PolicyVariant } from "./counterfactuals";
import {
  setResearchParameter,
  type ResearchParameter,
  type EnsembleReport,
  type PolicyRobustnessReport,
  type runLayerAblation,
  type calibrateParameter,
  type runHoldout,
} from "./research";
import { csv, download, money, pct } from "./exports";
import type { Scenario } from "./types";
import "./systemic-lab.css";
const INITIAL = createDemo();
const POLICY_LABELS: Record<PolicyVariant, string> = {
  none: "No intervention",
  "market-adjustment": "Market adjustment",
  "liquidity-facility": "Liquidity facility",
  "larger-facility": "Larger facility",
  "smaller-facility": "Smaller facility",
  "faster-facility": "Faster facility",
  "slower-facility": "Slower facility",
  "lower-haircuts": "Lower facility haircuts",
  "expanded-collateral": "Expanded collateral",
  "settlement-support": "Settlement support",
  "network-matching": "Network matching",
  hybrid: "Hybrid coordination",
  genesis: "Genesis experimental routing",
};
function NumberControl({
  label,
  value,
  onChange,
  step = 1,
  max = 100,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  min?: number;
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(4))}
        onChange={(e) => {
          if (e.target.value === "") return;
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}
function SummaryTable({
  rows,
}: {
  rows: Record<string, string | number | null>[];
}) {
  if (!rows.length) return <p>No observations.</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>
                  {typeof r[k] === "number"
                    ? (r[k] as number).toLocaleString("en-US", {
                        maximumFractionDigits: 3,
                      })
                    : (r[k] ?? "Unavailable")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function SystemicLab() {
  const [scenario, setScenario] = useState<Scenario>(() =>
      structuredClone(INITIAL),
    ),
    [demo, setDemo] = useState<DemoId>("lfbo-dollar-funding"),
    [passport, setPassport] = useState<PolicySimulationPassport | null>(null),
    [comparison, setComparison] = useState<
      { policy: PolicyVariant; passport: PolicySimulationPassport }[] | null
    >(null),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState("us-branch"),
    [notice, setNotice] = useState("");
  const [ensemble, setEnsemble] = useState<EnsembleReport | null>(null),
    [robustness, setRobustness] = useState<PolicyRobustnessReport | null>(null),
    [ablation, setAblation] = useState<ReturnType<
      typeof runLayerAblation
    > | null>(null),
    [holdout, setHoldout] = useState<ReturnType<typeof runHoldout> | null>(
      null,
    ),
    [calibration, setCalibration] = useState<ReturnType<
      typeof calibrateParameter
    > | null>(null),
    [hypotheses, setHypotheses] = useState<HypothesisComparison | null>(null),
    [macro, setMacro] = useState<ReturnType<
      typeof runNineQuarterScenario
    > | null>(null);
  const [signalText, setSignalText] = useState(() =>
      JSON.stringify(EXAMPLE_SYSTEMIC_SIGNAL, null, 2),
    ),
    [scenarioText, setScenarioText] = useState(""),
    [calibrationText, setCalibrationText] = useState(""),
    [evidenceSearch, setEvidenceSearch] = useState(""),
    [ensembleSize, setEnsembleSize] = useState(16),
    [candidate, setCandidate] = useState<PolicyVariant>("liquidity-facility"),
    [fedYear, setFedYear] = useState(2026),
    [fedKind, setFedKind] = useState<"baseline" | "adverse" | "exploratory">(
      "adverse",
    ),
    [fedSource, setFedSource] = useState(""),
    [fedPublicationDate, setFedPublicationDate] = useState(""),
    [fedStartQuarter, setFedStartQuarter] = useState("");
  const { run, cancel, busy, progress, error } = useLabWorker();
  const showPassport = useCallback((p: PolicySimulationPassport) => {
    setPassport(p);
    setIndex(p.outcome.timeline.length - 1);
  }, []);
  const execute = async () => {
    setNotice("");
    try {
      showPassport(
        await run<PolicySimulationPassport>({ task: "run", scenario }),
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Experiment failed");
    }
  };
  useEffect(() => {
    let active = true;
    run<PolicySimulationPassport>({ task: "run", scenario: INITIAL })
      .then((p) => {
        if (active) showPassport(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [run, showPassport]);
  const update = (s: Scenario) => {
    s = parseScenario(s);
    cancel();
    setScenario(s);
    setPassport(null);
    setComparison(null);
    setEnsemble(null);
    setRobustness(null);
    setHypotheses(null);
    setMacro(null);
    setHoldout(null);
    setAblation(null);
    setCalibration(null);
    setSelected((current) =>
      s.actors.some((actor) => actor.id === current) ? current : s.actors[0].id,
    );
    setNotice(
      "Inputs changed. Run the experiment to calculate these assumptions.",
    );
  };
  const change = (key: ResearchParameter, v: number) => {
    try {
      update(setResearchParameter(scenario, key, v));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Invalid parameter");
    }
  };
  const capture = async (action: () => Promise<void>) => {
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Operation failed");
    }
  };
  const loadJSON = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5_000_000) throw new Error("Import exceeds 5 MB");
    return parseBoundedJSON(await file.text());
  };
  const result = passport?.outcome,
    snapshot = result?.timeline[Math.min(index, result.timeline.length - 1)],
    institution =
      snapshot?.actors.find((a) => a.id === selected) ?? snapshot?.actors[0];
  const actualScenario = passport?.scenario ?? scenario;
  const evidence = (passport?.scenario.evidence ?? scenario.evidence).filter(
    (e) =>
      `${e.id} ${e.source} ${e.calibrationType}`
        .toLowerCase()
        .includes(evidenceSearch.toLowerCase()),
  );
  const compare = async () => {
    const rows = await run<
      { policy: PolicyVariant; passport: PolicySimulationPassport }[]
    >({
      task: "compare",
      scenario,
      variants: [
        "none",
        "market-adjustment",
        "liquidity-facility",
        "larger-facility",
        "faster-facility",
        "network-matching",
        "hybrid",
        "genesis",
      ],
    });
    setComparison(rows);
  };
  return (
    <main className="systemic-lab" id="policy-desk">
      <a className="desk-skip" href="#current-system">
        Skip to results
      </a>
      <header className="desk-hero">
        <div>
          <p className="eyebrow">
            <FlaskConical size={14} /> VERS3DYNAMICS / COUNTERFACTUAL RESEARCH
          </p>
          <h1>
            Systemic Stress
            <br />
            <span>&amp; Coordination Lab</span>
          </h1>
          <p className="hero-description">
            Trace a shock through balance sheets, funding and settlement. Test
            what changes when the response changes.
          </p>
          <div className="evidence-tags">
            <span>STYLIZED ECONOMIC SIMULATION</span>
            <span>LOCAL COMPUTATION</span>
            <span>SYNTHETIC FIXTURES</span>
          </div>
        </div>
        <aside className="hero-aside">
          <b>
            Every assumption
            <br />
            can be challenged.
          </b>
          <p>
            Explicit claims. Recorded mechanisms.
            <br />
            Replayable experiments.
          </p>
          <a href="#evidence">
            Explore the evidence boundary <ArrowRight size={15} />
          </a>
        </aside>
      </header>
      <nav className="desk-sections" aria-label="Policy desk sections">
        {[
          ["current-system", "Current system"],
          ["shock", "Shock & intervention"],
          ["counterfactuals", "Counterfactuals"],
          ["research", "Robustness"],
          ["drr", "DRR bridge"],
          ["evidence", "Evidence"],
          ["passport", "Passport"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <section id="shock" className="desk-controls">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">01 / DESIGN THE EXPERIMENT</p>
            <h2>What happens if…</h2>
          </div>
          <span className="desk-note">All money in USD millions</span>
        </div>
        <fieldset disabled={busy}>
          <legend className="sr-only">
            Scenario and intervention controls
          </legend>
          <div className="scenario-choices">
            {(
              [
                "lfbo-dollar-funding",
                "intraday-settlement",
                "fire-sale-margin",
              ] as const
            ).map((id, i) => (
              <button
                key={id}
                className={
                  demo === id ? "scenario-choice active" : "scenario-choice"
                }
                onClick={() => {
                  setDemo(id);
                  update(createDemo(id));
                }}
                aria-pressed={demo === id}
              >
                <span>0{i + 1}</span>
                <strong>
                  {id === "lfbo-dollar-funding"
                    ? "LFBO dollar funding"
                    : id === "intraday-settlement"
                      ? "Intraday settlement"
                      : "Fire-sale / margin spiral"}
                </strong>
                <small>
                  {id === "lfbo-dollar-funding"
                    ? "Cross-border funding, collateral and payments"
                    : id === "intraday-settlement"
                      ? "Participant outage and liquidity recycling"
                      : "Market losses and collateral calls"}
                </small>
              </button>
            ))}
          </div>
          <div className="control-grid">
            <NumberControl
              label="Funding withdrawal (%)"
              value={
                (scenario.shocks.find((s) => s.kind === "withdrawal")
                  ?.magnitude ?? 0) * 100
              }
              onChange={(v) => change("withdrawalFraction", v / 100)}
            />
            <NumberControl
              label="Collateral haircut (%)"
              value={
                (scenario.actors.find((a) => a.collateral.length)?.collateral[0]
                  .haircut ?? 0) * 100
              }
              onChange={(v) => change("collateralHaircut", v / 100)}
            />
            <NumberControl
              label="Facility capacity ($m)"
              value={scenario.facilities[0]?.capacity ?? 0}
              max={10000}
              step={10}
              onChange={(v) => change("facilityCapacity", v)}
            />
            <NumberControl
              label="Facility response lag (hours)"
              value={scenario.facilities[0]?.responseLagHours ?? 0}
              max={48}
              onChange={(v) => change("interventionLagHours", v)}
            />
            <NumberControl
              label="Market depth ($m)"
              value={scenario.markets[0]?.marketDepth ?? 900}
              min={1}
              max={20000}
              step={50}
              onChange={(v) => change("marketDepth", v)}
            />
            <label className="number-control">
              <span>Settlement mechanism</span>
              <select
                value={scenario.settlement.mode}
                onChange={(e) =>
                  update({
                    ...scenario,
                    settlement: {
                      ...scenario.settlement,
                      mode: e.target.value as Scenario["settlement"]["mode"],
                    },
                  })
                }
              >
                <option value="gross">Gross settlement</option>
                <option value="bilateral-netting">Bilateral netting</option>
              </select>
            </label>
          </div>
          <div className="run-row">
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={scenario.layers["policy-intervention"]}
                onChange={(e) =>
                  update({
                    ...scenario,
                    layers: {
                      ...scenario.layers,
                      "policy-intervention": e.target.checked,
                    },
                  })
                }
              />
              Enable liquidity facility
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={scenario.policy.allowAssetSales}
                onChange={(e) =>
                  update({
                    ...scenario,
                    policy: {
                      ...scenario.policy,
                      allowAssetSales: e.target.checked,
                    },
                  })
                }
              />
              Allow market asset sales
            </label>
            <NumberControl
              label="Reproducibility seed"
              value={scenario.seed}
              max={4294967295}
              onChange={(v) => update({ ...scenario, seed: Math.floor(v) })}
            />
            <button className="desk-primary" onClick={execute}>
              <Play size={15} />
              Run experiment
            </button>
          </div>
        </fieldset>
        <div role="status" className="job-status">
          {busy ? (
            <>
              <span>
                Computing experiment
                {progress !== null ? ` · ${Math.round(progress * 100)}%` : ""}…
              </span>
              <button onClick={cancel}>
                <StopCircle size={14} />
                Cancel
              </button>
            </>
          ) : (
            notice ||
            error ||
            "Ready. No cloud connection or institution data is required."
          )}
        </div>
        <details className="scenario-editor">
          <summary>Construct or import an explicit scenario</summary>
          <p className="desk-note">
            Edit actors, balance sheets, contracts, facilities and event timing
            as validated JSON. Transactions must reconcile. The starter is
            available below.
          </p>
          <div className="button-row">
            <button
              onClick={() => setScenarioText(JSON.stringify(scenario, null, 2))}
            >
              Load current configuration
            </button>
            <button
              onClick={() => download("systemic-scenario.json", scenario)}
            >
              <ArrowDownToLine size={14} />
              Export scenario
            </button>
            <label className="file-button">
              Import scenario
              <input
                disabled={busy}
                type="file"
                accept=".json,application/json"
                onChange={(e) =>
                  void capture(async () => {
                    const v = await loadJSON(e.target.files?.[0] ?? null);
                    if (v) update(parseScenario(v));
                  })
                }
              />
            </label>
          </div>
          <textarea
            aria-label="Scenario JSON editor"
            value={scenarioText}
            onChange={(e) => setScenarioText(e.target.value)}
            placeholder="Load the current configuration or paste a scenario."
          />
          <button
            disabled={busy || !scenarioText}
            onClick={() =>
              void capture(async () => {
                update(parseScenario(parseBoundedJSON(scenarioText)));
              })
            }
          >
            Validate and use configuration
          </button>
        </details>
      </section>
      <section id="current-system" aria-label="Current experiment results">
        {result && snapshot ? (
          <>
            <div className="results-heading">
              <p className="eyebrow">02 / INSPECT THE SYSTEM</p>
              <span className="state-badge">
                {snapshot.response.replace(/_/g, " ")}
              </span>
            </div>
            <div className="metric-strip">
              {[
                [
                  "Peak liquidity shortfall",
                  money(result.summary.peakLiquidityShortfall),
                ],
                [
                  "Settlement completed",
                  pct(snapshot.metrics.settlementCompletion),
                ],
                [
                  "Capital impairment",
                  money(snapshot.metrics.capitalImpairment),
                ],
                ["Facility borrowing", money(snapshot.metrics.facilityUsage)],
                [
                  "Physical shortfall",
                  `${snapshot.metrics.physicalShortfall.toFixed(1)} units`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <TimelineChart
              rows={result.timeline}
              index={Math.min(index, result.timeline.length - 1)}
              onChange={setIndex}
            />
            <div className="system-grid">
              <FinancialNetwork
                snapshot={snapshot}
                selected={institution?.id ?? selected}
                onSelect={setSelected}
              />
              {institution ? (
                <BalanceSheetInspector
                  institution={institution}
                  initial={actualScenario.actors.find(
                    (a) => a.id === institution.id,
                  )!}
                  snapshot={snapshot}
                  result={result}
                />
              ) : null}
            </div>
            {result.numericalWarnings.length ? (
              <details className="numerical-warning">
                <summary>
                  {result.numericalWarnings.length} numerical or facility
                  warnings — inspect before interpreting
                </summary>
                <ul>
                  {result.numericalWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <details className="desk-panel">
              <summary>
                Systemic event ledger · {result.events.length} recorded events
              </summary>
              <button
                onClick={() =>
                  download(
                    "systemic-event-timeline.csv",
                    csv(
                      result.events.map((e) => ({
                        hour: e.hour,
                        round: e.round,
                        actor: e.actorId,
                        mechanism: e.mechanism,
                        amount: e.amount,
                        units: e.units,
                        calculation: e.calculation,
                      })),
                    ),
                    "text/csv",
                  )
                }
              >
                Export full event table
              </button>
              <SummaryTable
                rows={result.events.slice(-100).map((e) => ({
                  Hour: e.hour,
                  Round: e.round,
                  Actor: e.actorId,
                  Mechanism: e.mechanism,
                  Amount: e.amount,
                  Units: e.units,
                  Calculation: e.calculation,
                }))}
              />
              <p className="desk-note">
                The table shows the most recent 100 events; the CSV and passport
                include the full ledger.
              </p>
            </details>
          </>
        ) : (
          <div className="empty-desk">
            <FlaskConical size={32} />
            <h2>
              {busy
                ? "Calculating the financial network…"
                : "Ready for the next experiment."}
            </h2>
            <p>
              Run your configuration to inspect balances, propagation and
              binding constraints.
            </p>
          </div>
        )}
      </section>
      <section className="desk-panel" id="counterfactuals">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">03 / COUNTERFACTUALS</p>
            <h2>Does the response help—or move the shortfall?</h2>
          </div>
          <button disabled={busy} onClick={() => void capture(compare)}>
            Compare eight responses <ArrowRight size={14} />
          </button>
        </div>
        <p className="desk-note">
          Common starting balances, seeds and shocks. The selected facility and
          market assumptions apply to every comparator. Genesis uses constrained
          payment sequencing; it cannot invent money or resources.
        </p>
        {comparison ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Response</th>
                    <th>Peak shortfall</th>
                    <th>Failed payments</th>
                    <th>Asset sales</th>
                    <th>Price decline</th>
                    <th>Capital loss</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => (
                    <tr key={c.policy}>
                      <th>{POLICY_LABELS[c.policy]}</th>
                      <td>
                        {money(
                          c.passport.outcome.summary.peakLiquidityShortfall,
                        )}
                      </td>
                      <td>
                        {money(
                          c.passport.outcome.summary.failedSettlementValue,
                        )}
                      </td>
                      <td>{money(c.passport.outcome.summary.assetSales)}</td>
                      <td>
                        {pct(c.passport.outcome.summary.priceDislocation)}
                      </td>
                      <td>
                        {money(c.passport.outcome.summary.capitalImpairment)}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            showPassport(c.passport);
                            document
                              .getElementById("current-system")
                              ?.scrollIntoView({ behavior: "auto" });
                          }}
                        >
                          Open run
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() =>
                download(
                  "policy-counterfactuals.csv",
                  csv(
                    comparison.map((c) => ({
                      response: POLICY_LABELS[c.policy],
                      peakShortfall:
                        c.passport.outcome.summary.peakLiquidityShortfall,
                      failedPayments:
                        c.passport.outcome.summary.failedSettlementValue,
                      assetSales: c.passport.outcome.summary.assetSales,
                      priceDislocation:
                        c.passport.outcome.summary.priceDislocation,
                    })),
                  ),
                  "text/csv",
                )
              }
            >
              Export comparison table
            </button>
          </>
        ) : (
          <p className="empty-note">
            No policy is preselected as a winner. “No material difference” is a
            valid outcome.
          </p>
        )}
        <a className="inline-link" href="/resonance">
          Explore Market, Double Auction, Shadow-Price Market, Stabilized
          Market, Hybrid, Network Matching and Genesis resource-allocation
          comparators →
        </a>
      </section>
      <section className="desk-panel" id="research">
        <p className="eyebrow">04 / CHALLENGE THE RESULT</p>
        <h2>Which conclusions survive?</h2>
        <p className="desk-note">
          Sample plausible inputs, remove mechanisms, or test a frozen policy
          claim on disjoint holdout seeds.
        </p>
        <div className="research-controls">
          <NumberControl
            label="Ensemble size"
            value={ensembleSize}
            min={2}
            max={64}
            onChange={(v) => setEnsembleSize(Math.floor(v))}
          />
          <label className="number-control">
            <span>Candidate response</span>
            <select
              value={candidate}
              onChange={(e) => setCandidate(e.target.value as PolicyVariant)}
            >
              {POLICY_VARIANTS.map((v) => (
                <option key={v} value={v}>
                  {POLICY_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void capture(async () =>
                setEnsemble(
                  await run<EnsembleReport>({
                    task: "ensemble",
                    scenario,
                    config: {
                      seed: scenario.seed,
                      size: ensembleSize,
                      method: "latin-hypercube",
                      distributions: [
                        {
                          parameter: "withdrawalFraction",
                          distribution: "uniform",
                          lower: 0.1,
                          upper: 0.6,
                        },
                        {
                          parameter: "marketDepth",
                          distribution: "uniform",
                          lower: 300,
                          upper: 1500,
                        },
                      ],
                      shockCorrelation: 0.5,
                      shockStdDev: 0.03,
                      breachThreshold: 50,
                    },
                  }),
                ),
              )
            }
          >
            Run uncertainty ensemble
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void capture(async () =>
                setRobustness(
                  await run<PolicyRobustnessReport>({
                    task: "robustness",
                    scenario,
                    candidate,
                  }),
                ),
              )
            }
          >
            Challenge policy assumptions
          </button>
        </div>
        <p className="desk-note">
          Default ensemble: withdrawal 10–60%, market depth $300m–$1,500m,
          correlated shock perturbations with 3 percentage-point standard
          deviation. These ranges are exploratory assumptions.
        </p>
        {ensemble ? (
          <>
            <div className="research-summary">
              <strong>{money(ensemble.median)} median peak shortfall</strong>
              <span>
                5th–95th percentiles: {money(ensemble.p05)}–
                {money(ensemble.p95)}
              </span>
              <span>
                {pct(ensemble.breachProbability)} exceeded $50m ·{" "}
                {ensemble.sampleSize} draws
              </span>
            </div>
            <p className="desk-note">
              {ensemble.uncertaintyBoundary} Median change after doubling the
              first-half sample: {money(ensemble.convergence.medianChange)}.
            </p>
            <button
              onClick={() => download("policy-uncertainty.json", ensemble)}
            >
              Export ensemble record
            </button>
          </>
        ) : null}
        {robustness ? (
          <>
            <h3>{robustness.status}</h3>
            <p className="desk-note">{robustness.interpretation}</p>
            <SummaryTable
              rows={robustness.rows.map((r) => ({
                Assumption: r.assumption,
                "Shortfall improvement ($m)": r.effect,
                "Added failures ($m)": r.failedPaymentIncrease,
                "Added capital loss ($m)": r.capitalLossIncrease,
                Warnings: r.numericalWarnings,
              }))}
            />
          </>
        ) : null}
        <details>
          <summary>Mechanism contributions and interactions</summary>
          <button
            disabled={busy}
            onClick={() =>
              void capture(async () =>
                setAblation(
                  await run<ReturnType<typeof runLayerAblation>>({
                    task: "ablation",
                    scenario,
                  }),
                ),
              )
            }
          >
            Run nine-layer paired ablation
          </button>
          {ablation ? (
            <>
              <p className="desk-note">{ablation.interpretation}</p>
              <SummaryTable
                rows={ablation.contributions.map((c) => ({
                  Layer: c.layer,
                  "Marginal shortfall ($m)": c.marginalEffect,
                  Effect: c.interpretation,
                  "Seed range": c.interval.map(money).join(" to "),
                }))}
              />
              <SummaryTable
                rows={ablation.interactions.map((c) => ({
                  "Layer A": c.a,
                  "Layer B": c.b,
                  "Interaction ($m)": c.interaction,
                }))}
              />
            </>
          ) : null}
        </details>
        <details>
          <summary>Freeze a claim and test holdout seeds</summary>
          <p className="desk-note">
            Discovery seed {scenario.seed}. Holdout seeds{" "}
            {(scenario.seed + 100003) >>> 0} and{" "}
            {(scenario.seed + 200003) >>> 0}. Required improvement: $1m peak
            shortfall, no increase in failed payments or capital loss.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void capture(async () =>
                setHoldout(
                  await run<ReturnType<typeof runHoldout>>({
                    task: "holdout",
                    claim: {
                      schema: "policy-preregistration.v1",
                      scenario,
                      baseline: "none",
                      candidate,
                      discoverySeeds: [scenario.seed],
                      holdoutSeeds: [
                        (scenario.seed + 100003) >>> 0,
                        (scenario.seed + 200003) >>> 0,
                      ],
                      minimumEffect: 1,
                      maxFailedPaymentIncrease: 0,
                      maxCapitalLossIncrease: 0,
                    },
                  }),
                ),
              )
            }
          >
            Freeze and run holdout
          </button>
          {holdout ? (
            <>
              <h3>{holdout.status}</h3>
              <p>
                {money(holdout.meanEffect)} mean improvement; bootstrap interval{" "}
                {holdout.interval.map(money).join(" to ")}.
              </p>
              <button
                onClick={() =>
                  download("policy-preregistration-and-holdout.json", holdout)
                }
              >
                Export frozen claim and holdout
              </button>
            </>
          ) : null}
        </details>
        <details>
          <summary>Calibration workbench</summary>
          <p className="desk-note">
            Supply a dataset with source, sourceDate and at least three
            observations containing seed, peakLiquidityShortfall ($m), and
            priceDislocation (fraction). This fits an exploratory market-depth
            grid; it does not establish validation.
          </p>
          <textarea
            aria-label="Calibration dataset JSON"
            value={calibrationText}
            onChange={(e) => setCalibrationText(e.target.value)}
            placeholder='{"source":"Dataset citation","sourceDate":"2026-09-12","observations":[...]}'
          />
          <button
            disabled={busy || !calibrationText}
            onClick={() =>
              void capture(async () =>
                setCalibration(
                  await run<ReturnType<typeof calibrateParameter>>({
                    task: "calibrate",
                    scenario,
                    parameter: "marketDepth",
                    grid: [250, 500, 750, 1000, 1500],
                    dataset: parseBoundedJSON(calibrationText) as Parameters<
                      typeof calibrateParameter
                    >[3],
                  }),
                ),
              )
            }
          >
            Calibrate market depth
          </button>
          {calibration ? (
            <>
              <h3>
                Selected market depth: {money(calibration.parameterValue)}
              </h3>
              <p>
                {calibration.identifiabilityWarnings.join(" ")}{" "}
                {calibration.interpretation}
              </p>
              <SummaryTable
                rows={calibration.candidates.map((c) => ({
                  "Depth ($m)": c.value,
                  "Simulated shortfall ($m)": c.modeled.shortfall,
                  "Price dislocation": c.modeled.price,
                  Residual: c.objective,
                }))}
              />
              <button
                onClick={() => download("calibration-report.json", calibration)}
              >
                Export calibration report
              </button>
            </>
          ) : null}
        </details>
      </section>
      <section className="desk-panel" id="drr">
        <p className="eyebrow">05 / OBSERVATION TO EXPERIMENT</p>
        <h2>One signal. Competing explanations.</h2>
        <p className="desk-note">
          DRR observes structural relationships. This lab tests mechanisms that
          might reproduce selected features. Mapping an observed institution to
          a synthetic actor does not identify what happened at that institution.
        </p>
        <div className="button-row">
          <label className="file-button">
            <Upload size={14} />
            Import DRR signal
            <input
              disabled={busy}
              type="file"
              accept=".json"
              onChange={(e) =>
                void capture(async () => {
                  const v = await loadJSON(e.target.files?.[0] ?? null);
                  if (v)
                    setSignalText(
                      JSON.stringify(SystemicSignalSchema.parse(v), null, 2),
                    );
                })
              }
            />
          </label>
          <button
            onClick={() =>
              download("systemic-signal-example.json", EXAMPLE_SYSTEMIC_SIGNAL)
            }
          >
            Export signal example
          </button>
          <label className="number-control">
            <span>Map observation to synthetic actor</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {scenario.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details>
          <summary>Observed signal and provenance</summary>
          <textarea
            aria-label="DRR SystemicSignal JSON"
            value={signalText}
            onChange={(e) => setSignalText(e.target.value)}
          />
        </details>
        <p className="desk-note">
          Mechanism trials assume a 20% fractional shock or an 8-hour outage.
          These are editable research hypotheses in the exported scenario, not
          conversions of the alert magnitude.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            void capture(async () =>
              setHypotheses(
                await run<HypothesisComparison>({
                  task: "hypotheses",
                  scenario,
                  signal: parseBoundedJSON(signalText),
                  target: selected,
                }),
              ),
            )
          }
        >
          Run six mechanism hypotheses
        </button>
        {hypotheses ? (
          <>
            <h3>{hypotheses.summary}</h3>
            <p className="desk-note">{hypotheses.evidenceBoundary}</p>
            <SummaryTable
              rows={hypotheses.ranking.map((r) => ({
                Mechanism: r.hypothesis,
                Assessment: r.status,
                RMSE: r.rmse,
                "Comparable features": r.comparedFeatures,
                "Missing features": r.missingFeatures.join(", "),
              }))}
            />
            <button
              onClick={() =>
                download("mechanism-hypothesis-comparison.json", hypotheses)
              }
            >
              Export competing explanations
            </button>
          </>
        ) : null}
      </section>
      <section className="desk-panel">
        <p className="eyebrow">06 / MULTI-QUARTER RESEARCH</p>
        <h2>Follow a scenario across nine quarters.</h2>
        <p className="desk-note">
          Import a normalized public scenario path with source, publication
          date, units and Q0–Q9 observations. Explicit default mappings connect
          Treasury yields to duration losses, unemployment to withdrawals, and
          corporate spreads to funding costs. Other variables remain visible as
          unmapped.
        </p>
        <div className="button-row">
          <label className="file-button">
            Import public scenario path
            <input
              disabled={busy}
              type="file"
              accept=".json"
              onChange={(e) =>
                void capture(async () => {
                  const value = await loadJSON(e.target.files?.[0] ?? null);
                  if (value)
                    setMacro(
                      await run<ReturnType<typeof runNineQuarterScenario>>({
                        task: "macro",
                        scenario,
                        path: FedScenarioAdapter.parse(value),
                      }),
                    );
                })
              }
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void capture(async () =>
                setMacro(
                  await run<ReturnType<typeof runNineQuarterScenario>>({
                    task: "macro",
                    scenario,
                    path: syntheticMacroPath(),
                  }),
                ),
              )
            }
          >
            Run synthetic Q0–Q9 example
          </button>
          <button
            onClick={() =>
              download(
                "public-scenario-path-example.json",
                syntheticMacroPath(),
              )
            }
          >
            Export path template
          </button>
        </div>
        <details>
          <summary>Import a Federal Reserve domestic scenario CSV</summary>
          <p className="desk-note">
            Enter the file's own metadata; the published CSV does not encode its
            source URL or publication date. When the file contains more than ten
            quarters, the adapter selects the ten-quarter window beginning at
            the optional start quarter.
          </p>
          <div className="research-controls">
            <label className="compact-label">
              Scenario year
              <input
                type="number"
                min={2000}
                max={2100}
                value={fedYear}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value >= 2000 && value <= 2100)
                    setFedYear(value);
                }}
              />
            </label>
            <label className="compact-label">
              Scenario kind
              <select
                value={fedKind}
                onChange={(e) =>
                  setFedKind(
                    e.target.value as "baseline" | "adverse" | "exploratory",
                  )
                }
              >
                <option value="baseline">Baseline</option>
                <option value="adverse">Adverse</option>
                <option value="exploratory">Exploratory</option>
              </select>
            </label>
            <label className="compact-label">
              Publication date
              <input
                type="date"
                value={fedPublicationDate}
                onChange={(e) => setFedPublicationDate(e.target.value)}
              />
            </label>
            <label className="compact-label">
              First quarter (optional)
              <input
                value={fedStartQuarter}
                placeholder="2026Q1"
                pattern="20[0-9]{2}Q[1-4]"
                onChange={(e) => setFedStartQuarter(e.target.value)}
              />
            </label>
            <label className="compact-label">
              Source URL or citation
              <input
                value={fedSource}
                placeholder="https://www.federalreserve.gov/…"
                onChange={(e) => setFedSource(e.target.value)}
              />
            </label>
            <label className="file-button">
              Choose domestic CSV
              <input
                disabled={busy}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) =>
                  void capture(async () => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2_000_000)
                      throw new Error("Federal Reserve CSV exceeds 2 MB");
                    if (!fedSource.trim() || !fedPublicationDate)
                      throw new Error(
                        "Source and publication date are required for a public scenario import",
                      );
                    const path =
                      FedScenarioAdapter.fromFederalReserveDomesticCSV(
                        await file.text(),
                        {
                          scenarioYear: fedYear,
                          kind: fedKind,
                          source: fedSource.trim(),
                          publicationDate: fedPublicationDate,
                          ...(fedStartQuarter.trim()
                            ? { startQuarter: fedStartQuarter.trim() }
                            : {}),
                        },
                      );
                    setMacro(
                      await run<ReturnType<typeof runNineQuarterScenario>>({
                        task: "macro",
                        scenario,
                        path,
                      }),
                    );
                  })
                }
              />
            </label>
          </div>
        </details>
        {macro ? (
          <>
            <p className="desk-note">
              Unmapped variables: {macro.unmappedVariables.join(", ") || "none"}
              . Quarterly mode uses 72-hour steps; intraday effects need the
              separate settlement demo.
            </p>
            <SummaryTable
              rows={macro.quarterly.map((q) => ({
                Quarter: `Q${q.index} · ${q.quarter}`,
                "Liquidity shortfall ($m)":
                  q.snapshot.metrics.liquidityShortfall,
                "Equity ($m)": q.snapshot.metrics.equity,
                "Settlement completion": pct(
                  q.snapshot.metrics.settlementCompletion,
                ),
                "Facility usage ($m)": q.snapshot.metrics.facilityUsage,
              }))}
            />
            <button
              onClick={() => download("nine-quarter-experiment.json", macro)}
            >
              Export quarterly experiment
            </button>
          </>
        ) : null}
      </section>
      <section className="desk-panel" id="evidence">
        <p className="eyebrow">07 / EVIDENCE & MODEL RISK</p>
        <h2>Know what each number rests on.</h2>
        <div className="boundary-grid">
          {EVIDENCE_BOUNDARIES.map((e) => (
            <article key={e.category}>
              <h3>{e.category}</h3>
              <p>{e.description}</p>
            </article>
          ))}
        </div>
        <p className="desk-note">
          The quantum and ARFR workstations remain separate. Speculative
          physical models do not validate financial conclusions. This laboratory
          makes no claim of Federal Reserve endorsement or supervisory
          validation.
        </p>
        <details>
          <summary>
            Parameter evidence registry · {evidence.length} entries
          </summary>
          <label className="number-control">
            <span>Find parameter or source</span>
            <input
              value={evidenceSearch}
              onChange={(e) => setEvidenceSearch(e.target.value)}
            />
          </label>
          <SummaryTable
            rows={evidence.slice(0, 80).map((e) => ({
              Parameter: e.id,
              Value: e.value,
              Units: e.units,
              Classification: e.calibrationType,
              Source: e.source,
              Date: e.sourceDate,
            }))}
          />
          <p className="desk-note">
            Showing up to 80 matches. Export the full registry for all fields.
          </p>
          <button
            onClick={() =>
              download(
                "parameter-evidence.json",
                passport?.scenario.evidence ?? scenario.evidence,
              )
            }
          >
            Export full evidence registry
          </button>
        </details>
        <details>
          <summary>Model component cards</summary>
          <div className="model-card-grid">
            {MODEL_CARDS.map((c) => (
              <article key={c.id}>
                <h3>{c.name}</h3>
                <p>{c.mechanism}</p>
                <p className="desk-note">{c.limitations.join(" ")}</p>
              </article>
            ))}
          </div>
        </details>
      </section>
      <section className="passport-section" id="passport">
        <div>
          <p className="eyebrow">08 / REPRODUCE THE EXPERIMENT</p>
          <h2>
            The run is inspectable.
            <br />
            The calculation is replayable.
          </h2>
          <p>
            Content integrity establishes that the recorded experiment is
            intact. Exact replay checks that the recorded model reproduces its
            outcomes.
          </p>
          {passport ? (
            <p className="passport-id">
              <ShieldCheck size={14} />
              {passport.runId}
              <br />
              SHA-256 {passport.identityHash}
            </p>
          ) : null}
        </div>
        <div className="passport-actions">
          <button
            disabled={!passport}
            onClick={() =>
              passport && download(`${passport.runId}.json`, passport)
            }
          >
            <ArrowDownToLine size={16} />
            Export policy passport
          </button>
          <label className="file-button">
            Verify and replay a passport
            <input
              disabled={busy}
              type="file"
              accept=".json"
              onChange={(e) =>
                void capture(async () => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 40_000_000)
                    throw new Error("Passport exceeds 40 MB");
                  const data = parseBoundedJSON(await file.text(), 40_000_000);
                  const r = await run<
                    Awaited<ReturnType<typeof replaySimulation>>
                  >({ task: "replay", passport: data });
                  setNotice(
                    r.equivalent
                      ? "Passport integrity verified. Exact replay matches every recorded outcome."
                      : "Passport content is intact, but replay differs from the recorded outcome.",
                  );
                })
              }
            />
          </label>
          <p className="desk-note">
            Run inputs, facility decisions, events, provenance and full outcomes
            are included. Robustness and falsification remain “not evaluated” in
            a single-run passport; separate research exports record those tests.
          </p>
        </div>
      </section>
      <footer className="desk-footer">
        <span>VERS3DYNAMICS · SYSTEMIC STRESS & COORDINATION LAB</span>
        <span>Research simulation · USD millions · No telemetry</span>
      </footer>
    </main>
  );
}
