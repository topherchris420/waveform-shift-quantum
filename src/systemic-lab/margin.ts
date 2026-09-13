import { actor, event, liquid, liquidPostings, post, sum } from "./accounting";
import { availableQuantity } from "./collateral";
import { evidencePaths } from "./evidence";
import { createPayment } from "./network";
import { TOLERANCE, type MarginAgreement, type SystemicState } from "./types";
/** Synthetic bilateral VM: a decline charges the configured long side; increases reverse it. */
export function variationMargin(
  agreement: MarginAgreement,
  currentPrice: number,
): number {
  return (
    agreement.notional *
    (agreement.lastPrice - currentPrice) *
    agreement.sensitivity
  );
}
export function processMargins(state: SystemicState): void {
  for (const m of state.margins) {
    const payer = actor(state, m.payer),
      receiver = actor(state, m.receiver);
    if (payer.resolved || receiver.resolved || state.hour < m.nextHour)
      continue;
    const marginRoot = `margins.${state.margins.findIndex((candidate) => candidate === m)}`;
    const marginEvidence = evidencePaths(
      state,
      `${marginRoot}.notional`,
      `${marginRoot}.initialMargin`,
      `${marginRoot}.threshold`,
      `${marginRoot}.frequencyHours`,
      `${marginRoot}.sensitivity`,
    );
    const contract = `im-securities:${m.id}`;
    const cashPosted = sum(
      receiver.collateral
        .filter((c) => c.assetClass === "cash")
        .map((c) => (c.pledges[`margin:${m.id}`] ?? 0) * c.price),
    );
    const securitiesPosted = () =>
      sum(
        payer.collateral.map(
          (c) =>
            (c.pledges[contract] ?? 0) *
            c.price *
            (1 - c.haircut) *
            (1 - c.valuationUncertainty),
        ),
      );
    m.postedInitialMargin = cashPosted + securitiesPosted();
    if (m.collateralSubstitution) {
      for (const lot of payer.collateral.filter(
        (c) => c.assetClass !== "cash",
      )) {
        const unitValue =
          lot.price * (1 - lot.haircut) * (1 - lot.valuationUncertainty);
        const needed = Math.max(0, m.initialMargin - m.postedInitialMargin);
        if (needed <= TOLERANCE) break;
        if (unitValue <= TOLERANCE) continue;
        const quantity = Math.min(availableQuantity(lot), needed / unitValue);
        if (quantity <= TOLERANCE) continue;
        lot.pledges[contract] = (lot.pledges[contract] ?? 0) + quantity;
        const value = quantity * unitValue;
        event(state, {
          actorId: payer.id,
          mechanism: "initial-margin-substitution",
          amount: value,
          units: "USD million",
          previous: m.postedInitialMargin,
          next: m.postedInitialMargin + value,
          calculation: `${lot.id}: retained-custody securities pledge valued after haircut and uncertainty. No cash transfer or income; encumbered units cannot be sold or pledged again.`,
          evidenceIds: marginEvidence,
          edgeId: m.id,
        });
        m.postedInitialMargin += value;
      }
    }
    const initialDue = Math.max(0, m.initialMargin - m.postedInitialMargin);
    // IM is returnable collateral, not expense; CCP records the return obligation.
    const cash = Math.min(initialDue, liquid(payer));
    if (cash > TOLERANCE) {
      post(
        state,
        [
          ...liquidPostings(payer, cash),
          { actorId: payer.id, account: "derivativesCollateral", delta: cash },
          { actorId: receiver.id, account: "reserves", delta: cash },
          {
            actorId: receiver.id,
            account: "marginCollateralLiability",
            delta: cash,
          },
        ],
        {
          actorId: payer.id,
          mechanism: "initial-margin",
          amount: cash,
          units: "USD million",
          previous: m.postedInitialMargin,
          next: m.postedInitialMargin + cash,
          calculation:
            "Cash becomes a returnable initial-margin claim; receiver books collateral return liability.",
          evidenceIds: marginEvidence,
          edgeId: m.id,
        },
      );
      m.postedInitialMargin += cash;
      receiver.collateral.push({
        id: `im:${m.id}:${state.events.length}`,
        assetClass: "cash",
        account: "reserves",
        quantity: cash,
        price: 1,
        haircut: 0,
        liquidityClass: 1,
        eligibleFacilities: [],
        valuationUncertainty: 0,
        maturityHours: 24,
        durationYears: 0,
        priceSensitivity: 0,
        pledges: { [`margin:${m.id}`]: cash },
      });
    }
    const price = state.markets.find(
      (x) => x.assetClass === m.assetClass,
    )?.price;
    if (price === undefined)
      throw new Error(`Missing margin reference market ${m.assetClass}`);
    const vm = variationMargin(m, price);
    if (Math.abs(vm) > m.threshold + TOLERANCE) {
      const from = vm > 0 ? m.payer : m.receiver,
        to = vm > 0 ? m.receiver : m.payer;
      // Full VM above a transfer threshold; threshold is not a deductible.
      createPayment(
        state,
        {
          id: `vm:${m.id}:${state.events.length}`,
          from,
          to,
          amount: Math.abs(vm),
          dueHour: state.hour,
          deadlineHour: state.hour + m.frequencyHours,
          priority: 0,
          kind: "margin",
        },
        marginEvidence,
      );
      m.lastPrice = price;
    }
    // Keep the reference unchanged below threshold, so small movements accumulate.
    m.nextHour = state.hour + m.frequencyHours;
  }
}
