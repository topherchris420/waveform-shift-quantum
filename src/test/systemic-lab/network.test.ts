import { describe, it, expect } from "vitest";
import {
  createPayment,
  assertFinancialState,
  resolveCounterparty,
  provideCommittedSupport,
  FinancialExposureGraph,
} from "../../systemic-lab/network";
import { SettlementNetwork } from "../../systemic-lab/settlement";
import { sum, liquid } from "../../systemic-lab/accounting";
import { institution, stateOf } from "./fixtures";
const config = {
  mode: "gross" as const,
  reliability: 1,
  liquidityRecycling: true,
};
function queue(
  s: ReturnType<typeof stateOf>,
  id: string,
  from: string,
  to: string,
  amount: number,
) {
  createPayment(s, {
    id,
    from,
    to,
    amount,
    dueHour: 0,
    deadlineHour: 8,
    priority: 1,
    kind: "payment",
  });
}
describe("Settlement as a reconciled network process", () => {
  it("recycles receipts into downstream obligations, conserving aggregate liquidity", () => {
    const a = institution("a"),
      b = institution("b"),
      c = institution("c");
    b.balanceSheet.assets.reserves = 0;
    b.balanceSheet.equity -= 20;
    const state = stateOf([a, b, c]);
    queue(state, "first", "b", "c", 20);
    queue(state, "second", "a", "b", 20);
    const before = sum(state.actors.map(liquid));
    expect(SettlementNetwork.settle(state, config, 42)).toBe(40);
    expect(sum(state.actors.map(liquid))).toBe(before);
    assertFinancialState(state);
  });
  it("queues an outage and preserves unpaid claims after the deadline", () => {
    const state = stateOf([institution("a"), institution("b")]);
    state.actors[1].outageUntil = 10;
    queue(state, "p", "a", "b", 10);
    expect(SettlementNetwork.settle(state, config, 42)).toBe(0);
    state.hour = 8;
    SettlementNetwork.settle(state, config, 42);
    expect(state.payments[0].status).toBe("FAILED");
    expect(state.payments[0].remaining).toBe(10);
    assertFinancialState(state);
  });
  it("bilateral netting resolves reciprocal gridlock without cash", () => {
    const state = stateOf([institution("a"), institution("b")]);
    queue(state, "p", "a", "b", 30);
    queue(state, "q", "b", "a", 30);
    expect(SettlementNetwork.settle(state, config, 42)).toBe(0);
    expect(
      SettlementNetwork.settle(
        state,
        { ...config, mode: "bilateral-netting" },
        42,
      ),
    ).toBe(60);
    assertFinancialState(state);
  });
  it("disabling recycling does not spend incoming liquidity in the same call", () => {
    const state = stateOf([
      institution("a"),
      institution("b"),
      institution("c"),
    ]);
    queue(state, "p", "a", "b", 20);
    queue(state, "q", "b", "c", 40);
    expect(
      SettlementNetwork.settle(
        state,
        { ...config, liquidityRecycling: false },
        42,
      ),
    ).toBe(20);
    assertFinancialState(state);
  });
  it("resolution cannot transmit a loss without an exposure edge", () => {
    const state = stateOf([institution("a"), institution("b")]);
    const before = structuredClone(state.actors[1]);
    resolveCounterparty(state, "a");
    expect(state.actors[1]).toEqual(before);
  });
  it("perfect reliability has no random settlement failures over seed ensemble", () => {
    for (let seed = 0; seed < 25; seed++) {
      const state = stateOf([institution("a"), institution("b")]);
      queue(state, "p", "a", "b", 10);
      expect(SettlementNetwork.settle(state, config, seed)).toBe(10);
    }
  });
  it("records explicit LGD while leaving the residual failed payment claim", () => {
    const state = stateOf([institution("debtor"), institution("creditor")]);
    queue(state, "claim", "debtor", "creditor", 10);
    resolveCounterparty(state, "debtor");
    expect(state.payments[0]).toMatchObject({
      remaining: 5,
      writtenOff: 5,
      lossGivenDefault: 0.5,
      status: "FAILED",
    });
    // The creditor first recognizes 10 of operating income, then a 5 resolution loss.
    expect(state.actors[1].balanceSheet.equity).toBe(25);
    assertFinancialState(state);
  });
  it("nets reciprocal claims and bounds directed multigraph density", () => {
    const edge = (
      id: string,
      creditor: string,
      debtor: string,
      principal: number,
    ) => ({
      id,
      creditor,
      debtor,
      principal,
      kind: "unsecured" as const,
      fundingKind: "interbank" as const,
      creditorAccount: "interbankAssets" as const,
      debtorAccount: "interbankBorrowing" as const,
      securedAmount: 0,
      collateralIds: [],
      maturityHour: 24,
      rolloverProbability: 1,
      lossGivenDefault: 0.5,
      fundingDependency: 0.5,
      transferLimit: 100,
      transferRestricted: false,
      spreadBps: 0,
    });
    const metrics = new FinancialExposureGraph([
      edge("ab-1", "a", "b", 10),
      edge("ab-2", "a", "b", 5),
      edge("ba", "b", "a", 7),
    ]).metrics(["a", "b"]);
    expect(metrics.grossExposure).toBe(22);
    expect(metrics.netExposure).toBe(8);
    expect(metrics.interconnectedness).toBe(1);
  });
  it("draws committed support from lender liquidity subject to ring-fencing and line limits", () => {
    const lender = institution("parent"),
      borrower = institution("child");
    borrower.liquidityBuffer = 50;
    const state = stateOf([lender, borrower]);
    const edge = {
      id: "line",
      creditor: "parent",
      debtor: "child",
      principal: 0,
      kind: "intragroup" as const,
      fundingKind: "interbank" as const,
      creditorAccount: "interbankAssets" as const,
      debtorAccount: "interbankBorrowing" as const,
      securedAmount: 0,
      collateralIds: [],
      maturityHour: 24,
      rolloverProbability: 1,
      lossGivenDefault: 0.5,
      fundingDependency: 0.5,
      transferLimit: 10,
      transferRestricted: true,
      spreadBps: 0,
    };
    state.exposures = [edge];
    expect(provideCommittedSupport(state, edge)).toBe(0);
    edge.transferRestricted = false;
    expect(provideCommittedSupport(state, edge)).toBe(10);
    expect(provideCommittedSupport(state, edge)).toBe(0);
    expect(lender.balanceSheet.assets.reserves).toBe(10);
    expect(borrower.balanceSheet.assets.reserves).toBe(30);
    assertFinancialState(state);
  });
});
