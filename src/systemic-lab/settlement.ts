import { actor, event, liquid, liquidPostings, post, sum } from "./accounting";
import { draw } from "./random";
import { evidencePaths } from "./evidence";
import {
  TOLERANCE,
  type PaymentObligation,
  type Scenario,
  type SystemicState,
} from "./types";
function complete(state: SystemicState, p: PaymentObligation, amount: number) {
  const fraction = amount / p.remaining;
  for (const release of p.releasePledges) {
    const lot = actor(state, release.actorId).collateral.find(
      (c) => c.id === release.lotId,
    )!;
    const released = release.quantity * fraction;
    lot.pledges[release.contractId] = Math.max(
      0,
      (lot.pledges[release.contractId] ?? 0) - released,
    );
    release.quantity -= released;
  }
  p.remaining = Math.max(0, p.remaining - amount);
  p.settled += amount;
  if (p.remaining <= TOLERANCE) {
    p.status = "SETTLED";
    p.settledHour = state.hour;
  }
}
export class SettlementNetwork {
  static settle(
    state: SystemicState,
    config: Scenario["settlement"],
    seed: number,
    routing: Scenario["policy"]["routing"] = "fifo",
    stepBudget?: Map<string, number>,
  ): number {
    const eligible = (p: PaymentObligation) =>
      p.status === "QUEUED" &&
      p.dueHour <= state.hour &&
      p.deadlineHour >= state.hour &&
      ![actor(state, p.from), actor(state, p.to)].some(
        (a) => a.resolved || a.outageUntil > state.hour,
      ) &&
      draw(seed, "settlement", p.id, state.hour) < config.reliability;
    const due = state.payments.filter(eligible);
    // Matching prioritizes payments that release queued recipients. Genesis has the same information and budget.
    const outgoing = (id: string) =>
      sum(due.filter((p) => p.from === id).map((p) => p.remaining));
    due.sort(
      (a, b) =>
        a.priority - b.priority ||
        (routing === "fifo"
          ? a.dueHour - b.dueHour
          : outgoing(b.to) - outgoing(a.to)) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const openingLiquidity =
      stepBudget ?? new Map(state.actors.map((a) => [a.id, liquid(a)]));
    const budget = (id: string) =>
      config.liquidityRecycling
        ? liquid(actor(state, id))
        : Math.min(openingLiquidity.get(id)!, liquid(actor(state, id)));
    let settled = 0;
    if (config.mode === "bilateral-netting") {
      for (let i = 0; i < due.length; i++)
        for (let j = i + 1; j < due.length; j++) {
          const a = due[i],
            b = due[j];
          if (a.from !== b.to || a.to !== b.from) continue;
          const amount = Math.min(a.remaining, b.remaining);
          if (amount <= TOLERANCE) continue;
          post(
            state,
            [
              { actorId: a.from, account: "paymentPayables", delta: -amount },
              {
                actorId: a.from,
                account: "paymentReceivables",
                delta: -amount,
              },
              { actorId: a.to, account: "paymentPayables", delta: -amount },
              { actorId: a.to, account: "paymentReceivables", delta: -amount },
            ],
            {
              actorId: a.from,
              mechanism: "bilateral-netting",
              amount: amount * 2,
              units: "USD million",
              previous: a.remaining + b.remaining,
              next: a.remaining + b.remaining - 2 * amount,
              calculation: `Reciprocal due claims ${a.id} and ${b.id} cancelled by equal amount; no reserves issued.`,
              evidenceIds: [],
              edgeId: `${a.id}|${b.id}`,
            },
          );
          complete(state, a, amount);
          complete(state, b, amount);
          settled += amount * 2;
        }
    }
    // At most one completion per payment. Rescanning permits same-hour recycling, never stochastic retries.
    for (let pass = 0; pass < due.length; pass++) {
      let progress = false;
      for (const p of due) {
        if (p.status !== "QUEUED" || p.remaining > budget(p.from) + TOLERANCE)
          continue;
        const amount = p.remaining,
          payer = actor(state, p.from);
        if (amount <= TOLERANCE) {
          complete(state, p, 0);
          continue;
        }
        const before = liquid(payer);
        post(
          state,
          [
            ...liquidPostings(payer, amount),
            { actorId: p.from, account: "paymentPayables", delta: -amount },
            { actorId: p.to, account: "reserves", delta: amount },
            { actorId: p.to, account: "paymentReceivables", delta: -amount },
          ],
          {
            actorId: p.from,
            mechanism: "gross-settlement",
            amount,
            units: "USD million",
            previous: before,
            next: before - amount,
            calculation: `${p.id}: debit payable, credit liquidity; receiver debits liquidity, credits receivable. Delay ${state.hour - p.dueHour} hours.`,
            evidenceIds: evidencePaths(state, "settlement.reliability"),
            edgeId: p.id,
          },
        );
        openingLiquidity.set(p.from, openingLiquidity.get(p.from)! - amount);
        complete(state, p, amount);
        settled += amount;
        progress = true;
      }
      if (!progress || !config.liquidityRecycling) break;
    }
    for (const p of state.payments)
      if (p.status === "QUEUED" && state.hour >= p.deadlineHour) {
        p.status = "FAILED";
        event(state, {
          actorId: p.from,
          mechanism: "settlement-failure",
          amount: p.remaining,
          units: "USD million",
          previous: "QUEUED",
          next: "FAILED",
          calculation:
            "Deadline elapsed; unsettled payable/receivable remains on both balance sheets.",
          evidenceIds: evidencePaths(state, "settlement.reliability"),
          edgeId: p.id,
        });
      }
    return settled;
  }
}
