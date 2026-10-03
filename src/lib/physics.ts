// Analytical results for the QuantumLab. Kept small and dependency-free so
// every readout in the UI traces back to a real closed-form expression.

import type { ComparisonDerivation } from './epistemics';

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * Transmission coefficient for a 1D rectangular potential barrier of
 * height V (eV) and width a (nm) for a particle of mass m (electron)
 * and energy E (eV). Non-relativistic Schrödinger regime.
 *
 *  E < V:  T = [1 + V^2 sinh^2(κ a) / (4 E (V-E))]^-1,  κ = sqrt(2m(V-E))/ħ
 *  E > V:  T = [1 + V^2 sin^2 (k a) / (4 E (E-V))]^-1,  k = sqrt(2m(E-V))/ħ
 *  E = V:  T = 1 / (1 + m V a^2 / (2 ħ^2))
 */
export function barrierTransmission(E_eV: number, V_eV: number, a_nm: number) {
  // Convenient prefactor: sqrt(2 m_e * 1 eV) / ħ in nm^-1  ≈ 5.1231
  const K0 = 5.1231; // nm^-1 per sqrt(eV)
  if (Math.abs(E_eV - V_eV) < 1e-6) {
    const denom = 1 + (K0 * K0 * V_eV * a_nm * a_nm) / 4;
    return { T: clamp(1 / denom, 0, 1), kappa_a: 0, regime: 'resonant' as const };
  }
  if (E_eV < V_eV) {
    const kappa = K0 * Math.sqrt(V_eV - E_eV);
    const ka = kappa * a_nm;
    const sh = Math.sinh(ka);
    const denom = 1 + (V_eV * V_eV * sh * sh) / (4 * E_eV * (V_eV - E_eV));
    return { T: clamp(1 / denom, 0, 1), kappa_a: ka, regime: 'tunneling' as const };
  }
  const k = K0 * Math.sqrt(E_eV - V_eV);
  const ka = k * a_nm;
  const s = Math.sin(ka);
  const denom = 1 + (V_eV * V_eV * s * s) / (4 * E_eV * (E_eV - V_eV));
  return { T: clamp(1 / denom, 0, 1), kappa_a: ka, regime: 'oscillatory' as const };
}

/** Fraunhofer double-slit intensity, arbitrary units. */
export function doubleSlitIntensity(y_mm: number, d_um: number, lambda_nm: number, L_mm: number) {
  const theta = Math.atan2(y_mm, L_mm);
  const arg = (Math.PI * (d_um * 1000) * Math.sin(theta)) / lambda_nm;
  return Math.cos(arg) ** 2;
}

/** Born-rule outcome probabilities for |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩. */
export function bornProbabilities(theta: number) {
  const p0 = Math.cos(theta / 2) ** 2;
  return { p0, p1: 1 - p0 };
}

/**
 * Pearson χ² for comparing an observed histogram with expected counts.
 * Used by the Born-rule bench to show convergence to P(i) = |⟨i|ψ⟩|².
 */
export function pearsonChiSquared(observed: number[], expected: number[]) {
  let chi = 0;
  const n = Math.min(observed.length, expected.length);
  for (let i = 0; i < n; i++) {
    if (expected[i] > 0) {
      const residual = observed[i] - expected[i];
      chi += (residual * residual) / expected[i];
    }
  }
  return chi;
}

/**
 * Singlet fraction of a Werner pair ρ = p|Φ⁺⟩⟨Φ⁺| + (1-p)I/4 after a
 * depolarizing channel of strength d. f = [1 + 3p(1-d)] / 4.
 */
export function wernerSingletFraction(purity: number, decoherence = 0) {
  const p = clamp(purity);
  const d = clamp(decoherence);
  return (1 + 3 * p * (1 - d)) / 4;
}

/**
 * Horodecki average teleportation fidelity F = (2f + 1) / 3, where f is
 * the fully entangled fraction of the shared pair (Horodecki, Horodecki &
 * Horodecki, Phys. Rev. A 60, 1888 (1999)). Equivalent closed form:
 * F = [1 + p(1-d)] / 2. Ideal Bell pair (p = 1, d = 0) yields F = 1;
 * the classical Massar–Popescu bound F = 2/3 sits at the Werner
 * entanglement threshold p = 1/3.
 */
export function teleportationFidelity(bellPurity: number, decoherence: number) {
  const f = wernerSingletFraction(bellPurity, decoherence);
  return clamp((2 * f + 1) / 3);
}

