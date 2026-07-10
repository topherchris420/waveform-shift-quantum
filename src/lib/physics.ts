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
