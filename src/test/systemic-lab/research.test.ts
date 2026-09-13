import { describe, it, expect } from "vitest";
import { createDemo } from "../../systemic-lab/scenarios";
import {
  sampleScenarios,
  runEnsemble,
  bootstrapMeanInterval,
  freezePolicyClaim,
  percentile,
  runLayerAblation,
  setResearchParameter,
  type EnsembleConfig,
} from "../../systemic-lab/research";
const config: EnsembleConfig = {
  seed: 52,
  size: 4,
  method: "latin-hypercube",
  distributions: [
    {
      parameter: "withdrawalFraction",
      distribution: "uniform",
      lower: 0,
      upper: 1,
    },
  ],
  shockCorrelation: 0.5,
  shockStdDev: 0,
  breachThreshold: 20,
};
describe("Uncertainty and frozen holdout boundaries", () => {
  it("stratifies Latin hypercube draws and reproduces the same sample", () => {
    const s = createDemo();
    const a = sampleScenarios(s, config);
    expect(sampleScenarios(s, config)).toEqual(a);
    expect(
      new Set(a.map((x) => Math.floor(x.parameters.withdrawalFraction * 4)))
        .size,
    ).toBe(4);
  });
  it("reports percentiles and empirical breach frequencies from actual outcomes", () => {
    const s = createDemo("intraday-settlement");
    const r = runEnsemble(s, config);
    expect(r.sampleSize).toBe(4);
    expect(r.median).toBe(
      percentile(
        r.outcomes.map((o) => o.shortfall),
        0.5,
      ),
    );
    expect(r.breachProbability).toBe(
      r.outcomes.filter((o) => o.shortfall > 20).length / 4,
    );
  });
  it("bootstrap interval collapses for identical observations", () =>
    expect(bootstrapMeanInterval([2, 2, 2])).toEqual([2, 2]));
  it("rejects discovery/holdout overlap and freezes nested assumptions", () => {
    const claim = {
      schema: "policy-preregistration.v1" as const,
      scenario: createDemo(),
      baseline: "none" as const,
      candidate: "liquidity-facility" as const,
      discoverySeeds: [1, 2],
      holdoutSeeds: [2, 3],
      minimumEffect: 1,
      maxFailedPaymentIncrease: 0,
      maxCapitalLossIncrease: 0,
    };
    expect(() => freezePolicyClaim(claim)).toThrow();
    const frozen = freezePolicyClaim({ ...claim, holdoutSeeds: [5, 6] });
    expect(Object.isFrozen(frozen.scenario.actors[0].balanceSheet)).toBe(true);
  });
  it("rejects unknown runtime parameter, layer and policy identifiers", () => {
    const scenario = createDemo();
    expect(() =>
      setResearchParameter(scenario, "invented" as never, 1),
    ).toThrow("Unknown research parameter");
    expect(() =>
      runLayerAblation(scenario, [1], ["invented" as never]),
    ).toThrow("Invalid ablation budget");
    expect(() =>
      freezePolicyClaim({
        schema: "policy-preregistration.v1",
        scenario,
        baseline: "invented" as never,
        candidate: "genesis",
        discoverySeeds: [1],
        holdoutSeeds: [2, 3],
        minimumEffect: 0,
        maxFailedPaymentIncrease: 0,
        maxCapitalLossIncrease: 0,
      }),
    ).toThrow("Invalid preregistration");
  });
});
