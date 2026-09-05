import { defineMcp } from "@lovable.dev/mcp-js";
import barrierTransmissionTool from "./tools/barrier-transmission";
import doubleSlitIntensityTool from "./tools/double-slit-intensity";
import bornProbabilitiesTool from "./tools/born-probabilities";
import teleportationFidelityTool from "./tools/teleportation-fidelity";
import pauliCorrectionTool from "./tools/pauli-correction";

export default defineMcp({
  name: "vers3dynamics-teleportation-mcp",
  title: "Vers3Dynamics Teleportation",
  version: "0.1.0",
  instructions:
    "Analytical quantum-mechanics tools backing the Vers3Dynamics Teleportation lab. Use `barrier_transmission` for 1D rectangular-barrier transmission (tunneling/resonant/oscillatory), `double_slit_intensity` for Fraunhofer double-slit fringes, `born_probabilities` for single-qubit measurement probabilities, `teleportation_fidelity` for Werner-state teleportation fidelity and concurrence, and `pauli_correction` to look up the Pauli operator required for a given pair of Bell-basis measurement bits.",
  tools: [
    barrierTransmissionTool,
    doubleSlitIntensityTool,
    bornProbabilitiesTool,
    teleportationFidelityTool,
    pauliCorrectionTool,
  ],
});