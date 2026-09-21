import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { pauliCorrection } from "../../physics";

export default defineTool({
  name: "pauli_correction",
  title: "Teleportation Pauli correction",
  description:
    "Given Alice's two classical measurement bits (m1, m2) from a Bell-basis measurement in the standard quantum teleportation protocol, return the Pauli correction Bob must apply to recover |ψ⟩.",
  inputSchema: {
    m1: z.union([z.literal(0), z.literal(1)]).describe("First Bell-basis bit m1."),
    m2: z.union([z.literal(0), z.literal(1)]).describe("Second Bell-basis bit m2."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ m1, m2 }) => {
    const result = pauliCorrection(m1, m2);
    return {
      content: [{ type: "text", text: `Measurement ${result.bits} → apply ${result.operator} (${result.description})` }],
      structuredContent: result,
    };
  },
});