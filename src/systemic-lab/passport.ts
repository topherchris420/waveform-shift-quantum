import { z } from "zod";
import { sha256Text } from "../lib/passport/canonical";
import { runPolicySimulation } from "./engine";
import { MODEL_CARDS } from "./modelCards";
import { parseBoundedJSON, parseScenario, ScenarioSchema } from "./schema";
import {
  MODEL_VERSION,
  type PolicySimulationResult,
  type Scenario,
} from "./types";
export const EXACT_CANONICAL_VERSION = "exact-json-number.v1";
/** Sorted-key JSON with round-trip IEEE-754 numbers; unlike physics e13, no precision rounding. */
export function exactCanonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite canonical value");
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(exactCanonical).join(",")}]`;
  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${exactCanonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  throw new Error("Only finite plain JSON can be canonicalized");
}
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const PassportSchema = z.strictObject({
  schema: z.literal("policy-simulation-passport.v1"),
  canonicalVersion: z.literal(EXACT_CANONICAL_VERSION),
  runId: z.string().regex(/^policy-[a-f0-9]{16}$/),
  repository: z.literal(
    "https://github.com/topherchris420/waveform-shift-quantum",
  ),
  sourceCommit: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
  buildVersion: z.literal(MODEL_VERSION),
  generatedAt: z.iso.datetime(),
  scenario: ScenarioSchema,
  inputHash: hex,
  outcomeHash: hex,
  outcome: z.unknown(),
  modelCards: z.array(z.unknown()).min(8).max(8),
  robustnessStatus: z.literal("NOT_EVALUATED"),
  falsificationStatus: z.literal("NOT_EVALUATED"),
  replayBoundary: z.literal(
    "Exact deterministic replay with matching model version and JavaScript arithmetic; content integrity does not validate a model or policy.",
  ),
  identityHash: hex,
});
export interface PolicySimulationPassport {
  schema: "policy-simulation-passport.v1";
  canonicalVersion: typeof EXACT_CANONICAL_VERSION;
  runId: string;
  repository: "https://github.com/topherchris420/waveform-shift-quantum";
  sourceCommit: string;
  buildVersion: typeof MODEL_VERSION;
  generatedAt: string;
  scenario: Scenario;
  inputHash: string;
  outcomeHash: string;
  outcome: PolicySimulationResult;
  modelCards: typeof MODEL_CARDS;
  robustnessStatus: "NOT_EVALUATED";
  falsificationStatus: "NOT_EVALUATED";
  replayBoundary: "Exact deterministic replay with matching model version and JavaScript arithmetic; content integrity does not validate a model or policy.";
  identityHash: string;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export async function createPolicyPassport(
  input: Scenario,
): Promise<PolicySimulationPassport> {
  const scenario = parseScenario(input),
    outcome = runPolicySimulation(scenario);
  const inputHash = await sha256Text(exactCanonical(scenario)),
    outcomeHash = await sha256Text(exactCanonical(outcome));
  const identity = {
    schema: "policy-simulation-passport.v1" as const,
    canonicalVersion: EXACT_CANONICAL_VERSION as typeof EXACT_CANONICAL_VERSION,
    runId: `policy-${inputHash.slice(0, 16)}`,
    repository:
      "https://github.com/topherchris420/waveform-shift-quantum" as const,
    sourceCommit:
      typeof __SOURCE_COMMIT__ === "string" &&
      /^[a-f0-9]{40}$/.test(__SOURCE_COMMIT__)
        ? __SOURCE_COMMIT__
        : "unknown",
    buildVersion: MODEL_VERSION as typeof MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    scenario,
    inputHash,
    outcomeHash,
    outcome,
    modelCards: structuredClone(MODEL_CARDS),
    robustnessStatus: "NOT_EVALUATED" as const,
    falsificationStatus: "NOT_EVALUATED" as const,
    replayBoundary:
      "Exact deterministic replay with matching model version and JavaScript arithmetic; content integrity does not validate a model or policy." as const,
  };
  const identityHash = await sha256Text(exactCanonical(identity));
  return freeze({ ...identity, identityHash });
}
export async function verifyPolicyPassport(value: unknown): Promise<boolean> {
  try {
    const p = PassportSchema.parse(value);
    parseScenario(p.scenario);
    const { identityHash, ...identity } = p;
    return (
      p.runId === `policy-${p.inputHash.slice(0, 16)}` &&
      p.inputHash === (await sha256Text(exactCanonical(p.scenario))) &&
      p.outcomeHash === (await sha256Text(exactCanonical(p.outcome))) &&
      identityHash === (await sha256Text(exactCanonical(identity)))
    );
  } catch {
    return false;
  }
}
export async function replaySimulation(value: unknown): Promise<{
  equivalent: boolean;
  result: PolicySimulationResult;
  expectedOutcomeHash: string;
  actualOutcomeHash: string;
  interpretation: string;
}> {
  if (!(await verifyPolicyPassport(value)))
    throw new Error("Passport content integrity or schema validation failed");
  const p = PassportSchema.parse(value);
  const result = runPolicySimulation(parseScenario(p.scenario));
  const actualOutcomeHash = await sha256Text(exactCanonical(result));
  return {
    equivalent: actualOutcomeHash === p.outcomeHash,
    result,
    expectedOutcomeHash: p.outcomeHash,
    actualOutcomeHash,
    interpretation:
      "Replay equivalence verifies deterministic calculation under the recorded model. It does not establish empirical correctness or institutional endorsement.",
  };
}
export function parsePassportFile(text: string): unknown {
  return parseBoundedJSON(text, 40_000_000);
}
