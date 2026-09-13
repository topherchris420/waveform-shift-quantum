import { clamp, sum } from "./accounting";
import {
  TOLERANCE,
  type CentralBankFacility,
  type CollateralItem,
  type FinancialInstitution,
} from "./types";
export const pledgedQuantity = (c: CollateralItem) =>
  sum(Object.values(c.pledges));
export const availableQuantity = (c: CollateralItem) =>
  Math.max(0, c.quantity - pledgedQuantity(c));
export function collateralUnitValue(
  c: CollateralItem,
  facility?: CentralBankFacility,
  hour = 0,
): number {
  if (
    facility &&
    (c.maturityHours <= hour ||
      !facility.eligibleCollateral.includes(c.assetClass) ||
      !c.eligibleFacilities.includes(facility.id))
  )
    return 0;
  const haircut = Math.max(
    c.haircut,
    facility?.haircutSchedule[c.assetClass] ?? 0,
  );
  return c.price * (1 - clamp(haircut)) * (1 - clamp(c.valuationUncertainty));
}
export class CollateralEngine {
  static inspect(
    a: FinancialInstitution,
    facility?: CentralBankFacility,
    hour = 0,
  ) {
    const total = sum(a.collateral.map((c) => c.quantity * c.price));
    const available = sum(
      a.collateral.map((c) => availableQuantity(c) * c.price),
    );
    const capacity = sum(
      a.collateral.map(
        (c) => availableQuantity(c) * collateralUnitValue(c, facility, hour),
      ),
    );
    const classes = new Map<string, number>();
    for (const c of a.collateral)
      classes.set(
        c.assetClass,
        (classes.get(c.assetClass) ?? 0) + c.quantity * c.price,
      );
    return {
      total,
      available,
      pledged: total - available,
      borrowingCapacity: capacity,
      exhaustionPoint: capacity,
      concentration: total
        ? sum([...classes.values()].map((v) => (v / total) ** 2))
        : 0,
    };
  }
  static pledge(
    a: FinancialInstitution,
    facility: CentralBankFacility,
    loanId: string,
    amount: number,
    hour = 0,
  ): { lotId: string; quantity: number }[] {
    if (!(amount >= 0) || !Number.isFinite(amount))
      throw new Error("Invalid pledge amount");
    if (this.inspect(a, facility, hour).borrowingCapacity + TOLERANCE < amount)
      throw new Error("Insufficient eligible collateral");
    let remaining = amount;
    const result: { lotId: string; quantity: number }[] = [];
    for (const c of [...a.collateral].sort(
      (left, right) => left.liquidityClass - right.liquidityClass,
    )) {
      const unit = collateralUnitValue(c, facility, hour);
      if (unit <= 0 || remaining <= TOLERANCE) continue;
      const quantity = Math.min(availableQuantity(c), remaining / unit);
      if (quantity > 0) result.push({ lotId: c.id, quantity });
      remaining -= quantity * unit;
    }
    for (const p of result) {
      const lot = a.collateral.find((c) => c.id === p.lotId)!;
      lot.pledges[loanId] = (lot.pledges[loanId] ?? 0) + p.quantity;
    }
    return result;
  }
  static release(a: FinancialInstitution, contract: string): void {
    for (const c of a.collateral) delete c.pledges[contract];
  }
  static assertInventory(a: FinancialInstitution): void {
    for (const c of a.collateral) {
      if (
        pledgedQuantity(c) > c.quantity + TOLERANCE ||
        c.quantity < 0 ||
        c.price < 0 ||
        !Number.isFinite(c.quantity * c.price)
      )
        throw new Error(`${a.id}: invalid collateral ${c.id}`);
    }
    for (const account of [
      "cash",
      "reserves",
      "securities",
      "loans",
    ] as const) {
      const inventory = sum(
        a.collateral
          .filter((c) => c.account === account)
          .map((c) => c.quantity * c.price),
      );
      if (inventory > a.balanceSheet.assets[account] + TOLERANCE)
        throw new Error(`${a.id}: collateral exceeds ${account} assets`);
    }
  }
}
