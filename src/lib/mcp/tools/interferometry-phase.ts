import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { computeInterferometerFringes } from "../../physics";

export default defineTool({
  name: "interferometry_phase_shift",
  title: "Matter-Wave Interferometry Phase Shift",
  description:
    "Calculates the predicted matter-wave interferometric phase shift Δφ = (g/ħ) ∫ [φ(x1,t) - φ(x2,t)] dt and fringe visibility for precision atom interferometry tests of the Woodyard model.",
  inputSchema: {
    armSeparation_um: z.number().positive().describe("Interferometer arm separation Δx in micrometers (μm)."),
    interrogationTime_ms: z.number().positive().describe("Interrogation / drift time T in milliseconds (ms)."),
    fieldGradient_per_um: z.number().describe("Spatial gradient of auxiliary scalar field dφ/dx per μm."),
    coupling_g: z.number().describe("Matter-scalar coupling strength g."),
    dephasingNoise: z.number().nonnegative().default(0).describe("Environmental phase dephasing noise rate."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ armSeparation_um, interrogationTime_ms, fieldGradient_per_um, coupling_g, dephasingNoise }) => {
    const res = computeInterferometerFringes({
      armSeparation_um,
      interrogationTime_ms,
      fieldGradient_per_um,
      coupling_g,
      dephasingNoise,
    });
    const text = `Phase Shift Δφ = ${res.phaseShift_rad.toFixed(4)} rad (${res.phaseShift_deg.toFixed(2)}°), Visibility = ${(res.visibility * 100).toFixed(1)}%, Max Intensity Deviation ΔI = ${(res.maxDelta * 100).toFixed(1)}%`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        phaseShift_rad: res.phaseShift_rad,
        phaseShift_deg: res.phaseShift_deg,
        visibility: res.visibility,
        maxDeltaIntensity: res.maxDelta,
      },
    };
  },
});
