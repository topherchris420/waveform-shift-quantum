// Supabase Edge Function: mcp
// Self-contained Deno server exposing 10 Waveform Shift Quantum Laboratory MCP tools
import { defineMcp, defineTool } from "npm:@lovable.dev/mcp-js@0.24.0";
import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@0.24.0/stacks/supabase";
import { z } from "npm:zod@^4.4.3";

// --- Analytical Physics Helpers ---

function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

function barrierTransmission(E_eV: number, V_eV: number, a_nm: number) {
  const K0 = 5.1231;
  if (Math.abs(E_eV - V_eV) < 1e-6) {
    const denom2 = 1 + (K0 * K0 * V_eV * a_nm * a_nm) / 4;
    return { T: clamp(1 / denom2, 0, 1), kappa_a: 0, regime: "resonant" };
  }
  if (E_eV < V_eV) {
    const kappa = K0 * Math.sqrt(V_eV - E_eV);
    const ka2 = kappa * a_nm;
    const sh = Math.sinh(ka2);
    const denom2 = 1 + (V_eV * V_eV * sh * sh) / (4 * E_eV * (V_eV - E_eV));
    return { T: clamp(1 / denom2, 0, 1), kappa_a: ka2, regime: "tunneling" };
  }
  const k = K0 * Math.sqrt(E_eV - V_eV);
  const ka = k * a_nm;
  const s = Math.sin(ka);
  const denom = 1 + (V_eV * V_eV * s * s) / (4 * E_eV * (E_eV - V_eV));
  return { T: clamp(1 / denom, 0, 1), kappa_a: ka, regime: "oscillatory" };
}

function doubleSlitIntensity(y_mm: number, d_um: number, lambda_nm: number, L_mm: number) {
  const theta = Math.atan2(y_mm, L_mm);
  const arg = (Math.PI * (d_um * 1e3) * Math.sin(theta)) / lambda_nm;
  return Math.cos(arg) ** 2;
}

function bornProbabilities(theta: number) {
  const p0 = Math.cos(theta / 2) ** 2;
  return { p0, p1: 1 - p0 };
}

function teleportationFidelity(bellPurity: number, decoherence: number) {
  return clamp(bellPurity * (1 - decoherence * 0.5) + 0.25 * (1 - bellPurity));
}

function wernerConcurrence(purity: number) {
  return Math.max(0, (3 * purity - 1) / 2);
}

function twoSiteModel(params: {
  EA: number;
  EB: number;
  phiA: number;
  phiB: number;
  g: number;
  delta: number;
}) {
  const { EA, EB, phiA, phiB, g, delta } = params;
  const H_AA = EA + g * phiA;
  const H_BB = EB + g * phiB;
  const H_AB = delta;

  const detuning = H_BB - H_AA;
  const meanEnergy = (H_AA + H_BB) / 2;
  const Omega = Math.sqrt(detuning * detuning + 4 * H_AB * H_AB);

  const E_plus = meanEnergy + Omega / 2;
  const E_minus = meanEnergy - Omega / 2;

  const theta = 0.5 * Math.atan2(2 * H_AB, detuning);

  const PA = Math.cos(theta) ** 2;
  const PB = Math.sin(theta) ** 2;
  const z = PA - PB;
  const norm = PA + PB;

  return {
    detuning,
    Omega,
    E_plus,
    E_minus,
    theta,
    PA,
    PB,
    z,
    norm,
  };
}

function localizationKernel(params: {
  omega0: number;
  beta: number;
  kappa?: number;
  phi: number;
  d2phi?: number;
  omega_w: number;
  gamma: number;
  alpha: number;
}) {
  const { omega0, beta, kappa = 0, phi, d2phi = 0, omega_w, gamma, alpha } = params;
  const omega_loc = omega0 + beta * phi + kappa * d2phi;
  const dOmega = omega_w - omega_loc;
  const halfGamma = gamma / 2;
  const L = (halfGamma * halfGamma) / (dOmega * dOmega + halfGamma * halfGamma);
  const chi = Math.exp(alpha * L);

  return { omega_loc, L, chi };
}