export const PAULI_CORRECTIONS = {
  '00': { operator: 'I', description: 'Identity — no correction needed' },
  '01': { operator: 'X', description: 'Bit flip on Bob\'s qubit' },
  '10': { operator: 'Z', description: 'Phase flip on Bob\'s qubit' },
  '11': { operator: 'X·Z', description: 'Bit flip followed by phase flip' },
} as const;

export type PauliBits = keyof typeof PAULI_CORRECTIONS;

/** Bennett-protocol Pauli correction from Alice's two Bell-basis bits. */
export function pauliCorrection(m1: 0 | 1, m2: 0 | 1) {
  const bits = `${m1}${m2}` as PauliBits;
  const { operator, description } = PAULI_CORRECTIONS[bits];
  return { bits, operator, description };
}

/** HSV → HSL string. Used for complex-phase (arg ψ) domain colouring. */
export function phaseColor(phaseRad: number, magnitude = 1) {
  const hue = ((phaseRad / (2 * Math.PI)) * 360 + 360) % 360;
  const light = 32 + magnitude * 42;
  return `hsl(${hue.toFixed(1)} 78% ${light.toFixed(1)}%)`;
}

/** Convert measurement array to a CSV string. */
export function toCSV(rows: { id: number; timestamp: number; value: number; type: string }[]) {
  const header = 'id,t_seconds,value,mode';
  const body = rows.map((r) => `${r.id},${r.timestamp.toFixed(4)},${r.value.toFixed(6)},${r.type}`).join('\n');
  return `${header}\n${body}\n`;
}

/**
 * Concurrence of a Werner state ρ = p|Φ⁺⟩⟨Φ⁺| + (1-p) I/4 after optional
 * depolarizing decoherence d. C = max(0, (3p(1-d) − 1) / 2).
 * Entangled iff the effective purity p(1-d) > 1/3.
 */
export function wernerConcurrence(purity: number, decoherence = 0) {
  const pEff = clamp(purity) * (1 - clamp(decoherence));
  return Math.max(0, (3 * pEff - 1) / 2);
}

/**
 * ⟨ZZ⟩ correlator estimated from a list of two-bit Bell measurements.
 * For |Φ⁺⟩ the ideal value is +1 (m₁ = m₂ always).
 */
export function zzCorrelation(bits: Array<[0 | 1, 0 | 1]>) {
  if (bits.length === 0) return 0;
  const sum = bits.reduce((acc, [a, b]) => acc + (a === b ? 1 : -1), 0);
  return sum / bits.length;
}

/**
 * ============================================================================
 * Woodyard (2026) Field-Modulated Spatial Localization Physics Functions
 * Paper: "Field-Modulated Spatial Localization as a Dynamical Variable"
 * Author: Christopher Woodyard (Vers3Dynamics, 2026)
 * ============================================================================
 */

// Units: every two-site energy is in the simulation energy unit ε₀ (ħ = 1),
// not eV. φ is an unidentified field, so only the product gφ (an energy) is
// fixed; see TWO_SITE_UNITS in ./units.
export interface TwoSiteParams {
  EA: number;       // Bare site A energy (ε₀)
  EB: number;       // Bare site B energy (ε₀)
  phiA: number;     // Local scalar field value at site A (unidentified φ-unit)
  phiB: number;     // Local scalar field value at site B (unidentified φ-unit)
  g: number;        // Matter-scalar coupling strength (ε₀ per φ-unit; uncalibrated)
  delta: number;    // Inter-site mixing amplitude Δ (ε₀)
}

/**
 * The frozen two-site Hamiltonian H = [[E_A + gφ_A, Δ], [Δ, E_B + gφ_B]].
 *
 * Every propagation step builds its matrix here, so structural checks
 * (Hermiticity, finiteness) inspect the matrix that is actually exponentiated.
 */
export function twoSiteHamiltonian(params: TwoSiteParams): [[number, number], [number, number]] {
  const { EA, EB, phiA, phiB, g, delta: Delta } = params;
  return [
    [EA + g * phiA, Delta],
    [Delta, EB + g * phiB],
  ];
}

