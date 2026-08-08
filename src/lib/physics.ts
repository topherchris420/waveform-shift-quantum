// Analytical results for the QuantumLab. Kept small and dependency-free so
// every readout in the UI traces back to a real closed-form expression.

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
    return { T: 1 / denom, kappa_a: 0, regime: 'resonant' as const };
  }
  if (E_eV < V_eV) {
    const kappa = K0 * Math.sqrt(V_eV - E_eV);
    const ka = kappa * a_nm;
    const sh = Math.sinh(ka);
    const denom = 1 + (V_eV * V_eV * sh * sh) / (4 * E_eV * (V_eV - E_eV));
    return { T: 1 / denom, kappa_a: ka, regime: 'tunneling' as const };
  }
  const k = K0 * Math.sqrt(E_eV - V_eV);
  const ka = k * a_nm;
  const s = Math.sin(ka);
  const denom = 1 + (V_eV * V_eV * s * s) / (4 * E_eV * (E_eV - V_eV));
  return { T: 1 / denom, kappa_a: ka, regime: 'oscillatory' as const };
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
 * Teleportation fidelity model. Ideal protocol yields F = 1; here we
 * degrade by a Bell-pair purity term to keep the readout meaningful
 * under user tuning.
 */
export function teleportationFidelity(bellPurity: number, decoherence: number) {
  return clamp(bellPurity * (1 - decoherence * 0.5) + 0.25 * (1 - bellPurity));
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
 * Concurrence of a Werner state ρ = p|Φ⁺⟩⟨Φ⁺| + (1-p) I/4.
 * C(ρ) = max(0, (3p − 1) / 2).  Entangled iff p > 1/3.
 */
export function wernerConcurrence(purity: number) {
  return Math.max(0, (3 * purity - 1) / 2);
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

export interface TwoSiteParams {
  EA: number;       // Bare site A energy (eV)
  EB: number;       // Bare site B energy (eV)
  phiA: number;     // Local scalar field value at site A
  phiB: number;     // Local scalar field value at site B
  g: number;        // Matter-scalar coupling strength
  delta: number;    // Inter-site mixing amplitude Δ (eV)
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

