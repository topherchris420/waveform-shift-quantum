import { runPolicySimulation } from "./engine";
import type { PolicySimulationResult, Scenario } from "./types";
export const POLICY_VARIANTS = [
  "none",
  "market-adjustment",
  "liquidity-facility",
  "larger-facility",
  "smaller-facility",
  "faster-facility",
  "slower-facility",
  "lower-haircuts",
  "expanded-collateral",
  "settlement-support",
  "network-matching",
  "hybrid",
  "genesis",
] as const;
export type PolicyVariant = (typeof POLICY_VARIANTS)[number];
export function policyScenario(
  base: Scenario,
  variant: PolicyVariant,
): Scenario {
  if (!POLICY_VARIANTS.includes(variant))
    throw new Error("Unknown policy variant");
  const s = structuredClone(base);
  s.policy.allowAssetSales = variant !== "none";
  s.layers["policy-intervention"] = !["none", "market-adjustment"].includes(
    variant,
  );
  s.policy.routing =
    variant === "network-matching"
      ? "network-matching"
      : variant === "hybrid"
        ? "hybrid"
        : variant === "genesis"
          ? "genesis"
          : "fifo";
  for (const f of s.facilities) {
    if (variant === "larger-facility") {
      f.capacity *= 2;
      f.counterpartyLimit *= 2;
      f.borrowingCap *= 2;
    }
    if (variant === "smaller-facility") {
      f.capacity *= 0.5;
      f.counterpartyLimit *= 0.5;
      f.borrowingCap *= 0.5;
    }
    if (variant === "faster-facility") f.responseLagHours = 0;
    if (variant === "slower-facility") f.responseLagHours += 24;
    if (variant === "lower-haircuts")
      for (const key of Object.keys(
        f.haircutSchedule,
      ) as (keyof typeof f.haircutSchedule)[])
        f.haircutSchedule[key] = Math.max(0, f.haircutSchedule[key]! - 0.1);
    if (variant === "expanded-collateral") {
      f.eligibleCollateral = [
        "cash",
        "treasury",
        "agency",
        "mbs",
        "corporate",
        "loans",
        "other",
      ];
      for (const a of s.actors)
        for (const c of a.collateral)
          if (!c.eligibleFacilities.includes(f.id))
            c.eligibleFacilities.push(f.id);
    }
  }
  if (variant === "settlement-support") s.settlement.mode = "bilateral-netting";
  return s;
}
export class PolicyCounterfactualRunner {
  static run(
    base: Scenario,
    variants: readonly PolicyVariant[] = POLICY_VARIANTS,
  ): { policy: PolicyVariant; result: PolicySimulationResult }[] {
    return variants.map((policy) => ({
      policy,
      result: runPolicySimulation(policyScenario(base, policy)),
    }));
  }
}
