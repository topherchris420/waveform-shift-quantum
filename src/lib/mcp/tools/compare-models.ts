import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { compareModels } from "../../physics";

export default defineTool({
  name: "compare_models",
  title: "Dual Model Comparison & Falsification Checker",
  description:
    "Compares standard Quantum Mechanics predictions against the Woodyard (2026) field-modulated model across experiment modes, computing measurable delta, percent deviation, and explicit falsification conditions.",
  inputSchema: {
    experimentType: z
      .enum(["two_site", "scalar_kernel", "teleportation", "interferometry"])
      .describe("Laboratory experiment mode to evaluate."),
    g: z.number().optional().describe("Matter-scalar coupling strength g."),
    phiA: z.number().optional().describe("Scalar field at site A."),
    phiB: z.number().optional().describe("Scalar field at site B."),
    delta: z.number().optional().describe("Inter-site mixing amplitude Δ."),
    alpha: z.number().optional().describe("Response strength α."),
    gamma: z.number().optional().describe("Linewidth Γ."),
    omega_w: z.number().optional().describe("Drive frequency ω_w."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (params) => {
    const res = compareModels(params.experimentType, params);
    const text = `${res.observableName}: Standard QM = ${res.standardQM.toFixed(4)}, Woodyard = ${res.woodyardModel.toFixed(4)}, Δ = ${res.delta.toFixed(4)} (${res.percentDeviation.toFixed(2)}%). Status: ${res.scientificStatus}. Falsification: ${res.falsificationCondition}`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        standardQM: res.standardQM,
        woodyardModel: res.woodyardModel,
        delta: res.delta,
        percentDeviation: res.percentDeviation,
        observableName: res.observableName,
        scientificStatus: res.scientificStatus,
        assumptions: res.assumptions,
        falsificationCondition: res.falsificationCondition,
      },
    };
  },
});
