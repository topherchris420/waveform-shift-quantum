import { describe, it, expect } from "vitest";
import { FacilityEngine } from "../../systemic-lab/facilities";
import { updateSettlementBudget } from "../../systemic-lab/engine";
import { SettlementNetwork } from "../../systemic-lab/settlement";
import {
  emptyBalanceSheet,
  assertBalanceSheet,
  liquid,
} from "../../systemic-lab/accounting";
import {
  createPayment,
  assertFinancialState,
} from "../../systemic-lab/network";
import { institution, stateOf, facility } from "./fixtures";
function setup() {
  const bank = institution("bank"),
    cb = institution("cb"),
    recipient = institution("recipient");
  cb.type = "central-bank";
  cb.collateral = [];
  cb.balanceSheet = emptyBalanceSheet();
  cb.balanceSheet.assets.securities = 200;
  cb.balanceSheet.liabilities.reserveLiabilities = 200;
  const s = stateOf([bank, cb, recipient]);
  s.facilities = [facility()];
  bank.liquidityBuffer = 40;
  return s;
}
describe("Explicit central-bank facilities", () => {
  it("issues matched assets/liabilities, never equity or physical resources", () => {
    const s = setup(),
      eq = s.actors[0].balanceSheet.equity,
      physical = structuredClone(s.physical);
    FacilityEngine.request(s, s.facilities[0], "bank");
    FacilityEngine.process(s);
    expect(s.actors[0].balanceSheet.assets.reserves).toBe(40);
    expect(s.actors[0].balanceSheet.equity).toBe(eq);
    expect(s.physical).toEqual(physical);
    assertFinancialState(s);
  });
  it("refuses ineligible and insolvent borrowers", () => {
    const s = setup();
    s.actors[0].type = "hedge-fund";
    expect(FacilityEngine.request(s, s.facilities[0], "bank")).toBeNull();
    s.actors[0].type = "commercial-bank";
    s.actors[0].balanceSheet.assets.securities = 0;
    s.actors[0].collateral = [];
    s.actors[0].balanceSheet.equity = -80;
    expect(FacilityEngine.request(s, s.facilities[0], "bank")).toBeNull();
  });
  it("reserves finite aggregate capacity across delayed requests", () => {
    const s = setup();
    s.facilities[0].capacity = 25;
    s.facilities[0].responseLagHours = 2;
    s.actors[2].liquidityBuffer = 40;
    FacilityEngine.request(s, s.facilities[0], "bank");
    FacilityEngine.request(s, s.facilities[0], "recipient");
    expect(s.facilityLoans.reduce((n, l) => n + l.amount, 0)).toBe(25);
    FacilityEngine.process(s);
    expect(s.cumulativeFacilityDraws).toBe(0);
    s.hour = 2;
    FacilityEngine.process(s);
    expect(s.cumulativeFacilityDraws).toBe(25);
  });
  it("rechecks solvency during operational delay", () => {
    const s = setup();
    s.facilities[0].responseLagHours = 2;
    FacilityEngine.request(s, s.facilities[0], "bank");
    s.actors[0].balanceSheet.equity = -1;
    s.hour = 2;
    FacilityEngine.process(s);
    expect(s.facilityLoans[0].status).toBe("REJECTED");
    expect(s.cumulativeFacilityDraws).toBe(0);
  });
  it("repayment extinguishes reserves and keeps interest explicit", () => {
    const s = setup();
    s.facilities[0].spreadBps = 0;
    FacilityEngine.request(s, s.facilities[0], "bank");
    FacilityEngine.process(s);
    s.hour = 48;
    FacilityEngine.process(s);
    expect(s.facilityLoans[0].status).toBe("REPAID");
    expect(s.actors[0].balanceSheet.liabilities.centralBankBorrowing).toBe(0);
    assertFinancialState(s);
  });
  it("allows new facility reserves to settle claims without enabling receipt recycling", () => {
    const s = setup();
    s.actors[0].balanceSheet.assets.securities += 20;
    s.actors[0].balanceSheet.assets.reserves = 0;
    createPayment(s, {
      id: "due",
      from: "bank",
      to: "recipient",
      amount: 10,
      dueHour: 0,
      deadlineHour: 8,
      priority: 1,
      kind: "payment",
    });
    const budget = new Map(s.actors.map((a) => [a.id, liquid(a)]));
    const before = new Map(s.actors.map((a) => [a.id, liquid(a)]));
    FacilityEngine.request(s, s.facilities[0], "bank");
    FacilityEngine.process(s);
    updateSettlementBudget(budget, before, s);
    expect(
      SettlementNetwork.settle(
        s,
        { mode: "gross", reliability: 1, liquidityRecycling: false },
        1,
        "fifo",
        budget,
      ),
    ).toBe(10);
    assertFinancialState(s);
  });
});
