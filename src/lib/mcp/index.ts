import { defineMcp } from "@lovable.dev/mcp-js";
import barrierTransmissionTool from "./tools/barrier-transmission";
import doubleSlitIntensityTool from "./tools/double-slit-intensity";
import bornProbabilitiesTool from "./tools/born-probabilities";
import teleportationFidelityTool from "./tools/teleportation-fidelity";
import pauliCorrectionTool from "./tools/pauli-correction";
import twoSiteModelTool from "./tools/two-site-model";
import localizationKernelTool from "./tools/localization-kernel";
import interferometryPhaseTool from "./tools/interferometry-phase";
import compareModelsTool from "./tools/compare-models";
import anomalySearchTool from "./tools/anomaly-search";

export default defineMcp({
  name: "waveform-shift-quantum-mcp",
  title: "Waveform Shift Quantum Laboratory MCP Server",
  version: "0.2.0",
  instructions:
    "Analytical quantum physics and Woodyard (2026) field-modulated spatial localization tools backing the Waveform Shift Quantum Laboratory. Tools provide calculations for standard quantum mechanics (tunneling, Born probabilities, double slit, teleportation, Werner concurrence) as well as the proposed Woodyard (2026) field-modulated localization model (two-site Hamiltonian transfer, spatial response kernel, matter-wave interferometry phase shifts, dual-model comparison, and anomaly parameter searches).",
  tools: [
    barrierTransmissionTool,
    doubleSlitIntensityTool,
    bornProbabilitiesTool,
    teleportationFidelityTool,
    pauliCorrectionTool,
    twoSiteModelTool,
    localizationKernelTool,
    interferometryPhaseTool,
    compareModelsTool,
    anomalySearchTool,
  ],
});