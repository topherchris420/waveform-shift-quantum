import {
  actor,
  capitalPosition,
  clamp,
  event,
  liquidityPosition,
} from "./accounting";
import { revalueMarket, fireSale } from "./market";
import { processMargins } from "./margin";
import {
  assertFinancialState,
  createPayment,
  resolveCounterparty,
  securedExposureValue,
  withdrawFunding,
} from "./network";
import { draw } from "./random";
import { evidencePaths } from "./evidence";
import {
  TOLERANCE,
  type Scenario,
  type Shock,
  type SystemicState,
} from "./types";
export function applyShock(
  state: SystemicState,
  shock: Shock,
  scenario: Scenario,
): void {
  const shockRoot = `shocks.${scenario.shocks.findIndex((candidate) => candidate.id === shock.id)}`;
  const shockEvidence = [
    ...shock.evidenceIds,
    ...evidencePaths(
      state,
      `${shockRoot}.hour`,
      `${shockRoot}.magnitude`,
      `${shockRoot}.durationHours`,
    ),
  ];
  if (shock.kind === "physical") {
    if (!scenario.layers.physical) return;
    const before = state.physical.capacity;
    state.physical.capacity *= 1 - clamp(shock.magnitude);
    event(state, {
      actorId: "physical-system",
      mechanism: "physical-capacity-shock",
      amount: before - state.physical.capacity,
      units: "resource units",
      previous: before,
      next: state.physical.capacity,
      calculation:
        "Destroyed physical capacity = prior capacity × shock fraction. Financial facilities cannot restore it.",
      evidenceIds: shockEvidence,
      edgeId: null,
    });
    return;
  }
  if (
    !scenario.layers.financial &&
    ["withdrawal", "spread", "default", "payment-demand"].includes(shock.kind)
  )
    return;
  switch (shock.kind) {
    case "price":
      if (scenario.layers["market-price"]) {
        const m = state.markets.find((m) => m.assetClass === shock.target);
        if (!m) throw new Error("Unknown price-shock market");
        revalueMarket(
          state,
          m.assetClass,
          m.price * (1 - clamp(shock.magnitude, -10, 1)),
          "initial-market-shock",
          shockEvidence,
        );
      }
      break;
    case "haircut":
      for (const a of state.actors)
        for (const c of a.collateral)
          if (
            shock.target === a.id ||
            shock.target === c.assetClass ||
            shock.target === "all"
          ) {
            const before = c.haircut;
            c.haircut = clamp(c.haircut + shock.magnitude);
            event(state, {
              actorId: a.id,
              mechanism: "haircut-shock",
              amount: c.haircut - before,
              units: "fraction",
              previous: before,
              next: c.haircut,
              calculation: `${c.id}: haircut add ${shock.magnitude}; no asset price or equity change.`,
              evidenceIds: shockEvidence,
              edgeId: null,
            });
          }
      break;
    case "withdrawal":
      for (const e of state.exposures)
        if (
          e.debtor === shock.target ||
          e.id === shock.target ||
          shock.target === "all"
        )
          withdrawFunding(
            state,
            e,
            e.principal * clamp(shock.magnitude),
            shockEvidence,
          );
      break;
    case "outage": {
      const a = actor(state, shock.target);
      a.outageUntil = Math.max(a.outageUntil, state.hour + shock.durationHours);
      event(state, {
        actorId: a.id,
        mechanism: "participant-outage",
        amount: shock.durationHours,
        units: "hours",
        previous: state.hour,
        next: a.outageUntil,
        calculation:
          "Participant cannot send or receive settlement until outage expires.",
        evidenceIds: shockEvidence,
        edgeId: null,
      });
      break;
    }
    case "default":
      resolveCounterparty(state, shock.target);
      break;
    case "spread":
      for (const e of state.exposures)
        if (
          shock.target === "all" ||
          e.debtor === shock.target ||
          e.id === shock.target
        ) {
          e.spreadBps = Math.max(0, e.spreadBps + shock.magnitude);
          event(state, {
            actorId: e.debtor,
            mechanism: "funding-spread-shock",
            amount: shock.magnitude / 10000,
            units: "fraction",
            previous: (e.spreadBps - shock.magnitude) / 10000,
            next: e.spreadBps / 10000,
            calculation:
              "Annual funding spread change; future interest uses actual hours / 8760.",
            evidenceIds: shockEvidence,
            edgeId: e.id,
          });
        }
      break;
    case "payment-demand": {
      const from = actor(state, shock.target);
      const to = state.actors.find((a) => a.type === "settlement-utility");
      if (!to) throw new Error("Payment demand requires a settlement utility");
      createPayment(
        state,
        {
          id: `shock:${shock.id}`,
          from: from.id,
          to: to.id,
          amount: shock.magnitude,
          dueHour: state.hour,
          deadlineHour: state.hour + shock.durationHours,
          priority: 1,
          kind: "payment",
        },
        shockEvidence,
      );
      break;
    }
  }
}
export function reactFunding(state: SystemicState, scenario: Scenario): void {
  if (!scenario.layers.counterparty || !scenario.layers.financial) return;
  for (const e of state.exposures) {
    const debtor = actor(state, e.debtor),
      creditor = actor(state, e.creditor);
    if (debtor.resolved || creditor.resolved) continue;
    if (e.maturityHour <= state.hour) {
      const rollover =
        draw(scenario.seed, "rollover", e.id, e.maturityHour) <
        e.rolloverProbability;
      if (!rollover)
        withdrawFunding(
          state,
          e,
          e.principal,
          evidencePaths(
            state,
            `exposures.${state.exposures.findIndex((candidate) => candidate === e)}.rolloverProbability`,
            `exposures.${state.exposures.findIndex((candidate) => candidate === e)}.maturityHour`,
          ),
        );
      e.maturityHour += 24;
    }
    if (scenario.layers.behavioral) {
      const pressure = liquidityPosition(state, debtor).shortfall;
      const confidenceLoss =
        capitalPosition(debtor).buffer < 0
          ? 1
          : pressure /
            Math.max(1, debtor.balanceSheet.assets.reserves + pressure);
      const risk = creditor.behavior.riskAversion;
      if (confidenceLoss > scenario.behavior.confidenceThreshold) {
        const fraction = clamp(
          (scenario.behavior.withdrawalAcceleration *
            (creditor.behavior.withdrawalElasticity +
              creditor.behavior.herding * confidenceLoss +
              risk) *
            scenario.stepHours *
            e.fundingDependency) /
            24,
        );
        withdrawFunding(
          state,
          e,
          e.principal * fraction,
          evidencePaths(
            state,
            "behavior.withdrawalAcceleration",
            "behavior.confidenceThreshold",
            `exposures.${state.exposures.findIndex((candidate) => candidate === e)}.fundingDependency`,
          ),
        );
      }
    }
  }
}
export function propagateRound(state: SystemicState, scenario: Scenario): void {
  if (scenario.layers["market-price"]) processMargins(state);
  for (const e of state.exposures) {
    e.securedAmount = securedExposureValue(state, e);
  }
  if (scenario.layers.counterparty)
    for (const a of state.actors)
      if (capitalPosition(a).state === "INSOLVENT" && a.type !== "central-bank")
        resolveCounterparty(state, a.id);
  if (scenario.policy.allowAssetSales && scenario.layers["market-price"]) {
    for (const a of state.actors) {
      if (a.resolved || a.outageUntil > state.hour || a.type === "central-bank")
        continue;
      const shortfall = liquidityPosition(state, a).shortfall;
      if (shortfall <= TOLERANCE) continue;
      let needed = shortfall;
      for (const m of [...state.markets].sort(
        (left, right) => left.liquidityTier - right.liquidityTier,
      )) {
        needed -= fireSale(state, a.id, m.assetClass, needed);
        if (needed <= TOLERANCE) break;
      }
    }
  }
  if (
    scenario.layers["market-price"] &&
    scenario.behavior.marginHaircutFeedback > 0
  )
    for (const a of state.actors)
      for (const c of a.collateral) {
        const market = state.markets.find((m) => m.assetClass === c.assetClass);
        const original =
          scenario.actors
            .find((x) => x.id === a.id)
            ?.collateral.find((x) => x.id === c.id)?.haircut ?? c.haircut;
        const newHaircut = Math.max(
          c.haircut,
          clamp(
            original +
              (market ? 1 - market.price / market.initialPrice : 0) *
                scenario.behavior.marginHaircutFeedback,
          ),
        );
        if (newHaircut > c.haircut + TOLERANCE) {
          event(state, {
            actorId: a.id,
            mechanism: "endogenous-haircut",
            amount: newHaircut - c.haircut,
            units: "fraction",
            previous: c.haircut,
            next: newHaircut,
            calculation:
              "max(current haircut, initial haircut + price decline × explicit haircut feedback coefficient)",
            evidenceIds: ["behavior.marginHaircutFeedback"],
            edgeId: null,
          });
          c.haircut = newHaircut;
        }
      }
  assertFinancialState(state);
}
