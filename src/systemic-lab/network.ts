import {
  actor,
  assertBalanceSheet,
  capitalPosition,
  clamp,
  event,
  liquid,
  liquidPostings,
  liquidityPosition,
  post,
  sum,
} from "./accounting";
import { CollateralEngine } from "./collateral";
import { evidencePaths } from "./evidence";
import {
  TOLERANCE,
  type CounterpartyExposure,
  type PaymentObligation,
  type SystemicState,
} from "./types";
export class FinancialExposureGraph {
  constructor(readonly edges: CounterpartyExposure[]) {}
  counterparties(id: string) {
    return this.edges.filter((e) => e.creditor === id || e.debtor === id);
  }
  metrics(actorIds: string[]) {
    const total = sum(this.edges.map((e) => e.principal));
    const byCreditor = actorIds.map((id) =>
      sum(this.edges.filter((e) => e.creditor === id).map((e) => e.principal)),
    );
    const byDebtor = actorIds.map((id) =>
      sum(this.edges.filter((e) => e.debtor === id).map((e) => e.principal)),
    );
    const hhi = (v: number[]) =>
      total > 0 ? sum(v.map((x) => (x / total) ** 2)) : 0;
    const pairNet = new Map<string, number>();
    const activePairs = new Set<string>();
    for (const edge of this.edges) {
      const forward = edge.creditor < edge.debtor;
      const key = JSON.stringify([edge.creditor, edge.debtor].sort());
      pairNet.set(
        key,
        (pairNet.get(key) ?? 0) + edge.principal * (forward ? 1 : -1),
      );
      if (edge.principal > TOLERANCE)
        activePairs.add(JSON.stringify([edge.creditor, edge.debtor]));
    }
    return {
      grossExposure: total,
      netExposure: sum([...pairNet.values()].map(Math.abs)),
      securedAmount: sum(
        this.edges.map((e) => Math.min(e.principal, e.securedAmount)),
      ),
      counterpartyHHI: hhi(byCreditor),
      fundingHHI: hhi(byDebtor),
      criticalNodeDependency: total
        ? Math.max(0, ...byCreditor, ...byDebtor) / total
        : 0,
      interconnectedness:
        actorIds.length > 1
          ? activePairs.size / (actorIds.length * (actorIds.length - 1))
          : 0,
      weightedDegree: Object.fromEntries(
        actorIds.map((id, i) => [id, byCreditor[i] + byDebtor[i]]),
      ),
    };
  }
}
/** Book a new operating obligation. It is an expense/payable and income/receivable. */
export function createPayment(
  state: SystemicState,
  input: Pick<
    PaymentObligation,
    | "id"
    | "from"
    | "to"
    | "amount"
    | "dueHour"
    | "deadlineHour"
    | "priority"
    | "kind"
  >,
  evidenceIds: string[] = [],
): PaymentObligation {
  if (state.payments.length >= 20_000)
    throw new Error(
      "Payment budget exceeded; shorten the horizon or simplify the network",
    );
  if (
    input.from === input.to ||
    !Number.isFinite(input.amount) ||
    input.amount < 0 ||
    input.dueHour < state.hour ||
    input.deadlineHour < input.dueHour ||
    state.payments.some((p) => p.id === input.id)
  )
    throw new Error("Invalid payment");
  const payment: PaymentObligation = {
    ...input,
    remaining: input.amount,
    settled: 0,
    writtenOff: 0,
    lossGivenDefault: 0.5,
    status: "QUEUED",
    settledHour: null,
    createdHour: state.hour,
    releasePledges: [],
  };
  post(
    state,
    [
      { actorId: input.from, account: "paymentPayables", delta: input.amount },
      { actorId: input.from, account: "equity", delta: -input.amount },
      { actorId: input.to, account: "paymentReceivables", delta: input.amount },
      { actorId: input.to, account: "equity", delta: input.amount },
    ],
    {
      actorId: input.from,
      mechanism: `${input.kind}-obligation`,
      amount: input.amount,
      units: "USD million",
      previous: 0,
      next: input.amount,
      calculation:
        "Debit payer expense; credit payable. Debit payee receivable; credit income.",
      evidenceIds,
      edgeId: input.id,
    },
  );
  state.payments.push(payment);
  return payment;
}
/** Reclassify a contractual claim, without inventing an expense or destroying wealth. */
export function withdrawFunding(
  state: SystemicState,
  e: CounterpartyExposure,
  requested: number,
  evidenceIds: string[] = [],
): number {
  if (state.payments.length >= 20_000)
    throw new Error(
      "Payment budget exceeded; shorten the horizon or simplify the network",
    );
  if (!Number.isFinite(requested) || requested < 0)
    throw new Error("Invalid withdrawal");
  const debtor = actor(state, e.debtor),
    creditor = actor(state, e.creditor);
  if (
    e.transferRestricted ||
    e.principal <= TOLERANCE ||
    debtor.resolved ||
    creditor.resolved
  )
    return 0;
  const amount = Math.min(requested, e.principal, e.transferLimit);
  if (amount <= TOLERANCE) return 0;
  const proportion = amount / e.principal;
  const releasePledges = debtor.collateral.flatMap((lot) => {
    const pending = sum(
      state.payments
        .flatMap((p) => p.releasePledges)
        .filter(
          (p) =>
            p.actorId === debtor.id &&
            p.lotId === lot.id &&
            p.contractId === `edge:${e.id}`,
        )
        .map((p) => p.quantity),
    );
    const quantity =
      Math.max(0, (lot.pledges[`edge:${e.id}`] ?? 0) - pending) * proportion;
    return quantity > 0
      ? [
          {
            actorId: debtor.id,
            lotId: lot.id,
            contractId: `edge:${e.id}`,
            quantity,
          },
        ]
      : [];
  });
  const id = `withdrawal:${e.id}:${state.events.length}`;
  post(
    state,
    [
      { actorId: e.debtor, account: e.debtorAccount, delta: -amount },
      { actorId: e.debtor, account: "paymentPayables", delta: amount },
      { actorId: e.creditor, account: e.creditorAccount, delta: -amount },
      { actorId: e.creditor, account: "paymentReceivables", delta: amount },
    ],
    {
      actorId: e.debtor,
      mechanism: "funding-withdrawal",
      amount,
      units: "USD million",
      previous: e.principal,
      next: e.principal - amount,
      calculation:
        "Contractual funding claim becomes an immediately due payment; equity is unchanged.",
      evidenceIds,
      edgeId: e.id,
    },
  );
  e.principal -= amount;
  e.securedAmount *= 1 - proportion;
  state.payments.push({
    id,
    from: e.debtor,
    to: e.creditor,
    amount,
    remaining: amount,
    settled: 0,
    writtenOff: 0,
    lossGivenDefault: e.lossGivenDefault,
    createdHour: state.hour,
    dueHour: state.hour,
    deadlineHour: state.hour + 24,
    priority: 1,
    kind: e.kind === "intragroup" ? "intragroup" : "funding-withdrawal",
    status: "QUEUED",
    settledHour: null,
    releasePledges,
  });
  return amount;
}
/** Write down uncollateralized claims once, under an explicit synthetic resolution rule. */
export function resolveCounterparty(
  state: SystemicState,
  debtorId: string,
): void {
  const debtor = actor(state, debtorId);
  if (debtor.resolved) return;
  debtor.resolved = true;
  event(state, {
    actorId: debtorId,
    mechanism: "resolution",
    amount: debtor.balanceSheet.equity,
    units: "USD million",
    previous: "INSOLVENT",
    next: "RESOLVED",
    calculation:
      "Participant is suspended. Unsecured claims take configured LGD; secured residual claims remain frozen (no assumed collateral liquidation).",
    evidenceIds: [],
    edgeId: null,
  });
  for (const e of state.exposures.filter((e) => e.debtor === debtorId)) {
    const loss =
      Math.max(0, e.principal - securedExposureValue(state, e)) *
      e.lossGivenDefault;
    if (loss <= TOLERANCE) continue;
    post(
      state,
      [
        { actorId: e.creditor, account: e.creditorAccount, delta: -loss },
        { actorId: e.creditor, account: "equity", delta: -loss },
        { actorId: e.debtor, account: e.debtorAccount, delta: -loss },
        { actorId: e.debtor, account: "equity", delta: loss },
      ],
      {
        actorId: e.creditor,
        mechanism: "counterparty-write-down",
        amount: loss,
        units: "USD million",
        previous: e.principal,
        next: e.principal - loss,
        calculation: `max(0, principal - secured amount) × LGD (${e.lossGivenDefault}). Debtor liability write-off is resolution income, not a liquidity rescue.`,
        evidenceIds: evidencePaths(
          state,
          `exposures.${state.exposures.findIndex((candidate) => candidate === e)}.lossGivenDefault`,
        ),
        edgeId: e.id,
      },
    );
    e.principal -= loss;
    state.cumulativeLoss += loss;
  }
  for (const p of state.payments.filter(
    (p) => p.from === debtorId && p.remaining > 0,
  )) {
    const secured = sum(
      p.releasePledges.map((pledge) => {
        const lot = debtor.collateral.find((c) => c.id === pledge.lotId)!;
        return (
          pledge.quantity *
          lot.price *
          (1 - lot.haircut) *
          (1 - lot.valuationUncertainty)
        );
      }),
    );
    const loss = Math.max(0, p.remaining - secured) * p.lossGivenDefault;
    post(
      state,
      [
        { actorId: p.to, account: "paymentReceivables", delta: -loss },
        { actorId: p.to, account: "equity", delta: -loss },
        { actorId: p.from, account: "paymentPayables", delta: -loss },
        { actorId: p.from, account: "equity", delta: loss },
      ],
      {
        actorId: p.to,
        mechanism: "payment-claim-write-down",
        amount: loss,
        units: "USD million",
        previous: p.remaining,
        next: p.remaining - loss,
        calculation: `Synthetic resolution: max(0, remaining claim - pledged collateral value) × LGD (${p.lossGivenDefault}). Residual claims stay frozen; no cash is created.`,
        evidenceIds: [],
        edgeId: p.id,
      },
    );
    p.remaining -= loss;
    p.writtenOff += loss;
    p.status = "FAILED";
    state.cumulativeLoss += loss;
  }
}
/** Exclude collateral already reserved for converted withdrawal payment claims. */
export function securedExposureValue(
  state: Pick<SystemicState, "actors" | "payments">,
  e: CounterpartyExposure,
): number {
  const debtor = actor(state, e.debtor);
  return Math.min(
    e.principal,
    sum(
      debtor.collateral
        .filter((c) => e.collateralIds.includes(c.id))
        .map((c) => {
          const pending = sum(
            state.payments
              .flatMap((p) => p.releasePledges)
              .filter(
                (p) =>
                  p.actorId === debtor.id &&
                  p.lotId === c.id &&
                  p.contractId === `edge:${e.id}`,
              )
              .map((p) => p.quantity),
          );
          return (
            Math.max(0, (c.pledges[`edge:${e.id}`] ?? 0) - pending) *
            c.price *
            (1 - c.haircut) *
            (1 - c.valuationUncertainty)
          );
        }),
    ),
  );
}
/** Draw a committed or intragroup line from the lender's existing liquidity. */
export function provideCommittedSupport(
  state: SystemicState,
  e: CounterpartyExposure,
): number {
  if (
    !["intragroup", "committed-liquidity"].includes(e.kind) ||
    e.transferRestricted
  )
    return 0;
  const lender = actor(state, e.creditor),
    borrower = actor(state, e.debtor);
  if (
    [lender, borrower].some(
      (a) =>
        a.resolved || a.outageUntil > state.hour || a.balanceSheet.equity < 0,
    )
  )
    return 0;
  const reserve =
    lender.liquidityBuffer + liquid(lender) * lender.behavior.hoarding;
  const used = sum(
    state.events
      .filter((x) => x.edgeId === e.id && x.mechanism === "committed-support")
      .map((x) => x.amount),
  );
  const amount = Math.min(
    liquidityPosition(state, borrower).shortfall,
    Math.max(0, liquid(lender) - reserve),
    Math.max(0, e.transferLimit - used),
  );
  if (amount <= TOLERANCE) return 0;
  const edgeRoot = `exposures.${state.exposures.findIndex((candidate) => candidate === e)}`;
  const lenderRoot = `actors.${state.actors.findIndex((candidate) => candidate === lender)}`;
  post(
    state,
    [
      ...liquidPostings(lender, amount),
      { actorId: lender.id, account: e.creditorAccount, delta: amount },
      { actorId: borrower.id, account: "reserves", delta: amount },
      { actorId: borrower.id, account: e.debtorAccount, delta: amount },
    ],
    {
      actorId: borrower.id,
      mechanism: "committed-support",
      amount,
      units: "USD million",
      previous: e.principal,
      next: e.principal + amount,
      calculation:
        "Existing lender liquidity becomes a matched funding asset/liability; transfer restrictions, remaining line limit, treasury buffer and hoarding constrain support. No equity or money is created.",
      evidenceIds: evidencePaths(
        state,
        `${edgeRoot}.transferLimit`,
        `${lenderRoot}.liquidityBuffer`,
        `${lenderRoot}.behavior.hoarding`,
      ),
      edgeId: e.id,
    },
  );
  e.principal += amount;
  return amount;
}
export function assertFinancialState(state: SystemicState): void {
  const ids = new Set(state.actors.map((a) => a.id));
  if (ids.size !== state.actors.length) throw new Error("Duplicate actors");
  for (const a of state.actors) {
    assertBalanceSheet(a.balanceSheet, a.id);
    CollateralEngine.assertInventory(a);
    const payable = sum(
      state.payments.filter((p) => p.from === a.id).map((p) => p.remaining),
    );
    const receivable = sum(
      state.payments.filter((p) => p.to === a.id).map((p) => p.remaining),
    );
    if (
      Math.abs(payable - a.balanceSheet.liabilities.paymentPayables) >
        TOLERANCE ||
      Math.abs(receivable - a.balanceSheet.assets.paymentReceivables) >
        TOLERANCE
    )
      throw new Error(`${a.id}: payment claims do not reconcile`);
  }
  for (const e of state.exposures) {
    if (
      !ids.has(e.creditor) ||
      !ids.has(e.debtor) ||
      e.creditor === e.debtor ||
      e.principal < -TOLERANCE
    )
      throw new Error("Invalid exposure edge");
  }
  for (const a of state.actors) {
    for (const account of Object.keys(a.balanceSheet.assets)) {
      const booked = sum(
        state.exposures
          .filter((e) => e.creditor === a.id && e.creditorAccount === account)
          .map((e) => e.principal),
      );
      if (
        booked >
        a.balanceSheet.assets[account as keyof typeof a.balanceSheet.assets] +
          TOLERANCE
      )
        throw new Error(`${a.id}: exposure assets exceed balance sheet`);
    }
    for (const account of Object.keys(a.balanceSheet.liabilities)) {
      const booked = sum(
        state.exposures
          .filter((e) => e.debtor === a.id && e.debtorAccount === account)
          .map((e) => e.principal),
      );
      if (
        booked >
        a.balanceSheet.liabilities[
          account as keyof typeof a.balanceSheet.liabilities
        ] +
          TOLERANCE
      )
        throw new Error(`${a.id}: exposure liabilities exceed balance sheet`);
    }
  }
  for (const p of state.payments) {
    if (
      !ids.has(p.from) ||
      !ids.has(p.to) ||
      p.remaining < -TOLERANCE ||
      Math.abs(p.amount - p.remaining - p.settled - p.writtenOff) > TOLERANCE
    )
      throw new Error("Payment does not reconcile");
  }
}
