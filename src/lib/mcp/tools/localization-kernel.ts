import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { localizationKernel } from "../../physics";

export default defineTool({
  name: "localization_kernel",
  title: "Woodyard Localization Kernel χ(x)",
  description:
    "Calculates the Woodyard (2026) spatial localization response profile L(x, t; ωw) and exponential response kernel factor χ(x) = exp[α L(x)].",
  inputSchema: {
    omega0: z.number().describe("Baseline resonance frequency ω₀ (e.g. GHz)."),
    beta: z.number().describe("Scalar field coupling coefficient β."),
    kappa: z.number().default(0).describe("Field curvature coefficient κ (spatial Laplacian coupling)."),
    phi: z.number().describe("Scalar field value φ(x, t)."),
    d2phi: z.number().default(0).describe("Scalar field Laplacian ∇²φ(x, t)."),
    omega_w: z.number().describe("External drive frequency ω_w."),
    gamma: z.number().positive().describe("Response linewidth Γ > 0."),
    alpha: z.number().describe("Dimensionless response strength α."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ omega0, beta, kappa, phi, d2phi, omega_w, gamma, alpha }) => {
    const res = localizationKernel({
      omega0,
      beta,
      kappa,
      phi,
      d2phi,
      omega_w,
      gamma,
      alpha,
    });
    const text = `χ(x) = ${res.chi.toFixed(4)}, L(x) = ${res.L.toFixed(4)}, ω_loc = ${res.omega_loc.toFixed(2)}`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        kernelFactor_chi: res.chi,
        responseProfile_L: res.L,
        localResonance_omega: res.omega_loc,
      },
    };
  },
});
