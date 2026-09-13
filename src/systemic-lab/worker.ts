import { createPolicyPassport, replaySimulation } from "./passport";
import {
  policyScenario,
  POLICY_VARIANTS,
  type PolicyVariant,
} from "./counterfactuals";
import {
  runEnsemble,
  policyRobustness,
  runLayerAblation,
  calibrateParameter,
  runHoldout,
  type CalibrationDataset,
  type EnsembleConfig,
  type FrozenPolicyClaim,
  type ResearchParameter,
} from "./research";
import {
  compareHypotheses,
  initializeScenarioFromSystemicSignal,
} from "./bridge";
import { runNineQuarterScenario } from "./adapters";
import type { Scenario } from "./types";
export type LabRequest =
  | { task: "run"; scenario: Scenario }
  | { task: "compare"; scenario: Scenario; variants: PolicyVariant[] }
  | { task: "ensemble"; scenario: Scenario; config: EnsembleConfig }
  | { task: "robustness"; scenario: Scenario; candidate: PolicyVariant }
  | { task: "ablation"; scenario: Scenario }
  | {
      task: "calibrate";
      scenario: Scenario;
      parameter: ResearchParameter;
      grid: number[];
      dataset: CalibrationDataset;
    }
  | { task: "holdout"; claim: FrozenPolicyClaim }
  | { task: "hypotheses"; scenario: Scenario; signal: unknown; target: string }
  | { task: "macro"; scenario: Scenario; path: unknown }
  | { task: "replay"; passport: unknown };
export async function executeLabTask(
  message: LabRequest,
  progress?: (done: number, total: number) => void,
): Promise<unknown> {
  switch (message.task) {
    case "run":
      return createPolicyPassport(message.scenario);
    case "compare": {
      if (
        !message.variants.length ||
        message.variants.length > POLICY_VARIANTS.length ||
        message.variants.some((v) => !POLICY_VARIANTS.includes(v)) ||
        new Set(message.variants).size !== message.variants.length
      )
        throw new Error("Invalid counterfactual list");
      const rows = [];
      for (const [i, policy] of message.variants.entries()) {
        rows.push({
          policy,
          passport: await createPolicyPassport(
            policyScenario(message.scenario, policy),
          ),
        });
        progress?.(i + 1, message.variants.length);
      }
      return rows;
    }
    case "ensemble":
      return runEnsemble(message.scenario, message.config, progress);
    case "robustness":
      return policyRobustness(message.scenario, "none", message.candidate);
    case "ablation":
      return runLayerAblation(message.scenario, [101, 211]);
    case "calibrate":
      return calibrateParameter(
        message.scenario,
        message.parameter,
        message.grid,
        message.dataset,
      );
    case "holdout":
      return runHoldout(message.claim);
    case "hypotheses":
      return compareHypotheses(
        initializeScenarioFromSystemicSignal(
          message.signal,
          message.scenario,
          message.target,
        ),
      );
    case "macro":
      return runNineQuarterScenario(message.scenario, message.path);
    case "replay":
      return replaySimulation(message.passport);
  }
}
// Worker module has no network or telemetry. Imports are static, bundled dependencies.
if (typeof document === "undefined" && typeof self !== "undefined")
  self.onmessage = async (e: MessageEvent<LabRequest>) => {
    try {
      const data = await executeLabTask(e.data, (done, total) =>
        self.postMessage({ kind: "progress", done, total }),
      );
      self.postMessage({ kind: "result", task: e.data.task, data });
    } catch (error) {
      self.postMessage({
        kind: "error",
        message: error instanceof Error ? error.message : "Experiment failed",
      });
    }
  };