/**
 * Two-Site Toy Model of Localization Transfer (Paper Section 4 & Eq. 15-19, 28)
 * Hamiltonian: H₂ = [[EA + g*phiA, Δ], [Δ, EB + g*phiB]]
 * Detuning: δ(t) = (EB - EA) + g * (phiB - phiA)
 * Mixing angle: tan(2θ(t)) = 2Δ / δ(t)
 * Lower eigenstate: |−⟩ = cos(θ)|A⟩ - sin(θ)|B⟩
 * Occupation probabilities: PA = cos²(θ), PB = sin²(θ)
 * Imbalance: z(t) = PA - PB = cos(2θ) = δ(t) / sqrt(δ(t)² + 4Δ²)
 */
export function twoSiteModel(params: TwoSiteParams) {
  const { EA, EB, phiA, phiB, g, delta: Delta } = params;
  const detuning = (EB - EA) + g * (phiB - phiA);
  
  // mixing angle θ(t) in [0, π/2]
  // tan(2θ) = 2Δ / detuning
  const theta = 0.5 * Math.atan2(2 * Delta, detuning);
  
  const PA = Math.cos(theta) ** 2;
  const PB = Math.sin(theta) ** 2;
  
  // Occupation imbalance z(t) = PA - PB = cos(2θ) = detuning / sqrt(detuning^2 + 4Δ^2)
  const norm = Math.hypot(detuning, 2 * Delta);
  const z = norm > 0 ? detuning / norm : 0;
  
  // Ground state energy E_minus
  const meanE = 0.5 * ((EA + g * phiA) + (EB + g * phiB));
  const E_minus = meanE - 0.5 * norm;
  const E_plus = meanE + 0.5 * norm;
  
  return {
    detuning,
    theta,
    PA,
    PB,
    z,
    E_minus,
    E_plus,
    norm,
  };
}

/**
 * Standard QM two-site populations (without field modulation, g = 0).
 */
export function computeTwoSitePopulations(EA: number, EB: number, delta: number) {
  return twoSiteModel({ EA, EB, phiA: 0, phiB: 0, g: 0, delta });
}

/**
 * Field-modulated two-site populations (with field modulation g != 0).
 */
export function computeTwoSitePopulationsWithField(params: TwoSiteParams) {
  return twoSiteModel(params);
}

/**
 * Interface for complex numbers z = re + i*im
 */
export interface Complex {
  re: number;
  im: number;
}

export interface TwoSiteStateVector {
  cA: Complex;
  cB: Complex;
}

/**
 * One step of iħ d|ψ>/dt = H|ψ> for a FROZEN (time-independent) Hamiltonian.
 *
 * The step applies the exact 2×2 matrix exponential U(dt) = exp(−iH dt/ħ) of
 * the Hamiltonian it is given, so norm is conserved to rounding error and a
 * time-independent H is propagated with no discretisation error at all.
 *
 * It is NOT an exact solution for a time-dependent H(t). A caller that freezes
 * H(t) at one instant per step (Reality Split samples the midpoint) commits a
 * discretisation error of O(dt²) globally — the exponential midpoint rule. That
 * error belongs to the caller's time discretisation, and is what the timestep
 * convergence ladder measures.
 */
