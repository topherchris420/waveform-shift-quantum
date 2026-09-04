import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { twoSiteModel } from "../../physics";

export default defineTool({
  name: "two_site_model",
  title: "Two-Site Localization Transfer (Woodyard 2026)",
  description:
    "Evaluate the field-modulated two-site Hamiltonian H₂ = [[EA + g*phiA, Δ], [Δ, EB + g*phiB]]. Returns detuning δ, mixing angle θ, eigenstate populations PA and PB, and occupation imbalance z = PA - PB.",
  inputSchema: {
    EA: z.number().describe("Bare site A energy in eV."),
    EB: z.number().describe("Bare site B energy in eV."),
    phiA: z.number().describe("Local scalar field at site A."),
    phiB: z.number().describe("Local scalar field at site B."),
    g: z.number().describe("Matter-scalar coupling strength."),
    delta: z.number().positive().describe("Inter-site mixing amplitude Δ in eV."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ EA, EB, phiA, phiB, g, delta }) => {
    const res = twoSiteModel({ EA, EB, phiA, phiB, g, delta });
    const text = `PA = ${res.PA.toFixed(4)}, PB = ${res.PB.toFixed(4)}, z = ${res.z.toFixed(4)} (detuning δ = ${res.detuning.toFixed(3)} eV, θ = ${(res.theta * 180 / Math.PI).toFixed(1)}°)`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        PA: res.PA,
        PB: res.PB,
        occupationImbalance: res.z,
        detuning: res.detuning,
        mixingAngle_deg: (res.theta * 180) / Math.PI,
        groundEnergy_eV: res.E_minus,
        excitedEnergy_eV: res.E_plus,
      },
    };
  },
});
