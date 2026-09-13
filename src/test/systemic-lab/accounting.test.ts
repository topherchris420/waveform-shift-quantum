import { describe, it, expect } from "vitest";
import {
  assertBalanceSheet,
  emptyBalanceSheet,
  post,
  capitalPosition,
  liquid,
} from "../../systemic-lab/accounting";
import { CollateralEngine } from "../../systemic-lab/collateral";
import { institution, stateOf, facility } from "./fixtures";
describe("Explicit double-entry accounting and collateral", () => {
  it("rejects unbalanced, nonfinite and negative account states", () => {
    const a = institution();
    assertBalanceSheet(a.balanceSheet);
    a.balanceSheet.assets.reserves++;
    expect(() => assertBalanceSheet(a.balanceSheet)).toThrow();
    a.balanceSheet.equity = NaN;
    expect(() => assertBalanceSheet(a.balanceSheet)).toThrow();
  });
  it("rolls back an entire invalid transaction", () => {
    const state = stateOf();
    const before = structuredClone(state);
    expect(() =>
      post(
        state,
        [
          { actorId: "bank", account: "reserves", delta: -30 },
          { actorId: "bank", account: "uninsuredDeposits", delta: -30 },
        ],
        {
          actorId: "bank",
          mechanism: "withdrawal",
          amount: 30,
          units: "USD million",
          previous: 20,
          next: -10,
          calculation: "deposit redemption",
          evidenceIds: [],
          edgeId: null,
        },
      ),
    ).toThrow();
    expect(state).toEqual(before);
  });
  it("keeps liquidity and insolvency distinct", () => {
    const a = institution();
    a.balanceSheet.assets.securities = 0;
    a.balanceSheet.equity = -80;
    expect(liquid(a)).toBe(20);
    expect(capitalPosition(a).state).toBe("INSOLVENT");
    assertBalanceSheet(a.balanceSheet);
  });
  it("haircuts monotonically reduce capacity over generated inventories", () => {
    for (let q = 1; q <= 50; q++) {
      const a = institution();
      a.collateral[0].quantity = q;
      let previous = Infinity;
      for (let h = 0; h <= 10; h++) {
        a.collateral[0].haircut = h / 10;
        const cap = CollateralEngine.inspect(a).borrowingCapacity;
        expect(cap).toBeLessThanOrEqual(previous);
        previous = cap;
      }
    }
  });
  it("prevents repledging, respects eligibility and releases collateral", () => {
    const a = institution(),
      f = facility();
    expect(CollateralEngine.inspect(a, f).borrowingCapacity).toBeCloseTo(76);
    CollateralEngine.pledge(a, f, "loan", 50);
    expect(CollateralEngine.inspect(a, f).borrowingCapacity).toBeCloseTo(26);
    expect(() => CollateralEngine.pledge(a, f, "other", 30)).toThrow();
    expect(
      CollateralEngine.inspect(a, { ...f, eligibleCollateral: [] })
        .borrowingCapacity,
    ).toBe(0);
    CollateralEngine.release(a, "loan");
    expect(CollateralEngine.inspect(a, f).borrowingCapacity).toBeCloseTo(76);
  });
  it("excludes collateral once its modeled maturity is reached", () => {
    const a = institution(),
      f = facility();
    expect(CollateralEngine.inspect(a, f, 8759).borrowingCapacity).toBeCloseTo(
      76,
    );
    expect(CollateralEngine.inspect(a, f, 8760).borrowingCapacity).toBe(0);
  });
  it("rejects unknown event evidence before committing a posting", () => {
    const state = stateOf();
    state.evidence = [
      {
        id: "known",
        value: 1,
        units: "fraction",
        lower: 0,
        upper: 1,
        source: "test",
        sourceDate: "2026-09-12",
        calibrationType: "EXPERIMENTAL",
        confidence: 0,
        notes: "test",
      },
    ];
    const before = structuredClone(state);
    expect(() =>
      post(
        state,
        [
          { actorId: "bank", account: "reserves", delta: -1 },
          { actorId: "bank", account: "uninsuredDeposits", delta: -1 },
        ],
        {
          actorId: "bank",
          mechanism: "test",
          amount: 1,
          units: "USD million",
          previous: 20,
          next: 19,
          calculation: "test",
          evidenceIds: ["unknown"],
          edgeId: null,
        },
      ),
    ).toThrow("unknown parameter evidence");
    expect(state).toEqual(before);
  });
});