export function evolveTwoSiteState(
  state: TwoSiteStateVector,
  params: TwoSiteParams,
  dt: number,
  hbar = 1.0
): { state: TwoSiteStateVector; PA: number; PB: number; norm: number } {
  const [[H11, H12], [, H22]] = twoSiteHamiltonian(params); // H12 = H21 = Δ, real

  // Matrix decomposition: H = e0 * I + d_x * σ_x + d_z * σ_z
  const e0 = (H11 + H22) / 2;
  const dz = (H11 - H22) / 2;
  const dx = H12;
  const d = Math.hypot(dx, dz);

  // Phase angle for trace: θ_0 = e0 * dt / hbar
  const theta0 = (e0 * dt) / hbar;
  const cos0 = Math.cos(theta0);
  const sin0 = Math.sin(theta0);

  // Exp(-i e0 dt / hbar) = cos0 - i sin0
  // Exp(-i d_vec . σ dt / hbar):
  let cosD = 1;
  let sinD = 0;
  let ux = 0;
  let uz = 0;

  if (d > 1e-12) {
    const thetaD = (d * dt) / hbar;
    cosD = Math.cos(thetaD);
    sinD = Math.sin(thetaD);
    ux = (dx / d) * sinD;
    uz = (dz / d) * sinD;
  }

  // Unitary operator elements: U = exp(-i e0 dt/hbar) * [ cosD I - i (ux σ_x + uz σ_z) ]
  // U11 = (cos0 - i sin0) * (cosD - i uz)
  //     = (cos0*cosD - sin0*uz) + i (-sin0*cosD - cos0*uz)
  const U11_re = cos0 * cosD - sin0 * uz;
  const U11_im = -sin0 * cosD - cos0 * uz;

  // U12 = (cos0 - i sin0) * (-i ux)
  //     = (-sin0 * ux) + i (-cos0 * ux)
  const U12_re = -sin0 * ux;
  const U12_im = -cos0 * ux;

  // U21 = U12
  const U21_re = U12_re;
  const U21_im = U12_im;

  // U22 = (cos0 - i sin0) * (cosD + i uz)
  //     = (cos0*cosD + sin0*uz) + i (-sin0*cosD + cos0*uz)
  const U22_re = cos0 * cosD + sin0 * uz;
  const U22_im = -sin0 * cosD + cos0 * uz;

  // Apply U |ψ>:
  // cA_new = U11 cA + U12 cB
  // cB_new = U21 cA + U22 cB
  const cA_new: Complex = {
    re: U11_re * state.cA.re - U11_im * state.cA.im + U12_re * state.cB.re - U12_im * state.cB.im,
    im: U11_re * state.cA.im + U11_im * state.cA.re + U12_re * state.cB.im + U12_im * state.cB.re,
  };

  const cB_new: Complex = {
    re: U21_re * state.cA.re - U21_im * state.cA.im + U22_re * state.cB.re - U22_im * state.cB.im,
    im: U21_re * state.cA.im + U21_im * state.cA.re + U22_re * state.cB.im + U22_im * state.cB.re,
  };

  const PA = cA_new.re ** 2 + cA_new.im ** 2;
  const PB = cB_new.re ** 2 + cB_new.im ** 2;
  const norm = PA + PB;

  return {
    state: { cA: cA_new, cB: cB_new },
    PA,
    PB,
    norm,
  };
}

export interface LocalizationKernelParams {
  omega0: number;    // Baseline resonance scale ω₀
  beta: number;      // Field coupling coefficient β
  kappa: number;     // Field curvature coefficient κ
  phi: number;       // Auxiliary field value φ(x, t)
  d2phi: number;     // Spatial Laplacian ∇²φ(x, t)
  omega_w: number;   // External drive frequency ω_w
  gamma: number;     // Response linewidth Γ > 0
  alpha: number;     // Dimensionless response strength α
}

/**
 * Normalized Localization Response Kernel (Paper Section 3 & Eq. 9-12)
 * Local resonance: ω_loc(x, t) = ω₀ + β φ(x, t) + κ ∇²φ(x, t)
 * Response profile: L(x, t; ω_w) = (Γ/2)² / [ (ω_w - ω_loc)² + (Γ/2)² ]
 * Normalized kernel: χ(x, t; ω_w) = exp[ α L(x, t; ω_w) ]
 */
export function localizationKernel(params: LocalizationKernelParams) {
  const { omega0, beta, kappa, phi, d2phi, omega_w, gamma, alpha } = params;
  const omega_loc = omega0 + beta * phi + kappa * d2phi;
  
  const halfGamma = gamma / 2;
  const diff = omega_w - omega_loc;
  const L = (halfGamma * halfGamma) / (diff * diff + halfGamma * halfGamma);
  const chi = Math.exp(alpha * L);
  
  return {
    omega_loc,
    L,
    chi,
  };
}

/**
 * Observed Localization Density P_loc(x, t; ω_w) (Paper Eq. 12 & Weak Expansion Eq. 14)
 * P_loc(x) = χ(x) |ψ(x)|² / ∫ χ(x') |ψ(x')|² dx'
 * δP(x) = P_loc(x) - P_B(x) ≈ α P_B(x) [ L(x) - <L>_ψ ]
 */
export function observedLocalizationDensity(
  PB_array: number[],
  kernel_array: { L: number; chi: number }[]
) {
  const n = Math.min(PB_array.length, kernel_array.length);
  if (n === 0) return { Ploc: [], deltaP: [], totalChiPB: 0, meanL: 0 };
  
  let totalChiPB = 0;
  let meanL = 0;
  let totalPB = 0;
  
  for (let i = 0; i < n; i++) {
    totalChiPB += kernel_array[i].chi * PB_array[i];
    meanL += kernel_array[i].L * PB_array[i];
    totalPB += PB_array[i];
  }
  
  const normChiPB = totalChiPB > 0 ? totalChiPB : 1;
  const normPB = totalPB > 0 ? totalPB : 1;
  meanL /= normPB;
  
  const Ploc: number[] = new Array(n);
  const deltaP: number[] = new Array(n);
  
  for (let i = 0; i < n; i++) {
    Ploc[i] = (kernel_array[i].chi * PB_array[i]) / normChiPB;
    deltaP[i] = Ploc[i] - (PB_array[i] / normPB);
  }
  
  return {
    Ploc,
    deltaP,
    totalChiPB,
    meanL,
  };
}

