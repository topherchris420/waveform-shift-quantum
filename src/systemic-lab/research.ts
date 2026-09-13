import { z } from "zod";
import { clamp, sum, liquid } from "./accounting";
import { securedExposureValue } from "./network";
import {
  POLICY_VARIANTS,
  policyScenario,
  type PolicyVariant,
} from "./counterfactuals";
import { runPolicySimulation } from "./engine";
import { draw } from "./random";
import {
  LAYERS,
  type Layer,
  type PolicySimulationResult,
  type Scenario,
} from "./types";
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export function percentile(xs: number[], p: number): number {
  if (!xs.length) throw new Error("Empty sample");
  const a = [...xs].sort((x, y) => x - y),
    i = clamp(p) * (a.length - 1),
    lo = Math.floor(i);
  return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo);
}
export const PARAMETER_KEYS = [
  "withdrawalFraction",
  "collateralHaircut",
  "marketDepth",
  "facilityCapacity",
  "withdrawalAcceleration",
  "settlementReliability",
  "interventionLagHours",
] as const;
export type ResearchParameter = (typeof PARAMETER_KEYS)[number];
export function setResearchParameter(
  base: Scenario,
  key: ResearchParameter,
  value: number,
): Scenario {
  if (!PARAMETER_KEYS.includes(key))
    throw new Error("Unknown research parameter");
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Invalid research parameter");
  if (
    [
      "withdrawalFraction",
      "collateralHaircut",
      "withdrawalAcceleration",
      "settlementReliability",
    ].includes(key) &&
    value > 1
  )
    throw new Error("Fraction above one");
  const s = structuredClone(base);
  switch (key) {
    case "withdrawalFraction":
      if (!s.shocks.some((sh) => sh.kind === "withdrawal"))
        s.shocks.push({
          id: "research-withdrawal",
          hour: s.stepHours,
          kind: "withdrawal",
          target: "all",
          magnitude: value,
          durationHours: 0,
          evidenceIds: [],
        });
      for (const sh of s.shocks)
        if (sh.kind === "withdrawal") sh.magnitude = value;
      break;
    case "collateralHaircut":
      for (const a of s.actors) for (const c of a.collateral) c.haircut = value;
      for (const e of s.exposures) e.securedAmount = securedExposureValue(s, e);
      break;
    case "marketDepth":
      if (value === 0) throw new Error("Market depth must be positive");
      for (const m of s.markets) m.marketDepth = value;
      break;
    case "facilityCapacity":
      for (const f of s.facilities) f.capacity = value;
      break;
    case "withdrawalAcceleration":
      s.behavior.withdrawalAcceleration = value;
      break;
    case "settlementReliability":
      s.settlement.reliability = value;
      break;
    case "interventionLagHours":
      for (const f of s.facilities) f.responseLagHours = value;
      break;
  }
  return s;
}
const DistributionSchema = z
  .strictObject({
    parameter: z.enum(PARAMETER_KEYS),
    distribution: z.enum(["uniform", "triangular"]),
    lower: z.number().finite().min(0),
    upper: z.number().finite().max(1e8),
    mode: z.number().finite().optional(),
  })
  .refine(
    (d) =>
      d.upper >= d.lower &&
      (d.mode === undefined || (d.mode >= d.lower && d.mode <= d.upper)),
    "Invalid distribution bounds",
  );
export const EnsembleConfigSchema = z
  .strictObject({
    seed: z.number().int().min(0).max(4294967295),
    size: z.number().int().min(2).max(128),
    method: z.enum(["monte-carlo", "latin-hypercube"]),
    distributions: z.array(DistributionSchema).max(7),
    shockCorrelation: z.number().finite().min(0).max(1),
    shockStdDev: z.number().finite().min(0).max(0.5),
    breachThreshold: z.number().finite().min(0).max(1e9),
  })
  .refine(
    (x) =>
      new Set(x.distributions.map((d) => d.parameter)).size ===
      x.distributions.length,
    "Duplicate distribution parameter",
  );
