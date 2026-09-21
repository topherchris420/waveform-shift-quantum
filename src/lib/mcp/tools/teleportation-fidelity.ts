import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { teleportationFidelity, wernerConcurrence, wernerSingletFraction } from "../../physics";

export default defineTool({
  name: "teleportation_fidelity",
  title: "Teleportation fidelity",
  description:
    "Horodecki average teleportation fidelity F = (2f+1)/3 for a Werner Bell pair of purity p degraded by depolarizing decoherence d ∈ [0, 1], where f = [1+3p(1-d)]/4 is the singlet fraction. Also returns concurrence.",
  inputSchema: {
    bell_purity: z.number().min(0).max(1).describe("Bell-pair Werner purity p ∈ [0, 1]."),
    decoherence: z.number().min(0).max(1).describe("Decoherence factor d ∈ [0, 1] (0 = ideal)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ bell_purity, decoherence }) => {
    const F = teleportationFidelity(bell_purity, decoherence);
    const C = wernerConcurrence(bell_purity, decoherence);
    const f = wernerSingletFraction(bell_purity, decoherence);
    return {
      content: [{ type: "text", text: `F = ${F.toFixed(6)} (Horodecki), singlet fraction f = ${f.toFixed(6)}, concurrence C = ${C.toFixed(6)}` }],
      structuredContent: { fidelity: F, concurrence: C, singlet_fraction: f, entangled: C > 0, formula: "(2f+1)/3" },
    };
  },
});