/**
 * Matter-Wave Interferometry Phase Shift Δφ_φ (Paper Section 7.2 & Eq. 29)
 * Δφ_φ = (g / ħ) ∫₀ᵀ [ φ(x₁(t), t) - φ(x₂(t), t) ] dt
 */
export function interferometryPhaseShift(g: number, hbar: number, integratedDeltaPhi: number) {
  return (g / hbar) * integratedDeltaPhi;
}

/**
 * Clock-Comparison Differential Phase Offset ΔΦ_AB(T) (Paper Section 7.3 & Eq. 30)
 * ΔΦ_AB(T) = η ∫₀ᵀ [ φ(xA, t) - φ(xB, t) ] dt
 */
export function clockComparisonPhase(eta: number, integratedFieldDifference: number) {
  return eta * integratedFieldDifference;
}

/**
 * Ehrenfest Dynamics & Effective Classical Potential V_eff(x, t) (Paper Section 6 & Eq. 25-27)
 * V_eff(x, t) = V(x) + g φ(x, t)
 * F_eff = - dV_eff / dx = - dV/dx - g * dφ/dx
 */
export function ehrenfestEffectivePotential(V_bare: number, phi_val: number, g: number) {
  return V_bare + g * phi_val;
}

/**
 * Standard QM vs Woodyard Model Comparison Structure
 */
export interface ModelComparisonResult {
  standardQM: number;
  woodyardModel: number;
  delta: number;
  percentDeviation: number;
  observableName: string;
  assumptions: string[];
  scientificStatus: 'Established' | 'Proposed' | 'Speculative';
  falsificationCondition: string;
  /**
   * How the "woodyardModel" number was produced. Only 'derived_prediction'
   * follows from the model's declared equations; every other category is a
   * choice layered on top and must not be displayed as a model prediction.
   */
  derivation: ComparisonDerivation;
  /** Why this branch carries its derivation category. */
  derivationNote: string;
}

/**
 * Constants used by compareModels' single-point kernel branch. They are NOT
 * declared parameters of the proposed model and differ from the spatial
 * kernel's coefficients in realitySplit.ts (β = 2.0, κ = 0.15, analytic ∇²φ),
 * which is one reason that branch is classified illustrative.
 */
export const ILLUSTRATIVE_KERNEL_COEFFICIENTS = {
  omega0: 10.0,
  beta: 0.5,
  kappa: 0.1,
  /** A fixed stand-in for ∇²φ, not computed from any field profile. */
  d2phi: 0.2,
} as const;

/**
 * Generate a rigorous comparison result between Standard QM and the Woodyard Model
 * for any experiment type and parameter set.
 */
