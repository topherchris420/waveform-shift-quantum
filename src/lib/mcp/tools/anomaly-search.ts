import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { searchAnomalies } from "../../anomalyEngine";

export default defineTool({
  name: "anomaly_search",
  title: "Automated Parameter Space Anomaly Search",
  description:
    "Runs an automated numerical parameter space sweep to discover candidate regimes that maximize measurable statistical deviation between Standard QM and the Woodyard model.",
  inputSchema: {
    seed: z.number().default(42).describe("Deterministic PRNG seed."),
    iterations: z.number().positive().max(1000).default(100).describe("Number of parameter regimes to sample and score."),
    experimentType: z
      .enum(["two_site", "scalar_kernel", "teleportation"])
      .optional()
      .describe("Optional experiment filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ seed, iterations, experimentType }) => {
    const candidates = searchAnomalies({ seed, iterations, experimentType });
    const top = candidates.slice(0, 5);
    const text = `Discovered ${candidates.length} candidate anomaly regimes. Top anomaly: ${top[0]?.id} (Score: ${top[0]?.score}, ΔP = ${top[0]?.deltaP.toFixed(4)}, Platform: ${top[0]?.candidatePlatform})`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        totalDiscovered: candidates.length,
        topRegimes: top,
      },
    };
  },
});
