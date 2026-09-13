import { describe, it, expect } from "vitest";
import {
  fireSale,
  impactedPrice,
  revalueMarket,
} from "../../systemic-lab/market";
import { processMargins, variationMargin } from "../../systemic-lab/margin";
import { assertFinancialState } from "../../systemic-lab/network";
import { sum, liquid, liquidityPosition } from "../../systemic-lab/accounting";
import { institution, stateOf } from "./fixtures";
const market = {
  liquidityProviderId: "buyer",
  assetClass: "treasury" as const,
  price: 1,
  initialPrice: 1,
  marketDepth: 500,
  elasticity: 0.5,
  volatility: 0,
  liquidityTier: 1 as const,
};
describe("Transparent fire-sale and margin feedback", () => {
  it("zero sale has zero impact, larger volume never raises prices", () => {
    expect(impactedPrice(market, 0)).toBe(1);
    let previous = 1;
    for (let sale = 0; sale <= 1000; sale += 10) {
      const p = impactedPrice(market, sale);
      expect(p).toBeLessThanOrEqual(previous);
      previous = p;
    }
  });
  it("applies each collateral lot's declared market-price sensitivity", () => {
    const seller = institution("seller"),
      buyer = institution("buyer"),
      state = stateOf([seller, buyer]);
    seller.collateral[0].priceSensitivity = 0;
    state.markets = [structuredClone(market)];
    const sellerBefore = structuredClone(seller.balanceSheet);
    revalueMarket(state, "treasury", 0.8, "sensitivity-test");
    expect(seller.collateral[0].price).toBe(1);
    expect(seller.balanceSheet).toEqual(sellerBefore);
    expect(buyer.collateral[0].price).toBeCloseTo(0.8);
    expect(buyer.balanceSheet.equity).toBeCloseTo(0);
    assertFinancialState(state);
  });
  it("sales consume buyer cash and preserve securities quantity", () => {
    const state = stateOf([institution("seller"), institution("buyer")]);
    state.markets = [market];
    const cash = sum(state.actors.map(liquid)),
      quantity = sum(
        state.actors.flatMap((a) => a.collateral).map((c) => c.quantity),
      );
    const raised = fireSale(state, "seller", "treasury", 10);
    expect(raised).toBeGreaterThan(0);
    expect(sum(state.actors.map(liquid))).toBeCloseTo(cash);
    expect(
      sum(state.actors.flatMap((a) => a.collateral).map((c) => c.quantity)),
    ).toBeCloseTo(quantity);
    expect(state.actors[1].balanceSheet.equity).toBeLessThan(20);
    assertFinancialState(state);
  });
  it("pledged securities cannot be sold", () => {
    const state = stateOf([institution("seller"), institution("buyer")]);
    state.markets = [market];
    state.actors[0].collateral[0].pledges.loan = 100;
    expect(fireSale(state, "seller", "treasury", 30)).toBe(0);
    assertFinancialState(state);
  });
  it("variation margin is a claim with explicit counterparty income/expense", () => {
    const state = stateOf([institution("seller"), institution("buyer")]);
    state.markets = [structuredClone(market)];
    const m = {
      id: "m",
      payer: "seller",
      receiver: "buyer",
      assetClass: "treasury" as const,
      notional: 100,
      initialMargin: 0,
      postedInitialMargin: 0,
      threshold: 0,
      frequencyHours: 1,
      sensitivity: 1,
      lastPrice: 1,
      nextHour: 0,
      collateralSubstitution: false,
    };
    state.margins = [m];
    revalueMarket(state, "treasury", 0.9, "test");
    expect(variationMargin(m, 0.9)).toBeCloseTo(10);
    processMargins(state);
    expect(state.payments[0].amount).toBeCloseTo(10);
    assertFinancialState(state);
  });
  it("treats unpaid initial margin as a liquidity need", () => {
    const payer = institution("payer"),
      receiver = institution("receiver");
    const state = stateOf([payer, receiver]);
    state.margins = [
      {
        id: "im",
        payer: "payer",
        receiver: "receiver",
        assetClass: "treasury",
        notional: 0,
        initialMargin: 30,
        postedInitialMargin: 0,
        threshold: 0,
        frequencyHours: 1,
        sensitivity: 1,
        lastPrice: 1,
        nextHour: 0,
        collateralSubstitution: false,
      },
    ];
    expect(liquidityPosition(state, payer)).toMatchObject({
      shortfall: 10,
      state: "ILLIQUID",
    });
  });
  it("can pledge eligible securities for initial margin without issuing cash", () => {
    const payer = institution("payer"),
      receiver = institution("receiver");
    const state = stateOf([payer, receiver]);
    state.markets = [{ ...market, liquidityProviderId: "receiver" }];
    state.margins = [
      {
        id: "im",
        payer: "payer",
        receiver: "receiver",
        assetClass: "treasury",
        notional: 0,
        initialMargin: 10,
        postedInitialMargin: 0,
        threshold: 0,
        frequencyHours: 1,
        sensitivity: 1,
        lastPrice: 1,
        nextHour: 0,
        collateralSubstitution: true,
      },
    ];
    const before = sum(state.actors.map(liquid));
    processMargins(state);
    expect(state.margins[0].postedInitialMargin).toBeCloseTo(10);
    expect(sum(state.actors.map(liquid))).toBe(before);
    expect(payer.balanceSheet.assets.derivativesCollateral).toBe(0);
    expect(payer.collateral[0].pledges["im-securities:im"]).toBeGreaterThan(0);
    assertFinancialState(state);
  });
});
