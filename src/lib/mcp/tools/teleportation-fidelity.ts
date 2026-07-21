import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { teleportationFidelity, wernerConcurrence } from "../../physics";

export default defineTool({
  name: "teleportation_fidelity",
  title: "Teleportation fidelity",
  description:
    "Estimate the average teleportation fidelity F using a Werner Bell-pair of purity p degraded by a decoherence factor d ∈ [0, 1]. Also returns the Werner concurrence of the shared pair.",
  inputSchema: {
    bell_purity: z.number().min(0).max(1).describe("Bell-pair Werner purity p ∈ [0, 1]."),
    decoherence: z.number().min(0).max(1).describe("Decoherence factor d ∈ [0, 1] (0 = ideal)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ bell_purity, decoherence }) => {
    const F = teleportationFidelity(bell_purity, decoherence);
    const C = wernerConcurrence(bell_purity);
    return {
      content: [{ type: "text", text: `F = ${F.toFixed(6)}, concurrence C = ${C.toFixed(6)}` }],
      structuredContent: { fidelity: F, concurrence: C, entangled: C > 0 },
    };
  },
});