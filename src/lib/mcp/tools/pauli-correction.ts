import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const OPERATORS = {
  "00": { op: "I", description: "Identity — no correction needed" },
  "01": { op: "X", description: "Bit flip on Bob's qubit" },
  "10": { op: "Z", description: "Phase flip on Bob's qubit" },
  "11": { op: "X·Z", description: "Bit flip followed by phase flip" },
} as const;

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
    const key = `${m1}${m2}` as keyof typeof OPERATORS;
    const { op, description } = OPERATORS[key];
    return {
      content: [{ type: "text", text: `Measurement ${key} → apply ${op} (${description})` }],
      structuredContent: { bits: key, operator: op, description },
    };
  },
});