import {
  barrierTransmission,
  bornProbabilities,
  doubleSlitIntensity,
  localizationKernel,
  pauliCorrection,
  teleportationFidelity,
  twoSiteModel,
  wernerConcurrence,
  wernerSingletFraction,
} from './physics';

export type InstrumentName =
  | 'two_site_transfer'
  | 'field_localization_kernel'
  | 'barrier_transmission'
  | 'double_slit_intensity'
  | 'born_probabilities'
  | 'teleportation_fidelity'
  | 'pauli_correction';

export type LabInstrumentMode =
  | 'two_site_transfer'
  | 'scalar_kernel'
  | 'signatures'
  | 'classical_limit'
  | 'teleportation'
  | 'interference'
  | 'superposition'
  | 'qdp';

/** Mode-gated local instrument catalogue. Empty modes have no analytic bench. */
export const INSTRUMENT_TOOLS_FOR_MODE: Record<LabInstrumentMode, InstrumentName[]> = {
  two_site_transfer: ['two_site_transfer'],
  scalar_kernel: ['field_localization_kernel'],
  signatures: ['two_site_transfer', 'field_localization_kernel'],
  classical_limit: ['barrier_transmission'],
  teleportation: ['teleportation_fidelity', 'pauli_correction'],
  interference: ['double_slit_intensity'],
  superposition: ['born_probabilities'],
  qdp: [],
};

export interface InstrumentResult {
  text: string;
  structured: Record<string, unknown>;
}

function num(values: Record<string, number>, key: string, fallback: number) {
  const value = values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bit(values: Record<string, number>, key: string): 0 | 1 {
  return num(values, key, 0) >= 0.5 ? 1 : 0;
}

/**
 * Evaluate an analytic laboratory instrument in-process. Same closed forms
 * as the MCP tools, without a network hop.
 */
export function evaluateInstrument(
  name: InstrumentName,
  values: Record<string, number>,
): InstrumentResult {
  switch (name) {
    case 'two_site_transfer': {
      const res = twoSiteModel({
        EA: num(values, 'bare_EA', 1),
        EB: num(values, 'bare_EB', 1),
        phiA: num(values, 'field_phiA', -0.5),
        phiB: num(values, 'field_phiB', 0.5),
        g: num(values, 'coupling_g', 0.8),
        delta: num(values, 'mixing_delta', 0.2),
      });
      return {
        text: `δ = ${res.detuning.toFixed(4)} ε₀, P_A = ${res.PA.toFixed(6)}, P_B = ${res.PB.toFixed(6)}, z = ${res.z.toFixed(6)}`,
        structured: {
          detuning: res.detuning,
          theta: res.theta,
          PA: res.PA,
          PB: res.PB,
          z: res.z,
          norm: res.norm,
        },
      };
    }
    case 'field_localization_kernel': {
      const res = localizationKernel({
        omega0: num(values, 'omega0', 10),
        beta: num(values, 'beta', 2),
        kappa: 0,
        phi: num(values, 'phi', 1.2),
        d2phi: 0,
        omega_w: num(values, 'drive_w', 12.4),
        gamma: num(values, 'gamma', 1.5),
        alpha: num(values, 'alpha', 1),
      });
      return {
        text: `ω_loc = ${res.omega_loc.toFixed(4)} GHz, L = ${res.L.toFixed(6)}, χ = ${res.chi.toFixed(6)}`,
        structured: {
          omega_loc: res.omega_loc,
          L: res.L,
          chi: res.chi,
        },
      };
    }
    case 'barrier_transmission': {
      const { T, kappa_a, regime } = barrierTransmission(
        num(values, 'energy_eV', 1),
        num(values, 'barrier_eV', 2),
        num(values, 'width_nm', 0.5),
      );
      return {
        text: `T = ${T.toExponential(4)} (regime: ${regime}, κa = ${kappa_a.toFixed(4)})`,
        structured: { transmission: T, reflection: 1 - T, kappa_a, regime },
      };
    }
    case 'double_slit_intensity': {
      const y = num(values, 'y_mm', 0.5);
      const I = doubleSlitIntensity(
        y,
        num(values, 'slit_separation_um', 100),
        num(values, 'wavelength_nm', 633),
        num(values, 'screen_distance_mm', 1000),
      );
      return {
        text: `I/I₀ = ${I.toFixed(6)} at y = ${y} mm`,
        structured: { intensity: I, y_mm: y },
      };
    }
    case 'born_probabilities': {
      const theta = num(values, 'theta_rad', Math.PI / 3);
      const { p0, p1 } = bornProbabilities(theta);
      return {
        text: `p(0) = ${p0.toFixed(6)}, p(1) = ${p1.toFixed(6)}`,
        structured: { p0, p1, theta_rad: theta },
      };
    }
    case 'teleportation_fidelity': {
      const p = num(values, 'bell_purity', 0.9);
      const d = num(values, 'decoherence', 0.1);
      const F = teleportationFidelity(p, d);
      const C = wernerConcurrence(p, d);
      const f = wernerSingletFraction(p, d);
      return {
        text: `F = ${F.toFixed(6)} (Horodecki), singlet fraction f = ${f.toFixed(6)}, concurrence C = ${C.toFixed(6)}`,
        structured: {
          fidelity: F,
          concurrence: C,
          singlet_fraction: f,
          entangled: C > 0,
          formula: '(2f+1)/3',
        },
      };
    }
    case 'pauli_correction': {
      const result = pauliCorrection(bit(values, 'm1'), bit(values, 'm2'));
      return {
        text: `Measurement ${result.bits} → apply ${result.operator} (${result.description})`,
        structured: result,
      };
    }
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown instrument: ${exhaustive}`);
    }
  }
}
