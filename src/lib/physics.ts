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
 * Numerical Time Evolution of Two-Site Hamiltonian iħ d|ψ>/dt = H(t)|ψ>
 * Uses exact 2x2 unitary matrix propagator U(dt) = exp(-i H dt / ħ).
 * This guarantees strict norm conservation: |cA(t)|² + |cB(t)|² = 1.0.
 */
export function evolveTwoSiteState(
  state: TwoSiteStateVector,
  params: TwoSiteParams,
  dt: number,
  hbar = 1.0
): { state: TwoSiteStateVector; PA: number; PB: number; norm: number } {
  const { EA, EB, phiA, phiB, g, delta: Delta } = params;
  const H11 = EA + g * phiA;
  const H22 = EB + g * phiB;
  const H12 = Delta; // real off-diagonal coupling

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
}

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
          'Absence of population shift ΔPB under non-zero scalar gradient (φB - φA) within 1e-4 experimental noise floor excludes model coupling g.',
      };
    }

    case 'localization':
    case 'scalar_kernel': {
      const kernelRes = localizationKernel({
        omega0: 10.0,
        beta: 0.5,
        kappa: 0.1,
        phi: (phiA + phiB) / 2,
        d2phi: 0.2,
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
          'If matter-wave density profile P_loc(x) shows zero frequency-selective enhancement near ω_w, the non-linear response kernel model is falsified.',
      };
    }

    case 'signatures':
    case 'interferometry': {
      const g_val = g;
      const dPhi = (phiB - phiA);
      const T = 2.0; // standard interrogation time ms
      const phaseShift = interferometryPhaseShift(g_val, 1.0, dPhi * T);
      const stdFringe = 0.5; // at midpoint θ = π/2
      const woodFringe = 0.5 * (1 + Math.cos(Math.PI / 2 + phaseShift));
      const diff = woodFringe - stdFringe;
      const pct = (diff / stdFringe) * 100;
      return {
        standardQM: stdFringe,
        woodyardModel: woodFringe,
        delta: diff,
        percentDeviation: pct,
        observableName: 'Interferometric Fringe Shift Δφ_φ',
        assumptions: [
          'Two-path Mach-Zehnder matter-wave geometry',
          'Linear scalar phase accumulation Δφ = (g/ħ) ∫ Δφ dt',
          'Negligible gravitational gradient cross-talk',
        ],
        scientificStatus: 'Prediction',
        falsificationCondition:
          'Zero fringe shift |Δφ| < 10⁻⁴ rad under verified scalar gradient excludes matter-scalar coupling strength g.',
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
        scientificStatus: 'Proposed',
        falsificationCondition:
          'Absence of measurable deviation ΔP in matter-wave interferometry.',
      };
    }
  }
}

/**
 * ============================================================================
 * Quantum State Tomography & Density Matrix (ρ) Analytics
 * ============================================================================
 */

export interface DensityMatrix2x2 {
  rho00: Complex;
  rho01: Complex;
  rho10: Complex;
  rho11: Complex;
}

/** Construct 2x2 Density Matrix ρ = |ψ⟩⟨ψ| from state vector */
export function stateToDensityMatrix(state: TwoSiteStateVector): DensityMatrix2x2 {
  const { cA, cB } = state;
  // |cA|²
  const rho00: Complex = { re: cA.re * cA.re + cA.im * cA.im, im: 0 };
  // cA * cB*
  const rho01: Complex = {
    re: cA.re * cB.re + cA.im * cB.im,
    im: -cA.re * cB.im + cA.im * cB.re,
  };
  // cB * cA* = rho01*
  const rho10: Complex = {
    re: rho01.re,
    im: -rho01.im,
  };
  // |cB|²
  const rho11: Complex = { re: cB.re * cB.re + cB.im * cB.im, im: 0 };

  return { rho00, rho01, rho10, rho11 };
}

export interface DensityMatrixMetrics {
  trace: number;
  purity: number;
  coherence: number;
  entropy: number;
  isHermitian: boolean;
  isPositiveSemiDefinite: boolean;
  eigenvalues: [number, number];
}

