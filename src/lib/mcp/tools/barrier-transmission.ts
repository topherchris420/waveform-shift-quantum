import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { barrierTransmission } from "../../physics";

export default defineTool({
  name: "barrier_transmission",
  title: "1D barrier transmission",
  description:
    "Compute the transmission coefficient T for a non-relativistic electron crossing a 1D rectangular potential barrier. Handles tunneling (E<V), resonant (E=V), and oscillatory (E>V) regimes.",
  inputSchema: {
    energy_eV: z.number().positive().describe("Particle energy E in eV."),
    barrier_eV: z.number().positive().describe("Barrier height V in eV."),
    width_nm: z.number().positive().describe("Barrier width a in nm."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ energy_eV, barrier_eV, width_nm }) => {
    const { T, kappa_a, regime } = barrierTransmission(energy_eV, barrier_eV, width_nm);
    const text = `T = ${T.toExponential(4)} (regime: ${regime}, κa = ${kappa_a.toFixed(4)})`;
    return {
      content: [{ type: "text", text }],
      structuredContent: { transmission: T, reflection: 1 - T, kappa_a, regime },
    };
  },
});