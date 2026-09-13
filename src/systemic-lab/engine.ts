import { event, liquid, sum, liquidityPosition } from "./accounting";
import { FacilityEngine } from "./facilities";
import { measure } from "./metrics";
import {
  assertFinancialState,
  createPayment,
  provideCommittedSupport,
} from "./network";
import { applyShock, propagateRound, reactFunding } from "./propagation";
import { SettlementNetwork } from "./settlement";
import { revalueMarket } from "./market";
import { normalDraw } from "./random";
import { parseScenario } from "./schema";
import {
  MODEL_VERSION,
  TOLERANCE,
  type PolicySimulationResult,
  type Scenario,
  type SimulationSnapshot,
  type StressResponseState,
  type SystemicMetrics,
  type SystemicState,
} from "./types";
export function initialState(scenario: Scenario): SystemicState {
  const s = structuredClone(scenario);
  return {
    hour: 0,
    round: 0,
    actors: s.actors,
    exposures: s.exposures,
    payments: s.payments,
    margins: s.margins,
    markets: s.markets,
    evidence: s.evidence,
    facilities: s.facilities,
    facilityLoans: [],
    physical: s.physical,
    events: [],
    warnings: [],
    response: "NORMAL",
    cumulativeSales: 0,
    cumulativeFacilityDraws: 0,
    cumulativeLoss: 0,
  };
}
export class StressResponseStateMachine {
  static next(
    previous: StressResponseState,
    m: SystemicMetrics,
  ): { state: StressResponseState; rule: string } {
    if (m.insolventInstitutions > 0 || m.failedSettlementValue > TOLERANCE)
      return {
        state: "SYSTEMIC_STRESS",
        rule: "At least one insolvent/resolved participant or failed payment.",
      };
    if (m.facilityUsage > TOLERANCE)
      return {
        state: "FACILITY_SUPPORT",
        rule: "Outstanding central-bank facility borrowing.",
      };
    if (m.priceDislocation > 0.1)
      return {
        state: "MARKET_STRESS",
        rule: "At least one asset price is more than 10% below its initial price.",
      };
    if (m.liquidityShortfall > TOLERANCE)
      return {
        state: "LIQUIDITY_STRESS",
        rule: "Due obligations plus treasury buffer exceed available liquidity.",
      };
    if (!["NORMAL", "STABILIZATION", "RECOVERY"].includes(previous))
      return {
        state: "STABILIZATION",
        rule: "Stress thresholds cleared; one recorded observation required before recovery.",
      };
    return previous === "NORMAL"
      ? { state: "NORMAL", rule: "No stress threshold crossed." }
      : {
          state: "RECOVERY",
          rule: "Thresholds remain clear after stabilization.",
        };
  }
}
/** Preserve a no-recycling opening budget while admitting non-settlement liquidity changes. */
export function updateSettlementBudget(
  budget: Map<string, number>,
  beforeMechanisms: Map<string, number>,
  state: Pick<SystemicState, "actors">,
): void {
  for (const a of state.actors)
    budget.set(
      a.id,
      Math.max(
        0,
        (budget.get(a.id) ?? 0) + liquid(a) - (beforeMechanisms.get(a.id) ?? 0),
      ),
    );
}
/** Fixed-step discrete financial experiment. No wall-clock or network access. */
export function runPolicySimulation(
  scenario: Scenario,
): PolicySimulationResult {
  if (
    !Number.isFinite(scenario.stepHours) ||
    scenario.stepHours <= 0 ||
    scenario.horizonHours / scenario.stepHours > 1000 ||
    scenario.maxRounds < 1 ||
    scenario.maxRounds > 20 ||
    scenario.actors.length > 80
  )
    throw new Error("Simulation exceeds bounded numerical budget");
  scenario = parseScenario(scenario);
  const state = initialState(scenario);
  if (!scenario.layers.behavioral)
    for (const a of state.actors) a.behavior.hoarding = 0;
  assertFinancialState(state);
  const core = state.actors.filter(
    (a) =>
      !["central-bank", "deposit-sector", "settlement-utility"].includes(
        a.type,
      ),
  );
  const initialEquity = sum(core.map((a) => a.balanceSheet.equity)),
    initialLiquidity = sum(state.actors.map(liquid));
  const timeline: SimulationSnapshot[] = [];
  const record = () => {
    const metrics = measure(state, initialEquity, initialLiquidity);
    const next = StressResponseStateMachine.next(state.response, metrics);
    if (next.state !== state.response)
      event(state, {
        actorId: "system",
        mechanism: "stress-response-transition",
        amount: 0,
        units: "USD million",
        previous: state.response,
        next: next.state,
        calculation: next.rule,
        evidenceIds: [],
        edgeId: null,
      });
    state.response = next.state;
    timeline.push({
      hour: state.hour,
      round: state.round,
      response: state.response,
      actors: structuredClone(state.actors),
      liquidityPositions: Object.fromEntries(
        state.actors.map((a) => [a.id, liquidityPosition(state, a)]),
      ),
      networkEdges: [
        ...state.exposures.map((e) => ({
          id: e.id,
          from: e.creditor,
          to: e.debtor,
          layer: "funding" as const,
          amount: e.principal,
        })),
        ...state.payments
          .filter((p) => p.dueHour <= state.hour && p.remaining > 0)
          .map((p) => ({
            id: p.id,
            from: p.from,
            to: p.to,
            layer: "payments" as const,
            amount: p.remaining,
          })),
        ...state.margins.map((m) => ({
          id: m.id,
          from: m.payer,
          to: m.receiver,
          layer: "margin" as const,
          amount: m.notional,
        })),
        ...state.facilityLoans
          .filter((l) => ["ACTIVE", "DEFAULTED"].includes(l.status))
          .map((l) => ({
            id: l.id,
            from: state.facilities.find((f) => f.id === l.facilityId)!
              .centralBankId,
            to: l.borrower,
            layer: "facilities" as const,
            amount: l.amount,
          })),
        ...state.actors
          .filter((a) => a.parentId)
          .map((a) => ({
            id: a.id,
            from: a.parentId!,
            to: a.id,
            layer: "ownership" as const,
            amount: 0,
          })),
      ],
      metrics,
    });
    return metrics;
  };
  record();
  const applied = new Set<string>();
  const steps = Math.round(scenario.horizonHours / scenario.stepHours);
  for (let step = 0; step <= steps; step++) {
    state.hour = step * scenario.stepHours;
    state.round = 0;
    for (const shock of scenario.shocks)
      if (!applied.has(shock.id) && shock.hour <= state.hour) {
        applyShock(state, shock, scenario);
        applied.add(shock.id);
      }
    if (step > 0 && scenario.layers["market-price"])
      for (const market of state.markets)
        if (market.volatility > TOLERANCE) {
          const dt = scenario.stepHours / (24 * 252);
          const z = normalDraw(
            scenario.seed,
            "market-volatility",
            market.assetClass,
            state.hour,
          );
          revalueMarket(
            state,
            market.assetClass,
            market.price *
              Math.exp(
                -0.5 * market.volatility ** 2 * dt +
                  market.volatility * Math.sqrt(dt) * z,
              ),
            "seeded-market-volatility",
            [
              `markets.${state.markets.findIndex((candidate) => candidate === market)}.volatility`,
            ],
          );
        }
    if (step > 0 && scenario.layers.financial)
      for (const e of state.exposures) {
        if (
          state.actors.some(
            (a) => (a.id === e.creditor || a.id === e.debtor) && a.resolved,
          )
        )
          continue;
        const interest =
          (((e.principal * e.spreadBps) / 10000) * scenario.stepHours) / 8760;
        if (interest > TOLERANCE)
          createPayment(
            state,
            {
              id: `interest:${e.id}:${step}`,
              from: e.debtor,
              to: e.creditor,
              amount: interest,
              dueHour: state.hour,
              deadlineHour: state.hour + 24,
              priority: 2,
              kind: "payment",
            },
            [
              `exposures.${state.exposures.findIndex((candidate) => candidate === e)}.spreadBps`,
            ],
          );
      }
    reactFunding(state, scenario);
    // Record the first-round stress before policy changes the system.
    record();
    let previousSignature = "";
    const settlementBudget = new Map(
      state.actors.map((a) => [a.id, liquid(a)]),
    );
    for (let round = 1; round <= scenario.maxRounds; round++) {
      state.round = round;
      const beforeMechanisms = new Map(
        state.actors.map((a) => [a.id, liquid(a)]),
      );
      if (scenario.layers.institutional && scenario.layers.financial)
        for (const exposure of state.exposures)
          provideCommittedSupport(state, exposure);
      if (scenario.layers["policy-intervention"]) {
        for (const f of state.facilities)
          for (const a of state.actors)
            if (a.id !== f.centralBankId)
              FacilityEngine.request(state, f, a.id);
        FacilityEngine.process(state);
      }
      propagateRound(state, scenario);
      if (
        scenario.layers["computational-routing"] &&
        scenario.policy.routing !== "fifo" &&
        scenario.policy.routingOverheadBps > 0
      ) {
        const utility = state.actors.find(
          (a) => a.type === "settlement-utility",
        );
        if (utility)
          for (const payment of [...state.payments]) {
            const id = `routing-fee:${payment.id}`;
            if (
              payment.from === utility.id ||
              payment.id.startsWith("routing-fee:") ||
              payment.dueHour > state.hour ||
              state.payments.some((p) => p.id === id)
            )
              continue;
            const fee =
              (payment.amount * scenario.policy.routingOverheadBps) / 10000;
            if (fee > TOLERANCE)
              createPayment(
                state,
                {
                  id,
                  from: payment.from,
                  to: utility.id,
                  amount: fee,
                  dueHour: state.hour,
                  deadlineHour: state.hour + 24,
                  priority: 2,
                  kind: "payment",
                },
                ["policy.routingOverheadBps"],
              );
          }
      }
      if (scenario.layers.settlement) {
        // Facility credit, sales, margin posting and committed support change spendable funds.
        // Only receipts from settlement itself are excluded when recycling is disabled.
        updateSettlementBudget(settlementBudget, beforeMechanisms, state);
        SettlementNetwork.settle(
          state,
          scenario.settlement,
          scenario.seed,
          scenario.layers["computational-routing"]
            ? scenario.policy.routing
            : "fifo",
          settlementBudget,
        );
      }
      assertFinancialState(state);
      const m = record();
      const signature = JSON.stringify(
        [
          m.liquidityShortfall,
          m.equity,
          m.queuedPayments,
          m.facilityUsage,
          m.priceDislocation,
        ].map((v) => Math.round(v / scenario.convergenceTolerance)),
      );
      if (signature === previousSignature) break;
      if (round === scenario.maxRounds)
        state.warnings.push(
          `Hour ${state.hour}: maximum ${round} propagation rounds reached; convergence not established.`,
        );
      previousSignature = signature;
    }
  }
  const final = timeline[timeline.length - 1].metrics;
  let stressHour: number | null = null,
    recovery: number | null = null;
  for (const row of timeline) {
    if (row.response !== "NORMAL" && stressHour === null) stressHour = row.hour;
    if (row.response === "RECOVERY" && stressHour !== null)
      recovery = row.hour - stressHour;
    else if (row.response !== "STABILIZATION") recovery = null;
  }
  return {
    modelVersion: MODEL_VERSION,
    scenarioId: scenario.id,
    seed: scenario.seed,
    timeline,
    events: state.events,
    finalState: state,
    summary: {
      ...final,
      peakLiquidityShortfall: Math.max(
        ...timeline.map((r) => r.metrics.liquidityShortfall),
      ),
      peakIntradayLiquidityNeed: Math.max(
        ...timeline.map((r) => r.metrics.liquidityShortfall),
      ),
      recoveryTimeHours: stressHour === null ? 0 : recovery,
    },
    numericalWarnings: state.warnings,
    interpretation:
      "Stylized counterfactual simulation. Results depend on explicit assumptions; no causal identification, forecast, regulatory ratio certification or institutional endorsement.",
  };
}