export type EnsembleConfig = z.infer<typeof EnsembleConfigSchema>;
export interface EnsembleReport {
  config: EnsembleConfig;
  median: number;
  p05: number;
  p95: number;
  tailMean95: number;
  breachProbability: number;
  sampleSize: number;
  outcomes: {
    seed: number;
    shortfall: number;
    priceDislocation: number;
    failedPayments: number;
    parameters: Record<string, number>;
  }[];
  uncertaintyBoundary: string;
  convergence: {
    firstHalfMedian: number;
    fullMedian: number;
    medianChange: number;
  };
}
function normal(seed: number, ...keys: (string | number)[]) {
  return (
    Math.sqrt(-2 * Math.log(Math.max(1e-12, draw(seed, ...keys, "u")))) *
    Math.cos(2 * Math.PI * draw(seed, ...keys, "v"))
  );
}
export function sampleScenarios(
  base: Scenario,
  input: EnsembleConfig,
): { scenario: Scenario; parameters: Record<string, number> }[] {
  const c = EnsembleConfigSchema.parse(input);
  const permutations = c.distributions.map((_, j) =>
    Array.from({ length: c.size }, (_, i) => i).sort(
      (a, b) => draw(c.seed, "lhs", j, a) - draw(c.seed, "lhs", j, b) || a - b,
    ),
  );
  return Array.from({ length: c.size }, (_, i) => {
    let scenario = structuredClone(base);
    scenario.seed = Math.floor(draw(c.seed, "scenario-seed", i) * 4294967296);
    const parameters: Record<string, number> = {};
    c.distributions.forEach((d, j) => {
      const u =
        c.method === "latin-hypercube"
          ? (permutations[j][i] + draw(c.seed, "jitter", i, j)) / c.size
          : draw(c.seed, "parameter", i, j);
      const mode = d.mode ?? (d.lower + d.upper) / 2;
      const width = d.upper - d.lower;
      const fraction = width ? (mode - d.lower) / width : 0;
      const value =
        d.distribution === "uniform"
          ? d.lower + u * width
          : width === 0
            ? d.lower
            : u < fraction
              ? d.lower + Math.sqrt(u * width * (mode - d.lower))
              : d.upper - Math.sqrt((1 - u) * width * (d.upper - mode));
      scenario = setResearchParameter(scenario, d.parameter, value);
      parameters[d.parameter] = value;
    });
    const common = normal(c.seed, "common-shock", i);
    for (const sh of scenario.shocks)
      if (["withdrawal", "price", "haircut"].includes(sh.kind)) {
        const correlated =
          Math.sqrt(c.shockCorrelation) * common +
          Math.sqrt(1 - c.shockCorrelation) *
            normal(c.seed, "idiosyncratic", i, sh.id);
        sh.magnitude = clamp(sh.magnitude + c.shockStdDev * correlated);
      }
    return { scenario, parameters };
  });
}
export function summarizeEnsemble(
  config: EnsembleConfig,
  outcomes: EnsembleReport["outcomes"],
): EnsembleReport {
  const xs = outcomes.map((o) => o.shortfall),
    p95 = percentile(xs, 0.95),
    median = percentile(xs, 0.5),
    firstHalfMedian = percentile(xs.slice(0, Math.floor(xs.length / 2)), 0.5);
  return {
    config,
    median,
    p05: percentile(xs, 0.05),
    p95,
    tailMean95: mean(xs.filter((x) => x >= p95)),
    breachProbability: mean(xs.map((x) => Number(x > config.breachThreshold))),
    sampleSize: xs.length,
    outcomes,
    uncertaintyBoundary:
      "Empirical distribution under declared synthetic input distributions. Percentiles and breach frequencies are not forecasts or population confidence guarantees.",
    convergence: {
      firstHalfMedian,
      fullMedian: median,
      medianChange: median - firstHalfMedian,
    },
  };
}
export function runEnsemble(
  base: Scenario,
  config: EnsembleConfig,
  onProgress?: (completed: number, total: number) => void,
): EnsembleReport {
  const samples = sampleScenarios(base, config),
    outcomes = samples.map((sample, i) => {
      const r = runPolicySimulation(sample.scenario);
      onProgress?.(i + 1, samples.length);
      return {
        seed: sample.scenario.seed,
        shortfall: r.summary.peakLiquidityShortfall,
        priceDislocation: r.summary.priceDislocation,
        failedPayments: r.summary.failedSettlementValue,
        parameters: sample.parameters,
      };
    });
  return summarizeEnsemble(config, outcomes);
}
export function bootstrapMeanInterval(
  values: number[],
  seed = 951,
): [number, number] {
  if (values.length < 2)
    throw new Error("Bootstrap needs two or more observations");
  const means = Array.from({ length: 400 }, (_, i) =>
    mean(
      values.map(
        (_, j) =>
          values[Math.floor(draw(seed, "bootstrap", i, j) * values.length)],
      ),
    ),
  );
  return [percentile(means, 0.025), percentile(means, 0.975)];
}
export interface FrozenPolicyClaim {
  schema: "policy-preregistration.v1";
  scenario: Scenario;
  baseline: PolicyVariant;
  candidate: PolicyVariant;
  discoverySeeds: number[];
  holdoutSeeds: number[];
  minimumEffect: number;
  maxFailedPaymentIncrease: number;
  maxCapitalLossIncrease: number;
}
export function freezePolicyClaim(
  claim: FrozenPolicyClaim,
): Readonly<FrozenPolicyClaim> {
  if (
    claim.schema !== "policy-preregistration.v1" ||
    !POLICY_VARIANTS.includes(claim.baseline) ||
    !POLICY_VARIANTS.includes(claim.candidate) ||
    [
      claim.minimumEffect,
      claim.maxFailedPaymentIncrease,
      claim.maxCapitalLossIncrease,
    ].some((v) => !Number.isFinite(v) || v < 0) ||
    !claim.discoverySeeds.length ||
    claim.discoverySeeds.length > 128 ||
    claim.holdoutSeeds.length < 2 ||
    claim.holdoutSeeds.length > 32
  )
    throw new Error("Invalid preregistration");
  const all = [...claim.discoverySeeds, ...claim.holdoutSeeds];
  if (
    new Set(all).size !== all.length ||
    all.some((s) => !Number.isInteger(s) || s < 0 || s > 4294967295)
  )
    throw new Error("Discovery and holdout seeds must be unique and disjoint");
  const copy = structuredClone(claim);
  function freeze(x: unknown) {
    if (x && typeof x === "object") {
      Object.values(x).forEach(freeze);
      Object.freeze(x);
    }
  }
  freeze(copy);
  return copy;
}
export function runHoldout(input: FrozenPolicyClaim) {
  const claim = freezePolicyClaim(input);
  const pairs = claim.holdoutSeeds.map((seed) => {
    const s = { ...claim.scenario, seed },
      a = runPolicySimulation(policyScenario(s, claim.baseline)),
      b = runPolicySimulation(policyScenario(s, claim.candidate));
    return {
      seed,
      effect:
        a.summary.peakLiquidityShortfall - b.summary.peakLiquidityShortfall,
      failedPaymentIncrease:
        b.summary.failedSettlementValue - a.summary.failedSettlementValue,
      capitalLossIncrease:
        b.summary.capitalImpairment - a.summary.capitalImpairment,
      warnings: b.numericalWarnings.length + a.numericalWarnings.length,
    };
  });
  const interval = bootstrapMeanInterval(pairs.map((p) => p.effect));
  const supported =
    interval[0] > claim.minimumEffect &&
    pairs.every(
      (p) =>
        p.failedPaymentIncrease <= claim.maxFailedPaymentIncrease &&
        p.capitalLossIncrease <= claim.maxCapitalLossIncrease &&
        p.warnings === 0,
    );
  return {
    claim,
    pairs,
    meanEffect: mean(pairs.map((p) => p.effect)),
    interval,
    status: supported
      ? "SUPPORTED IN FROZEN SIMULATION"
      : "INSUFFICIENT EVIDENCE",
    interpretation:
      "Holdout simulation evidence is conditional on the frozen model and thresholds; it does not establish policy superiority in real institutions.",
  };
}
export interface PolicyRobustnessReport {
  status: "ROBUST" | "MIXED" | "FRAGILE" | "NOT SUPPORTED";
  baseline: PolicyVariant;
  candidate: PolicyVariant;
  rows: {
    assumption: string;
    effect: number;
    failedPaymentIncrease: number;
    capitalLossIncrease: number;
    numericalWarnings: number;
  }[];
  interpretation: string;
}
export function policyRobustness(
  base: Scenario,
  baseline: PolicyVariant,
  candidate: PolicyVariant,
): PolicyRobustnessReport {
  const variants: { assumption: string; scenario: Scenario }[] = [
    { assumption: "Original calibration", scenario: base },
    {
      assumption: "Alternate seed",
      scenario: { ...base, seed: (base.seed + 7919) >>> 0 },
    },
    {
      assumption: "No behavioral withdrawals",
      scenario: setResearchParameter(base, "withdrawalAcceleration", 0),
    },
    {
      assumption: "Half market depth",
      scenario: setResearchParameter(
        base,
        "marketDepth",
        (base.markets[0]?.marketDepth ?? 1) * 0.5,
      ),
    },
    {
      assumption: "Double market depth",
      scenario: setResearchParameter(
        base,
        "marketDepth",
        (base.markets[0]?.marketDepth ?? 1) * 2,
      ),
    },
    {
      assumption: "Half facility capacity",
      scenario: setResearchParameter(
        base,
        "facilityCapacity",
        base.facilities[0]?.capacity * 0.5 || 0,
      ),
    },
    {
      assumption: "Higher collateral haircut",
      scenario: setResearchParameter(base, "collateralHaircut", 0.4),
    },
    {
      assumption: "Earlier intervention",
      scenario: setResearchParameter(base, "interventionLagHours", 0),
    },
  ];
  const noParent = structuredClone(base);
  for (const e of noParent.exposures)
    if (e.kind === "intragroup") e.transferRestricted = !e.transferRestricted;
  variants.push({
    assumption: "Alternate cross-border transfer topology",
    scenario: noParent,
  });
  const timing = structuredClone(base);
  for (const sh of timing.shocks)
    sh.hour = Math.min(base.horizonHours, sh.hour + base.stepHours);
  variants.push({ assumption: "Later initial shocks", scenario: timing });
  const concentration = structuredClone(base);
  const lenders = concentration.actors
    .filter((a) =>
      [
        "secured-funding-provider",
        "unsecured-funding-provider",
        "money-market-fund",
      ].includes(a.type),
    )
    .map((actor) => ({ actor, liquidity: liquid(actor) }))
    .sort((a, b) => b.liquidity - a.liquidity);
  const buyer = lenders[0]?.actor;
  const claim = concentration.exposures.find(
    (e) =>
      buyer &&
      e.creditor !== buyer.id &&
      e.debtor !== buyer.id &&
      e.securedAmount === 0 &&
      e.collateralIds.length === 0 &&
      e.principal > 0,
  );
  if (buyer && claim) {
    const seller = concentration.actors.find((a) => a.id === claim.creditor)!;
    const amount = Math.min(liquid(buyer), claim.principal * 0.5);
    if (amount > 0) {
      const reserveUse = Math.min(amount, buyer.balanceSheet.assets.reserves);
      buyer.balanceSheet.assets.reserves -= reserveUse;
      buyer.balanceSheet.assets.cash -= amount - reserveUse;
      buyer.balanceSheet.assets[claim.creditorAccount] += amount;
      seller.balanceSheet.assets.reserves += amount;
      seller.balanceSheet.assets[claim.creditorAccount] -= amount;
      claim.principal -= amount;
      concentration.exposures.push({
        ...claim,
        id: `${claim.id}:concentrated`,
        creditor: buyer.id,
        principal: amount,
      });
      variants.push({
        assumption: "Funding creditor concentration via claim purchase at par",
        scenario: concentration,
      });
    }
  }
  const rows = variants.map((v) => {
    const a = runPolicySimulation(policyScenario(v.scenario, baseline)),
      b = runPolicySimulation(policyScenario(v.scenario, candidate));
    return {
      assumption: v.assumption,
      effect:
        a.summary.peakLiquidityShortfall - b.summary.peakLiquidityShortfall,
      failedPaymentIncrease:
        b.summary.failedSettlementValue - a.summary.failedSettlementValue,
      capitalLossIncrease:
        b.summary.capitalImpairment - a.summary.capitalImpairment,
      numericalWarnings:
        a.numericalWarnings.length + b.numericalWarnings.length,
    };
  });
  const passes = rows.filter(
    (r) =>
      r.effect > 1e-6 &&
      r.failedPaymentIncrease <= 1e-6 &&
      r.capitalLossIncrease <= 1e-6 &&
      r.numericalWarnings === 0,
  ).length;
  return {
    status:
      passes === rows.length
        ? "ROBUST"
        : passes >= rows.length / 2
          ? "MIXED"
          : passes > 0
            ? "FRAGILE"
            : "NOT SUPPORTED",
    baseline,
    candidate,
    rows,
    interpretation:
      "Robustness concerns a reduction in peak liquidity shortfall with no increased failed payment value or capital loss, within these explicit variations only.",
  };
}
export function runLayerAblation(
  base: Scenario,
  seeds: number[] = [101, 211],
  layers: readonly Layer[] = LAYERS,
) {
  if (
    !seeds.length ||
    seeds.length > 8 ||
    new Set(layers).size !== layers.length ||
    layers.some((layer) => !LAYERS.includes(layer))
  )
    throw new Error("Invalid ablation budget");
  const loss = (s: Scenario, seed: number) =>
    runPolicySimulation({ ...s, seed }).summary.peakLiquidityShortfall;
  const without = (removed: Layer[]) => ({
    ...base,
    layers: {
      ...base.layers,
      ...Object.fromEntries(removed.map((l) => [l, false])),
    },
  });
  const full = seeds.map((seed) => loss(base, seed));
  const isolated = new Map(
    layers.map((layer) => [
      layer,
      seeds.map((seed) => loss(without([layer]), seed)),
    ]),
  );
  const contributions = layers.map((layer) => {
    const effects = full.map((x, i) => x - isolated.get(layer)![i]);
    return {
      layer,
      marginalEffect: mean(effects),
      interval: [Math.min(...effects), Math.max(...effects)],
      interpretation:
        mean(effects) > 0
          ? "amplification"
          : mean(effects) < 0
            ? "buffering"
            : "no material difference",
    };
  });
  const interactions: { a: Layer; b: Layer; interaction: number }[] = [];
  for (let i = 0; i < layers.length; i++)
    for (let j = i + 1; j < layers.length; j++) {
      const a = layers[i],
        b = layers[j];
      interactions.push({
        a,
        b,
        interaction: mean(
          seeds.map(
            (seed, k) =>
              full[k] -
              isolated.get(a)![k] -
              isolated.get(b)![k] +
              loss(without([a, b]), seed),
          ),
        ),
      });
    }
  return {
    seeds,
    contributions,
    interactions,
    interpretation:
      "Paired layer removal under fixed seeds. Marginals depend on all remaining layers; intervals are seed ranges, not confidence intervals.",
  };
}
export interface CalibrationDataset {
  source: string;
  sourceDate: string;
  observations: {
    seed: number;
    peakLiquidityShortfall: number;
    priceDislocation: number;
  }[];
}
export function calibrateParameter(
  base: Scenario,
  key: ResearchParameter,
  grid: number[],
  data: CalibrationDataset,
) {
  if (
    grid.length < 2 ||
    grid.length > 20 ||
    data.observations.length < 3 ||
    data.observations.length > 32 ||
    !data.source ||
    !z.iso.date().safeParse(data.sourceDate).success ||
    !PARAMETER_KEYS.includes(key) ||
    grid.some((v) => !Number.isFinite(v)) ||
    new Set(grid).size !== grid.length ||
    data.observations.some(
      (o) =>
        !Number.isFinite(o.peakLiquidityShortfall) ||
        !Number.isFinite(o.priceDislocation) ||
        !Number.isInteger(o.seed),
    )
  )
    throw new Error(
      "Calibration needs a bounded grid, source/date and at least three finite observed moments",
    );
  const target = {
    shortfall: mean(data.observations.map((o) => o.peakLiquidityShortfall)),
    price: mean(data.observations.map((o) => o.priceDislocation)),
  };
  const candidates = grid
    .map((value) => {
      const sim = data.observations.map((o) =>
        runPolicySimulation({
          ...setResearchParameter(base, key, value),
          seed: o.seed,
        }),
      );
      const modeled = {
        shortfall: mean(sim.map((r) => r.summary.peakLiquidityShortfall)),
        price: mean(sim.map((r) => r.summary.priceDislocation)),
      };
      return {
        value,
        modeled,
        objective:
          ((modeled.shortfall - target.shortfall) /
            Math.max(1, Math.abs(target.shortfall))) **
            2 +
          (modeled.price - target.price) ** 2,
      };
    })
    .sort((a, b) => a.objective - b.objective);
  const best = candidates[0],
    near = candidates.filter(
      (c) =>
        c.objective <= best.objective + Math.max(0.01, best.objective * 0.1),
    );
  return {
    parameter: key,
    source: data.source,
    sourceDate: data.sourceDate,
    targetMoments: target,
    simulatedMoments: best.modeled,
    parameterValue: best.value,
    objective:
      "Squared relative shortfall residual + squared price-dislocation residual",
    residualError: best.objective,
    candidates,
    parameterUncertainty: [
      Math.min(...near.map((c) => c.value)),
      Math.max(...near.map((c) => c.value)),
    ],
    identifiabilityWarnings:
      near.length > 1
        ? [
            "Multiple grid values fit similarly; parameter is not uniquely identified.",
          ]
        : [
            "A unique grid minimum does not establish identification outside the grid.",
          ],
    interpretation:
      "Exploratory calibration, not validation. The near-optimal parameter range is not a statistical confidence interval.",
  };
}
