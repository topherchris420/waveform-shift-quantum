import { actor, event, liquid, liquidPostings, post, sum } from "./accounting";
import { availableQuantity } from "./collateral";
import { evidencePaths } from "./evidence";
import {
  TOLERANCE,
  type AssetClass,
  type MarketImpactModel,
  type SystemicState,
} from "./types";
/** Exponential inverse demand. Zero volume -> no impact; deeper markets buffer sales. */
export function impactedPrice(
  market: MarketImpactModel,
  saleNotional: number,
): number {
  if (
    !Number.isFinite(saleNotional) ||
    saleNotional < 0 ||
    market.marketDepth <= 0 ||
    market.elasticity < 0
  )
    throw new Error("Invalid impact input");
  return (
    market.price *
    Math.exp((-market.elasticity * saleNotional) / market.marketDepth)
  );
}
export function revalueMarket(
  state: SystemicState,
  assetClass: AssetClass,
  price: number,
  mechanism: string,
  evidenceIds: string[] = [],
): void {
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  const market = state.markets.find((m) => m.assetClass === assetClass);
  if (!market) throw new Error(`Unknown market ${assetClass}`);
  const marketChange = price - market.price;
  for (const a of state.actors) {
    for (const c of a.collateral.filter((c) => c.assetClass === assetClass)) {
      const nextPrice = Math.max(
        0,
        c.price + marketChange * c.priceSensitivity,
      );
      const delta = c.quantity * (nextPrice - c.price);
      if (Math.abs(delta) <= TOLERANCE) {
        c.price = nextPrice;
        continue;
      }
      post(
        state,
        [
          { actorId: a.id, account: c.account, delta },
          { actorId: a.id, account: "equity", delta },
        ],
        {
          actorId: a.id,
          mechanism,
          amount: Math.abs(delta),
          units: "USD million",
          previous: c.quantity * c.price,
          next: c.quantity * nextPrice,
          calculation: `${c.id}: quantity (${c.quantity}) × market price change (${marketChange}) × price sensitivity (${c.priceSensitivity}); fair-value change flows to equity.`,
          evidenceIds,
          edgeId: null,
        },
      );
      c.price = nextPrice;
      if (delta < 0) state.cumulativeLoss -= delta;
    }
  }
  market.price = price;
}
/** Forced sales exchange an existing security for another actor's existing liquidity. */
export function fireSale(
  state: SystemicState,
  sellerId: string,
  assetClass: AssetClass,
  desiredCash: number,
): number {
  if (!Number.isFinite(desiredCash) || desiredCash < 0)
    throw new Error("Invalid sale request");
  const seller = actor(state, sellerId),
    market = state.markets.find((m) => m.assetClass === assetClass);
  if (
    !market ||
    market.price <= 0 ||
    seller.resolved ||
    seller.id === market.liquidityProviderId
  )
    return 0;
  const buyer = actor(state, market.liquidityProviderId);
  if (buyer.resolved || buyer.outageUntil > state.hour) return 0;
  let remaining = desiredCash,
    raised = 0;
  for (const lot of [...seller.collateral]
    .filter(
      (c) =>
        c.assetClass === assetClass &&
        c.account !== "cash" &&
        c.account !== "reserves",
    )
    .sort((left, right) => left.liquidityClass - right.liquidityClass)) {
    const quantity = Math.min(
      availableQuantity(lot),
      remaining / market.price,
      liquid(buyer) / market.price,
    );
    if (quantity <= TOLERANCE) continue;
    const price = impactedPrice(market, quantity * market.price);
    revalueMarket(state, assetClass, price, "fire-sale-mark-to-market");
    const value = quantity * price;
    const bookValue = quantity * lot.price;
    const realized = value - bookValue;
    post(
      state,
      [
        { actorId: sellerId, account: lot.account, delta: -bookValue },
        { actorId: sellerId, account: "reserves", delta: value },
        { actorId: sellerId, account: "equity", delta: realized },
        ...liquidPostings(buyer, value),
        { actorId: buyer.id, account: lot.account, delta: value },
      ],
      {
        actorId: sellerId,
        mechanism: "asset-sale",
        amount: value,
        units: "USD million",
        previous: liquid(seller),
        next: liquid(seller) + value,
        calculation: `${quantity} ${assetClass} units sold at ${price}; book value ${bookValue}, realized P&L ${realized}. P'=P exp(-elasticity × sale / depth), elasticity=${market.elasticity}, depth=${market.marketDepth} USD million; buyer=${buyer.id}.`,
        evidenceIds: evidencePaths(
          state,
          `markets.${state.markets.findIndex((candidate) => candidate === market)}.marketDepth`,
          `markets.${state.markets.findIndex((candidate) => candidate === market)}.elasticity`,
        ),
        edgeId: null,
      },
    );
    lot.quantity -= quantity;
    buyer.collateral.push({
      ...structuredClone(lot),
      id: `${buyer.id}:sale:${state.events.length}`,
      quantity,
      price,
      pledges: {},
    });
    state.cumulativeSales += value;
    if (realized < 0) state.cumulativeLoss -= realized;
    raised += value;
    remaining -= value;
    if (remaining <= TOLERANCE) break;
  }
  return raised;
}