/** Calculate full physical invariants and metrics of a 2x2 density matrix */
export function densityMatrixMetrics(rho: DensityMatrix2x2): DensityMatrixMetrics {
  const tr = rho.rho00.re + rho.rho11.re;
  const coh = Math.hypot(rho.rho01.re, rho.rho01.im);

  // Tr(ρ²) = rho00² + rho11² + 2|rho01|²
  const purity = rho.rho00.re * rho.rho00.re + rho.rho11.re * rho.rho11.re + 2 * coh * coh;

  // Eigenvalues of Hermitian 2x2 matrix: λ = 0.5 * (Tr ± sqrt(Tr² - 4*det))
  // det(ρ) = rho00 * rho11 - |rho01|²
  const det = rho.rho00.re * rho.rho11.re - coh * coh;
  const discriminant = Math.max(0, tr * tr - 4 * det);
  const sqrtDisc = Math.sqrt(discriminant);
  const lambda1Raw = 0.5 * (tr + sqrtDisc);
  const lambda2Raw = 0.5 * (tr - sqrtDisc);
  const lambda1 = clamp(lambda1Raw, 0, 1);
  const lambda2 = clamp(lambda2Raw, 0, 1);

  // Von Neumann entropy S(ρ) = - Σ λ_i ln(λ_i) (in base e or nats)
  let entropy = 0;
  if (lambda1 > 1e-12) entropy -= lambda1 * Math.log(lambda1);
  if (lambda2 > 1e-12) entropy -= lambda2 * Math.log(lambda2);

  const isHermitian =
    Math.abs(rho.rho00.im) < 1e-6 &&
    Math.abs(rho.rho11.im) < 1e-6 &&
    Math.abs(rho.rho01.re - rho.rho10.re) < 1e-6 &&
    Math.abs(rho.rho01.im + rho.rho10.im) < 1e-6;

  const isPositiveSemiDefinite = lambda1Raw >= -1e-6 && lambda2Raw >= -1e-6;

  return {
    trace: tr,
    purity: clamp(purity, 0, 1),
    coherence: coh,
    entropy,
    isHermitian,
    isPositiveSemiDefinite,
    eigenvalues: [lambda1, lambda2],
  };
}

/** Quantum state fidelity between two 2x2 density matrices F(ρ, σ) */
export function densityMatrixFidelity(rho: DensityMatrix2x2, sigma: DensityMatrix2x2): number {
  // For pure or mixed 2x2 states: Tr(ρσ) + 2*sqrt(det(ρ)*det(sigma))
  const cohRho = Math.hypot(rho.rho01.re, rho.rho01.im);
  const cohSigma = Math.hypot(sigma.rho01.re, sigma.rho01.im);
  const detRho = Math.max(0, rho.rho00.re * rho.rho11.re - cohRho * cohRho);
  const detSigma = Math.max(0, sigma.rho00.re * sigma.rho11.re - cohSigma * cohSigma);

  // Tr(ρ σ) = rho00*sigma00 + rho11*sigma11 + 2*(rho01.re*sigma01.re + rho01.im*sigma01.im)
  const trRhoSigma =
    rho.rho00.re * sigma.rho00.re +
    rho.rho11.re * sigma.rho11.re +
    2 * (rho.rho01.re * sigma.rho01.re + rho.rho01.im * sigma.rho01.im);

  const fidelity = trRhoSigma + 2 * Math.sqrt(detRho * detSigma);
  return clamp(fidelity, 0, 1);
}

/** Apply T2* environmental phase dephasing to density matrix */
export function applyDephasing(rho: DensityMatrix2x2, dephasingCoeff: number): DensityMatrix2x2 {
  const decay = Math.exp(-Math.max(0, dephasingCoeff));
  return {
    rho00: { re: rho.rho00.re, im: 0 },
    rho01: { re: rho.rho01.re * decay, im: rho.rho01.im * decay },
    rho10: { re: rho.rho10.re * decay, im: rho.rho10.im * decay },
    rho11: { re: rho.rho11.re, im: 0 },
  };
}

/**
 * ============================================================================
 * Matter-Wave Interferometry & Ramsey Spectroscopy Simulation
 * ============================================================================
 */

export interface InterferometerSimulationParams {
  armSeparation_um: number;
  interrogationTime_ms: number;
  fieldGradient_per_um: number;
  coupling_g: number;
  dephasingNoise: number;
}