export function compareModels(
  experimentType: string,
  params: {
    g?: number;
    phiA?: number;
    phiB?: number;
    delta?: number;
    alpha?: number;
    gamma?: number;
    omega_w?: number;
    purity?: number;
    decoherence?: number;
  }
): ModelComparisonResult {
  const g = params.g ?? 0.8;
  const phiA = params.phiA ?? -0.6;
  const phiB = params.phiB ?? 0.6;
  const delta = params.delta ?? 0.25;
  const alpha = params.alpha ?? 1.2;

  switch (experimentType) {
    case 'two_site':
    case 'two_site_transfer': {
      const std = twoSiteModel({ EA: 1.0, EB: 1.0, phiA: 0, phiB: 0, g: 0, delta });
      const wood = twoSiteModel({ EA: 1.0, EB: 1.0, phiA, phiB, g, delta });
      const stdVal = std.PB;
      const woodVal = wood.PB;
      const diff = woodVal - stdVal;
      const pct = stdVal !== 0 ? (diff / stdVal) * 100 : 0;
      return {
        standardQM: stdVal,
        woodyardModel: woodVal,
        delta: diff,
        percentDeviation: pct,
        observableName: 'Site B Occupation Probability PB',
        assumptions: [
          'Linear coupling H = H_0 + g φ σ_z',
          'Static potential gradient (φB - φA)',
          'Two-level truncation approximation',
        ],
        scientificStatus: 'Proposed',
        falsificationCondition:
          'With E_B − E_A and Δ independently calibrated, a controlled change of the scalar gradient (φB − φA) that produces no population shift ΔPB beyond a declared, calibrated resolution bounds |g| for that apparatus. Not yet operational: φ has no physical identification and g no calibration, and a static gradient is exactly degenerate with an uncalibrated bare detuning.',
        derivation: 'derived_prediction',
        derivationNote:
          'Lower-eigenstate occupation sin²θ of the declared Hamiltonian (Eq. 15–19), which itself assumes adiabatic ground-state preparation. With E_A = E_B the fixed value 1 ε₀ does not affect populations. Static, so g(φB − φA) acts exactly like a bare detuning.',
      };
    }

    case 'localization':
    case 'scalar_kernel': {
      const kernelRes = localizationKernel({
        ...ILLUSTRATIVE_KERNEL_COEFFICIENTS,
        phi: (phiA + phiB) / 2,
        omega_w: params.omega_w ?? 12.0,
        gamma: params.gamma ?? 1.5,
        alpha,
      });
      const stdVal = 1.0; // Baseline un-modulated kernel factor χ = 1
      const woodVal = kernelRes.chi;
      const diff = woodVal - stdVal;
      const pct = (diff / stdVal) * 100;
      return {
        standardQM: stdVal,
        woodyardModel: woodVal,
        delta: diff,
        percentDeviation: pct,
        observableName: 'Response Kernel Factor χ(x)',
        assumptions: [
          'Lorentzian resonance profile L(x, t; ωw)',
          'Exponential spatial localization response χ = exp(α L)',
          'Narrow drive linewidth Γ',
        ],
        scientificStatus: 'Proposed',
        falsificationCondition:
          'If a calibrated density-profile measurement shows no frequency-selective redistribution of P_loc(x) near ω_w beyond its declared resolution, the kernel model is excluded for those parameters. The bare factor χ shown here is not that observable: a spatially constant χ cancels under normalisation.',
        derivation: 'illustrative_transformation',
        derivationNote:
          'Bare kernel factor χ at one point, using fixed β, κ and ∇²φ constants that are not model parameters. χ is an internal model variable; the model’s observable is the normalised density, computed by kernelRegionSeparation.',
      };
    }

    case 'teleportation': {
      const purity = params.purity ?? 0.98;
      const dec = params.decoherence ?? 0.2;
      const stdVal = teleportationFidelity(purity, dec);
      const woodVal = teleportationFidelity(purity, dec * (1 - alpha * 0.1));
      const diff = woodVal - stdVal;
      const pct = (diff / stdVal) * 100;
      return {
        standardQM: stdVal,
        woodyardModel: woodVal,
        delta: diff,
        percentDeviation: pct,
        observableName: 'Teleportation State Fidelity F',
        assumptions: [
          'Standard Bennett 1993 discrete 3-qubit protocol',
          'Field modulation suppresses local environmental decoherence',
          'Pre-shared Werner state entanglement',
        ],
        scientificStatus: 'Speculative',
        falsificationCondition:
          'Teleportation fidelity remains strictly bounded by standard Werner decoherence without field modulation dependence.',
        derivation: 'speculative_scenario',
        derivationNote:
          'Decoherence is scaled by the heuristic factor (1 − 0.1α). Nothing in the proposed model derives this factor; it shows a hypothetical scenario only.',
      };
    }

    default: {
      const stdVal = 0.5;
      const woodVal = 0.5 + 0.1 * alpha;
      const diff = woodVal - stdVal;
      return {
        standardQM: stdVal,
        woodyardModel: woodVal,
        delta: diff,
        percentDeviation: (diff / stdVal) * 100,
        observableName: 'Matter-Wave Probability',
        assumptions: ['Standard field-modulated spatial coupling'],
        // A placeholder number (0.5 + 0.1α), not a derivation, so it cannot be
        // labelled as a proposed-model result.
        scientificStatus: 'Speculative',
        falsificationCondition:
          'None defined: this placeholder is not derived from the model, so no measurement can test it.',
        derivation: 'illustrative_transformation',
        derivationNote:
          'Fallback placeholder 0.5 + 0.1α for experiment types without a model implementation. It is not a prediction of the proposed model.',
      };
    }
  }
}