function computeInterferometerFringes(params: {
  armSeparation_um: number;
  interrogationTime_ms: number;
  fieldGradient_per_um: number;
  coupling_g: number;
  dephasingNoise: number;
}) {
  const { armSeparation_um, interrogationTime_ms, fieldGradient_per_um, coupling_g, dephasingNoise } = params;
  const deltaPhiSpatial = fieldGradient_per_um * armSeparation_um;
  const integratedDeltaPhi = deltaPhiSpatial * interrogationTime_ms;
  const phaseShift_rad = (coupling_g / 1.0) * integratedDeltaPhi;
  const phaseShift_deg = (phaseShift_rad * 180) / Math.PI;
  const visibility = Math.exp(-Math.max(0, dephasingNoise) * interrogationTime_ms * 0.5);

  let maxDelta = 0;
  for (let i = 0; i <= 50; i++) {
    const theta = (i / 50) * 2 * Math.PI;
    const stdI = 0.5 * (1 + visibility * Math.cos(theta));
    const modelI = 0.5 * (1 + visibility * Math.cos(theta + phaseShift_rad));
    const deltaI = Math.abs(modelI - stdI);
    if (deltaI > maxDelta) maxDelta = deltaI;
  }

  return {
    phaseShift_rad,
    phaseShift_deg,
    visibility,
    maxDelta,
  };
}

function compareModels(
  experimentType: string,
  params: {
    g?: number;
    phiA?: number;
    phiB?: number;
    delta?: number;
    alpha?: number;
    gamma?: number;
    omega_w?: number;
  }
) {
  const g = params.g ?? 0.8;
  const phiA = params.phiA ?? -0.5;
  const phiB = params.phiB ?? 0.5;
  const delta = params.delta ?? 0.2;

  const std = twoSiteModel({ EA: 1.0, EB: 1.0, phiA: 0, phiB: 0, g: 0, delta });
  const wood = twoSiteModel({ EA: 1.0, EB: 1.0, phiA, phiB, g, delta });

  const diff = wood.PB - std.PB;
  const pct = std.PB > 0 ? (diff / std.PB) * 100 : 0;

  return {
    standardQM: std.PB,
    woodyardModel: wood.PB,
    delta: diff,
    percentDeviation: pct,
    observableName: "Site B Population PB",
    scientificStatus: "proposed" as const,
    assumptions: ["Woodyard (2026) scalar field coupling g"],
    falsificationCondition: "Deviations ΔPB < 10⁻⁴ under calibrated field gradients exclude g > 10⁻³.",
  };
}