export interface InterferometerFringePoint {
  phaseSetting_rad: number;
  phaseSetting_deg: number;
  standardIntensity: number;
  modelIntensity: number;
  deltaIntensity: number;
}

export interface InterferometerResult {
  phaseShift_rad: number;
  phaseShift_deg: number;
  visibility: number;
  maxDelta: number;
  fringePoints: InterferometerFringePoint[];
}

/**
 * Compute matter-wave interferometry fringe patterns for standard QM vs Woodyard field model
 */
export function computeInterferometerFringes(
  params: InterferometerSimulationParams,
  numPoints = 50
): InterferometerResult {
  const { armSeparation_um, interrogationTime_ms, fieldGradient_per_um, coupling_g, dephasingNoise } =
    params;

  // Integrated field difference Δφ = (dφ/dx) * Δx * T
  const deltaPhiSpatial = fieldGradient_per_um * armSeparation_um;
  const integratedDeltaPhi = deltaPhiSpatial * interrogationTime_ms;

  // Phase shift Δφ_φ = (g / ħ) * integratedDeltaPhi (with ħ = 1 in normalized units)
  const phaseShift_rad = interferometryPhaseShift(coupling_g, 1.0, integratedDeltaPhi);
  const phaseShift_deg = (phaseShift_rad * 180) / Math.PI;

  // Visibility degradation under environmental noise
  const visibility = Math.exp(-Math.max(0, dephasingNoise) * interrogationTime_ms * 0.5);

  const fringePoints: InterferometerFringePoint[] = [];
  let maxDelta = 0;

  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const stdI = 0.5 * (1 + visibility * Math.cos(theta));
    const modelI = 0.5 * (1 + visibility * Math.cos(theta + phaseShift_rad));
    const deltaI = modelI - stdI;

    if (Math.abs(deltaI) > maxDelta) {
      maxDelta = Math.abs(deltaI);
    }

    fringePoints.push({
      phaseSetting_rad: theta,
      phaseSetting_deg: (theta * 180) / Math.PI,
      standardIntensity: stdI,
      modelIntensity: modelI,
      deltaIntensity: deltaI,
    });
  }

  return {
    phaseShift_rad,
    phaseShift_deg,
    visibility,
    maxDelta,
    fringePoints,
  };
}

export interface RamseySpectroscopyParams {
  detuning_kHz: number;
  interrogationTime_ms: number;
  fieldDiff_au: number;
  eta: number;
  decoherenceRate: number;
}

export interface RamseyFringePoint {
  time_ms: number;
  standardProb: number;
  modelProb: number;
  deltaProb: number;
}

export interface RamseyResult {
  differentialPhase_rad: number;
  frequencyShift_Hz: number;
  decayContrast: number;
  fringePoints: RamseyFringePoint[];
}

/**
 * Compute atomic clock Ramsey spectroscopy time-domain fringes
 */
export function computeRamseyFringes(
  params: RamseySpectroscopyParams,
  numPoints = 60
): RamseyResult {
  const { detuning_kHz, interrogationTime_ms, fieldDiff_au, eta, decoherenceRate } = params;

  // Differential clock phase ΔΦ_AB = η * δφ * T
  const differentialPhase_rad = clockComparisonPhase(eta, fieldDiff_au * interrogationTime_ms);
  const frequencyShift_Hz = (eta * fieldDiff_au * 1000) / (2 * Math.PI);
  const decayContrast = Math.exp(-Math.max(0, decoherenceRate) * interrogationTime_ms);

  const omega0 = 2 * Math.PI * detuning_kHz; // rad/ms
  const fringePoints: RamseyFringePoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * interrogationTime_ms;
    const decay = Math.exp(-Math.max(0, decoherenceRate) * t);
    const stdP = 0.5 * (1 + decay * Math.cos(omega0 * t));
    const modelP = 0.5 * (1 + decay * Math.cos(omega0 * t + eta * fieldDiff_au * t));

    fringePoints.push({
      time_ms: t,
      standardProb: stdP,
      modelProb: modelP,
      deltaProb: modelP - stdP,
    });
  }

  return {
    differentialPhase_rad,
    frequencyShift_Hz,
    decayContrast,
    fringePoints,
  };
}

