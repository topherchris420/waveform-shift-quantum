import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { bornProbabilities } from "@/lib/physics";

export default defineTool({
  name: "born_probabilities",
  title: "Born-rule probabilities",
  description:
    "Compute measurement probabilities p(0) and p(1) for a single-qubit state |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩ in the computational basis.",
  inputSchema: {
    theta_rad: z.number().describe("Polar angle θ on the Bloch sphere, in radians."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ theta_rad }) => {
    const { p0, p1 } = bornProbabilities(theta_rad);
    return {
      content: [{ type: "text", text: `p(0) = ${p0.toFixed(6)}, p(1) = ${p1.toFixed(6)}` }],
      structuredContent: { p0, p1 },
    };
  },
});