function searchAnomalies(options: { seed?: number; iterations?: number } = {}) {
  const seed = options.seed ?? 42;
  const iterations = options.iterations ?? 50;
  let s = seed;
  const prng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const results = [];
  for (let i = 0; i < iterations; i++) {
    const g = 0.1 + prng() * 1.9;
    const delta = 0.05 + prng() * 0.45;
    const phiA = -1.0 + prng() * 2.0;
    const phiB = -1.0 + prng() * 2.0;

    const std = twoSiteModel({ EA: 1.0, EB: 1.0, phiA: 0, phiB: 0, g: 0, delta });
    const wood = twoSiteModel({ EA: 1.0, EB: 1.0, phiA, phiB, g, delta });
    const deltaP = Math.abs(wood.PB - std.PB);
    const score = Math.round(deltaP * 1000) / 10;

    results.push({
      id: `ANOM-${(i + 1).toString().padStart(3, "0")}`,
      score,
      deltaP,
      candidatePlatform: deltaP > 0.3 ? "Atom Interferometry" : "Quantum Dot Array",
      parameters: { g, delta, phiA, phiB },
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// --- 10 MCP Tools ---

const barrier_transmission = defineTool({
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

const double_slit_intensity = defineTool({
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

const born_probabilities = defineTool({
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

const teleportation_fidelity = defineTool({
  name: "teleportation_fidelity",
  title: "Teleportation fidelity",
  description:
    "Estimate the average teleportation fidelity F using a Werner Bell-pair of purity p degraded by a decoherence factor d ∈ [0, 1]. Also returns the Werner concurrence of the shared pair.",
  inputSchema: {
    bell_purity: z.number().min(0).max(1).describe("Bell-pair Werner purity p ∈ [0, 1]."),
    decoherence: z.number().min(0).max(1).describe("Decoherence factor d ∈ [0, 1] (0 = ideal)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ bell_purity, decoherence }) => {
    const F = teleportationFidelity(bell_purity, decoherence);
    const C = wernerConcurrence(bell_purity);
    return {
      content: [{ type: "text", text: `F = ${F.toFixed(6)}, concurrence C = ${C.toFixed(6)}` }],
      structuredContent: { fidelity: F, concurrence: C, entangled: C > 0 },
    };
  },
});

const OPERATORS: Record<string, { op: string; description: string }> = {
  "00": { op: "I", description: "Identity — no correction needed" },
  "01": { op: "X", description: "Bit flip on Bob's qubit" },
  "10": { op: "Z", description: "Phase flip on Bob's qubit" },
  "11": { op: "X·Z", description: "Bit flip followed by phase flip" },
};

const pauli_correction = defineTool({
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
    const key = `${m1}${m2}`;
    const { op, description } = OPERATORS[key];
    return {
      content: [{ type: "text", text: `Measurement ${key} → apply ${op} (${description})` }],
      structuredContent: { bits: key, operator: op, description },
    };
  },
});

const two_site_model = defineTool({
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
    const text = `PA = ${res.PA.toFixed(4)}, PB = ${res.PB.toFixed(4)}, z = ${res.z.toFixed(4)} (detuning δ = ${res.detuning.toFixed(3)} eV, θ = ${((res.theta * 180) / Math.PI).toFixed(1)}°)`;
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

const localization_kernel = defineTool({
  name: "localization_kernel",
  title: "Woodyard Localization Kernel χ(x)",
  description:
    "Calculates the Woodyard (2026) spatial localization response profile L(x, t; ωw) and exponential response kernel factor χ(x) = exp[α L(x)].",
  inputSchema: {
    omega0: z.number().describe("Baseline resonance frequency ω₀ (e.g. GHz)."),
    beta: z.number().describe("Scalar field coupling coefficient β."),
    kappa: z.number().default(0).describe("Field curvature coefficient κ."),
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

const interferometry_phase = defineTool({
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

const compare_models = defineTool({
  name: "compare_models",
  title: "Dual Model Comparison & Falsification Checker",
  description:
    "Compares standard Quantum Mechanics predictions against the Woodyard (2026) field-modulated model across experiment modes, computing measurable delta, percent deviation, and explicit falsification conditions.",
  inputSchema: {
    experimentType: z
      .enum(["two_site", "scalar_kernel", "teleportation", "interferometry"])
      .describe("Laboratory experiment mode to evaluate."),
    g: z.number().optional().describe("Matter-scalar coupling strength g."),
    phiA: z.number().optional().describe("Scalar field at site A."),
    phiB: z.number().optional().describe("Scalar field at site B."),
    delta: z.number().optional().describe("Inter-site mixing amplitude Δ."),
    alpha: z.number().optional().describe("Response strength α."),
    gamma: z.number().optional().describe("Linewidth Γ."),
    omega_w: z.number().optional().describe("Drive frequency ω_w."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (params) => {
    const res = compareModels(params.experimentType, params);
    const text = `${res.observableName}: Standard QM = ${res.standardQM.toFixed(4)}, Woodyard = ${res.woodyardModel.toFixed(4)}, Δ = ${res.delta.toFixed(4)} (${res.percentDeviation.toFixed(2)}%). Status: ${res.scientificStatus}. Falsification: ${res.falsificationCondition}`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        standardQM: res.standardQM,
        woodyardModel: res.woodyardModel,
        delta: res.delta,
        percentDeviation: res.percentDeviation,
        observableName: res.observableName,
        scientificStatus: res.scientificStatus,
        assumptions: res.assumptions,
        falsificationCondition: res.falsificationCondition,
      },
    };
  },
});

const anomaly_search = defineTool({
  name: "anomaly_search",
  title: "Automated Parameter Space Anomaly Search",
  description:
    "Runs an automated numerical parameter space sweep to discover candidate regimes that maximize measurable statistical deviation between Standard QM and the Woodyard model.",
  inputSchema: {
    seed: z.number().default(42).describe("Deterministic PRNG seed."),
    iterations: z
      .number()
      .positive()
      .max(1000)
      .default(50)
      .describe("Number of parameter regimes to sample and score."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ seed, iterations }) => {
    const candidates = searchAnomalies({ seed, iterations });
    const top = candidates.slice(0, 5);
    const text = `Discovered ${candidates.length} candidate anomaly regimes. Top anomaly: ${top[0]?.id} (Score: ${top[0]?.score}, ΔP = ${top[0]?.deltaP.toFixed(4)}, Platform: ${top[0]?.candidatePlatform})`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        totalDiscovered: candidates.length,
        topRegimes: top,
      },
    };
  },
});

// --- MCP Server Definition ---

const mcp = defineMcp({
  name: "waveform-shift-quantum-mcp",
  title: "Waveform Shift Quantum Laboratory MCP Server",
  version: "0.2.0",
  instructions:
    "Analytical quantum physics and Woodyard (2026) field-modulated spatial localization tools backing the Waveform Shift Quantum Laboratory. Exposes barrier_transmission, double_slit_intensity, born_probabilities, teleportation_fidelity, pauli_correction, two_site_model, localization_kernel, interferometry_phase_shift, compare_models, and anomaly_search.",
  tools: [
    barrier_transmission,
    double_slit_intensity,
    born_probabilities,
    teleportation_fidelity,
    pauli_correction,
    two_site_model,
    localization_kernel,
    interferometry_phase,
    compare_models,
    anomaly_search,
  ],
});

Deno.serve(createSupabaseHandler(mcp, { functionName: "mcp" }));
export default mcp;
