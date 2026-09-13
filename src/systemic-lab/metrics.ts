import { capitalPosition, liquidityPosition, sum } from "./accounting";
import { CollateralEngine } from "./collateral";
import { FinancialExposureGraph } from "./network";
import type { SystemicMetrics, SystemicState } from "./types";
export function measure(
  state: SystemicState,
  initialEquity: number,
  initialLiquidity: number,
): SystemicMetrics {
  const institutions = state.actors.filter(
    (a) =>
      !["central-bank", "deposit-sector", "settlement-utility"].includes(
        a.type,
      ),
  );
  const capital = institutions.map(capitalPosition),
    liquidity = institutions.map((a) => liquidityPosition(state, a));
  const collateral = institutions.map((a) => CollateralEngine.inspect(a));
  const due = state.payments.filter((p) => p.dueHour <= state.hour);
  const totalDue = sum(due.map((p) => p.amount)),
    settled = sum(due.map((p) => p.settled));
  const completed = due.filter((p) => p.settledHour !== null);
  const facilityUsage = sum(
    state.facilityLoans
      .filter((l) => l.status === "ACTIVE" || l.status === "DEFAULTED")
      .map((l) => l.amount),
  );
  const capacity = sum(state.facilities.map((f) => f.capacity));
  const graph = new FinancialExposureGraph(state.exposures).metrics(
    state.actors.map((a) => a.id),
  );
  const shortfalls = liquidity.map((l) => l.shortfall),
    totalShortfall = sum(shortfalls);
  const gini =
    totalShortfall > 0
      ? sum(shortfalls.flatMap((x) => shortfalls.map((y) => Math.abs(x - y)))) /
        (2 * shortfalls.length * totalShortfall)
      : 0;
  const equity = sum(institutions.map((a) => a.balanceSheet.equity));
  const affected = state.events.filter((e) =>
    [
      "counterparty-write-down",
      "funding-withdrawal",
      "settlement-failure",
      "margin-obligation",
    ].includes(e.mechanism),
  );
  return {
    liquidityShortfall: totalShortfall,
    impairedInstitutions: capital.filter((c) => c.state !== "SOLVENT").length,
    insolventInstitutions: capital.filter((c) =>
      ["INSOLVENT", "RESOLVED"].includes(c.state),
    ).length,
    equity,
    capitalImpairment: Math.max(0, initialEquity - equity),
    queuedPayments: sum(
      due.filter((p) => p.status === "QUEUED").map((p) => p.remaining),
    ),
    failedSettlementValue: sum(
      due
        .filter((p) => p.status === "FAILED")
        .map((p) => p.remaining + p.writtenOff),
    ),
    settlementCompletion: totalDue ? settled / totalDue : 1,
    averageSettlementDelayHours: completed.length
      ? sum(completed.map((p) => (p.settledHour! - p.dueHour) * p.amount)) /
        sum(completed.map((p) => p.amount))
      : null,
    peakIntradayLiquidityNeed: totalShortfall,
    liquidityRecyclingRatio:
      initialLiquidity + state.cumulativeFacilityDraws > 0
        ? settled / (initialLiquidity + state.cumulativeFacilityDraws)
        : null,
    networkCongestion: totalDue ? (totalDue - settled) / totalDue : 0,
    collateralAvailable: sum(collateral.map((c) => c.available)),
    collateralPledged: sum(collateral.map((c) => c.pledged)),
    collateralExhaustion: collateral.filter(
      (c) => c.total > 0 && c.borrowingCapacity < 1e-7,
    ).length,
    assetSales: state.cumulativeSales,
    priceDislocation: Math.max(
      0,
      ...state.markets.map((m) => 1 - m.price / m.initialPrice),
    ),
    facilityUsage,
    facilityUtilization: capacity ? facilityUsage / capacity : 0,
    counterpartyHHI: graph.counterpartyHHI,
    fundingHHI: graph.fundingHHI,
    criticalNodeDependency: graph.criticalNodeDependency,
    interconnectedness: graph.interconnectedness,
    cascadeBreadth: new Set(affected.map((e) => e.actorId)).size,
    cascadeDepth: Math.max(0, ...affected.map((e) => e.round)),
    systemicLossProxy: state.cumulativeLoss,
    physicalShortfall: Math.max(
      0,
      state.physical.demand - state.physical.capacity,
    ),
    distributionalShortfall: gini,
  };
}
