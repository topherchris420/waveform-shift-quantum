import {
  ASSET_ACCOUNTS,
  LIABILITY_ACCOUNTS,
  TOLERANCE,
  type Account,
  type BalanceSheet,
  type CapitalPosition,
  type FinancialInstitution,
  type LiquidityPosition,
  type Posting,
  type SystemicEvent,
  type SystemicState,
} from "./types";
export const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
export const clamp = (value: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, value));
export function emptyBalanceSheet(): BalanceSheet {
  return {
    assets: Object.fromEntries(
      ASSET_ACCOUNTS.map((a) => [a, 0]),
    ) as BalanceSheet["assets"],
    liabilities: Object.fromEntries(
      LIABILITY_ACCOUNTS.map((a) => [a, 0]),
    ) as BalanceSheet["liabilities"],
    equity: 0,
  };
}
export const assets = (bs: BalanceSheet) => sum(Object.values(bs.assets));
export const liabilities = (bs: BalanceSheet) =>
  sum(Object.values(bs.liabilities));
export function assertBalanceSheet(bs: BalanceSheet, name = ""): void {
  for (const value of [
    ...Object.values(bs.assets),
    ...Object.values(bs.liabilities),
  ]) {
    if (!Number.isFinite(value) || value < -TOLERANCE)
      throw new Error(`${name}: invalid or negative account`);
  }
  const residual = assets(bs) - liabilities(bs) - bs.equity;
  if (
    !Number.isFinite(bs.equity) ||
    Math.abs(residual) > TOLERANCE + 1e-12 * assets(bs)
  )
    throw new Error(`${name}: accounting identity residual ${residual}`);
}
export function actor(
  state: Pick<SystemicState, "actors">,
  id: string,
): FinancialInstitution {
  const found = state.actors.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown actor: ${id}`);
  return found;
}
export function balance(bs: BalanceSheet, account: Account): number {
  return account === "equity"
    ? bs.equity
    : account in bs.assets
      ? bs.assets[account as keyof BalanceSheet["assets"]]
      : bs.liabilities[account as keyof BalanceSheet["liabilities"]];
}
function change(bs: BalanceSheet, account: Account, delta: number) {
  if (!Number.isFinite(delta)) throw new Error("Non-finite posting");
  if (account === "equity") bs.equity += delta;
  else if (account in bs.assets)
    bs.assets[account as keyof BalanceSheet["assets"]] += delta;
  else if (account in bs.liabilities)
    bs.liabilities[account as keyof BalanceSheet["liabilities"]] += delta;
  else throw new Error(`Unknown account: ${account}`);
}
/** Validate every participant's full transaction before committing any account. */
export function post(
  state: SystemicState,
  postings: Posting[],
  detail: Omit<SystemicEvent, "id" | "hour" | "round" | "postings">,
): void {
  if (state.events.length >= 200_000)
    throw new Error(
      "Event budget exceeded; shorten the horizon or simplify the network",
    );
  if (
    state.evidence.length &&
    detail.evidenceIds.some(
      (id) => !state.evidence.some((evidence) => evidence.id === id),
    )
  )
    throw new Error("Event references unknown parameter evidence");
  const next = new Map<string, BalanceSheet>();
  for (const p of postings) {
    if (!next.has(p.actorId))
      next.set(
        p.actorId,
        structuredClone(actor(state, p.actorId).balanceSheet),
      );
    change(next.get(p.actorId)!, p.account, p.delta);
  }
  for (const [id, bs] of next) assertBalanceSheet(bs, id);
  const collateralNext = new Map<string, FinancialInstitution["collateral"]>();
  for (const [id, bs] of next) {
    const lots = structuredClone(actor(state, id).collateral);
    for (const account of ["cash", "reserves"] as const) {
      let excess = Math.max(
        0,
        sum(
          lots
            .filter((c) => c.account === account)
            .map((c) => c.quantity * c.price),
        ) - bs.assets[account],
      );
      for (const c of lots.filter((c) => c.account === account)) {
        if (excess <= TOLERANCE) break;
        const free = Math.max(0, c.quantity - sum(Object.values(c.pledges))),
          used = Math.min(free, excess / c.price);
        c.quantity -= used;
        excess -= used * c.price;
      }
      if (excess > TOLERANCE)
        throw new Error(`${id}: transaction would spend encumbered cash`);
    }
    collateralNext.set(id, lots);
  }
  for (const [id, bs] of next) {
    const a = actor(state, id);
    a.balanceSheet = bs;
    // Preserve references held by facility/market routines; only cash inventory quantities change here.
    for (let i = 0; i < a.collateral.length; i++)
      if (["cash", "reserves"].includes(a.collateral[i].account))
        a.collateral[i].quantity = collateralNext.get(id)![i].quantity;
  }
  event(state, { ...detail, postings });
}
export function event(
  state: SystemicState,
  detail: Omit<SystemicEvent, "id" | "hour" | "round" | "postings"> & {
    postings?: Posting[];
  },
): void {
  if (state.events.length >= 200_000)
    throw new Error(
      "Event budget exceeded; shorten the horizon or simplify the network",
    );
  if (!Number.isFinite(detail.amount)) throw new Error("Non-finite event");
  if (
    state.evidence.length &&
    detail.evidenceIds.some(
      (id) => !state.evidence.some((evidence) => evidence.id === id),
    )
  )
    throw new Error("Event references unknown parameter evidence");
  state.events.push({
    ...detail,
    id: `e${state.events.length}`,
    hour: state.hour,
    round: state.round,
    postings: detail.postings ?? [],
  });
}
export function liquid(a: FinancialInstitution): number {
  const encumberedCash = sum(
    a.collateral
      .filter((c) => c.account === "cash" || c.account === "reserves")
      .map((c) => sum(Object.values(c.pledges)) * c.price),
  );
  return Math.max(
    0,
    a.balanceSheet.assets.cash +
      a.balanceSheet.assets.reserves -
      encumberedCash,
  );
}
export function liquidityPosition(
  state: SystemicState,
  a: FinancialInstitution,
): LiquidityPosition {
  const due = sum(
    state.payments
      .filter(
        (p) =>
          p.from === a.id && p.status !== "SETTLED" && p.dueHour <= state.hour,
      )
      .map((p) => p.remaining),
  );
  const marginDue = sum(
    state.margins
      .filter((m) => m.payer === a.id)
      .map((m) => Math.max(0, m.initialMargin - m.postedInitialMargin)),
  );
  const available = liquid(a);
  const support = a.balanceSheet.liabilities.centralBankBorrowing > TOLERANCE;
  return {
    available,
    due,
    shortfall: Math.max(0, due + marginDue + a.liquidityBuffer - available),
    state:
      a.resolved || a.outageUntil > state.hour
        ? "SETTLEMENT_SUSPENDED"
        : due + marginDue > available + TOLERANCE
          ? "ILLIQUID"
          : support
            ? "FACILITY_DEPENDENT"
            : "ADEQUATE",
  };
}
export function capitalPosition(a: FinancialInstitution): CapitalPosition {
  const total = assets(a.balanceSheet),
    equity = a.balanceSheet.equity;
  const rwa =
    (total - a.balanceSheet.assets.cash - a.balanceSheet.assets.reserves) *
    a.riskWeight;
  return {
    classification: "SIMULATION_CAPITAL_PROXY",
    equity,
    equityAssets: total ? equity / total : 0,
    leverage: equity > 0 ? total / equity : null,
    rwa,
    cet1Proxy: rwa > 0 ? equity / rwa : null,
    buffer: equity - total * a.capitalFloor,
    state: a.resolved
      ? "RESOLVED"
      : equity < -TOLERANCE
        ? "INSOLVENT"
        : equity < total * a.capitalFloor
          ? "CAPITAL_IMPAIRED"
          : "SOLVENT",
  };
}
/** Reserve/cash reclassification for settlement; does not issue new liquidity. */
export function liquidPostings(
  a: FinancialInstitution,
  amount: number,
): Posting[] {
  if (amount < 0 || amount > liquid(a) + TOLERANCE)
    throw new Error("Insufficient unencumbered liquidity");
  const pledgedReserves = sum(
    a.collateral
      .filter((c) => c.account === "reserves")
      .map((c) => sum(Object.values(c.pledges)) * c.price),
  );
  const reserveUse = Math.min(
    amount,
    Math.max(0, a.balanceSheet.assets.reserves - pledgedReserves),
  );
  return [
    { actorId: a.id, account: "reserves", delta: -reserveUse },
    { actorId: a.id, account: "cash", delta: -(amount - reserveUse) },
  ];
}
