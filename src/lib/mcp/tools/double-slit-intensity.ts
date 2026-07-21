import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { doubleSlitIntensity } from "@/lib/physics";

export default defineTool({
  name: "double_slit_intensity",
  title: "Double-slit intensity",
  description:
    "Fraunhofer double-slit intensity (arbitrary units, normalized to 1) at screen position y for slit separation d, wavelength λ, and screen distance L.",
  inputSchema: {
    y_mm: z.number().describe("Screen position y in millimeters (may be negative)."),
    slit_separation_um: z.number().positive().describe("Slit separation d in micrometers."),
    wavelength_nm: z.number().positive().describe("Wavelength λ in nanometers."),
    screen_distance_mm: z.number().positive().describe("Slit-to-screen distance L in millimeters."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ y_mm, slit_separation_um, wavelength_nm, screen_distance_mm }) => {
    const I = doubleSlitIntensity(y_mm, slit_separation_um, wavelength_nm, screen_distance_mm);
    return {
      content: [{ type: "text", text: `I/I₀ = ${I.toFixed(6)} at y = ${y_mm} mm` }],
      structuredContent: { intensity: I },
    };
  },
});