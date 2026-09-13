import { describe, it, expect } from "vitest";
import { createDemo } from "../../systemic-lab/scenarios";
import { parseScenario } from "../../systemic-lab/schema";
import { runPolicySimulation } from "../../systemic-lab/engine";
import { assertFinancialState } from "../../systemic-lab/network";
import { assertBalanceSheet } from "../../systemic-lab/accounting";
import { CollateralEngine } from "../../systemic-lab/collateral";
import {
  PolicyCounterfactualRunner,
  policyScenario,
} from "../../systemic-lab/counterfactuals";
describe("Flagship systemic scenarios", () => {
  for (const id of [
    "lfbo-dollar-funding",
    "intraday-settlement",
    "fire-sale-margin",
  ] as const)
    it(`${id}: reconciles every snapshot and deterministic replay`, () => {
      const s = parseScenario(createDemo(id));
      const before = structuredClone(s);
      const first = runPolicySimulation(s);
      expect(runPolicySimulation(s)).toEqual(first);
      expect(s).toEqual(before);
      assertFinancialState(first.finalState);
      for (const row of first.timeline)
        for (const a of row.actors) {
          assertBalanceSheet(a.balanceSheet);
          CollateralEngine.assertInventory(a);
        }
      expect(first.events.length).toBeGreaterThan(0);
      const evidenceIds = new Set(
        first.finalState.evidence.map((row) => row.id),
      );
      for (const event of first.events)
        for (const evidenceId of event.evidenceIds)
          expect(evidenceIds.has(evidenceId)).toBe(true);
      expect(first.summary.physicalShortfall).toBe(0);
    });
  it("uses identical initial conditions in every policy comparison", () => {
    const s = createDemo();
    const rows = PolicyCounterfactualRunner.run(s, [
      "none",
      "liquidity-facility",
      "genesis",
    ]);
    for (const row of rows)
      expect(row.result.timeline[0].actors).toEqual(s.actors);
  });
  it("gives matching, hybrid and Genesis identical resources and heuristic outcomes", () => {
    const rows = PolicyCounterfactualRunner.run(createDemo(), [
      "network-matching",
      "hybrid",
      "genesis",
    ]);
    expect(rows[1].result).toEqual(rows[0].result);
    expect(rows[2].result).toEqual(rows[0].result);
    expect(() => policyScenario(createDemo(), "invented" as never)).toThrow(
      "Unknown policy variant",
    );
  });
  it("monetary support cannot reverse an exogenous physical loss", () => {
    const s = createDemo();
    s.shocks = [
      {
        id: "physical",
        hour: 4,
        kind: "physical",
        target: "all",
        magnitude: 0.5,
        durationHours: 0,
        evidenceIds: [],
      },
    ];
    for (const row of PolicyCounterfactualRunner.run(s, [
      "none",
      "larger-facility",
      "genesis",
    ]))
      expect(row.result.summary.physicalShortfall).toBe(50);
  });
  it("rejects malformed imports, unknown counterparties, duplicate IDs and accounting breaks", () => {
    const s = createDemo();
    expect(() => parseScenario({ ...s, evil: true })).toThrow();
    s.exposures[0].creditor = "missing";
    expect(() => parseScenario(s)).toThrow();
    const other = createDemo();
    other.actors[0].balanceSheet.equity++;
    expect(() => parseScenario(other)).toThrow();
  });
  it("rejects a shock whose evidence link is absent from the registry", () => {
    const s = createDemo();
    s.shocks[0].evidenceIds = ["missing-evidence"];
    expect(() => parseScenario(s)).toThrow("references unknown evidence");
  });
  it("rejects silent shock targets and applies an edge-specific spread shock", () => {
    const invalid = createDemo();
    invalid.shocks[0].target = "central-bank";
    expect(() => parseScenario(invalid)).toThrow("Invalid target");

    const targeted = createDemo();
    const edgeId = targeted.exposures[0].id;
    targeted.shocks = [
      {
        id: "edge-spread",
        hour: 0,
        kind: "spread",
        target: edgeId,
        magnitude: 50,
        durationHours: 0,
        evidenceIds: [],
      },
    ];
    targeted.horizonHours = targeted.stepHours;
    const result = runPolicySimulation(targeted);
    expect(
      result.finalState.exposures.find((e) => e.id === edgeId)?.spreadBps,
    ).toBe(150);
    expect(
      result.finalState.exposures.find((e) => e.id !== edgeId)?.spreadBps,
    ).toBe(100);
  });
  it("rejects inconsistent payment status and phantom collateral release", () => {
    const status = createDemo();
    status.payments[0].status = "SETTLED";
    expect(() => parseScenario(status)).toThrow("inconsistent status");

    const release = createDemo();
    release.payments[0].releasePledges = [
      {
        actorId: release.payments[0].from,
        lotId: `${release.payments[0].from}-treasury`,
        contractId: "not-pledged",
        quantity: 1,
      },
    ];
    expect(() => parseScenario(release)).toThrow("unpledged collateral");
  });
  it("uses seeded market volatility deterministically and operationally", () => {
    const s = createDemo();
    s.horizonHours = s.stepHours;
    s.shocks = [];
    s.markets[0].volatility = 0.4;
    const first = runPolicySimulation(s),
      replay = runPolicySimulation(s);
    expect(replay).toEqual(first);
    expect(first.finalState.markets[0].price).not.toBe(1);
    expect(
      first.events.some(
        (event) => event.mechanism === "seeded-market-volatility",
      ),
    ).toBe(true);
  });
});
