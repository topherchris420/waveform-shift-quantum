import { describe, expect, it } from 'vitest';
import {
  evaluateInstrument,
  INSTRUMENT_TOOLS_FOR_MODE,
} from '../lib/instruments';
import { teleportationFidelity, wernerSingletFraction } from '../lib/physics';

describe('Local laboratory instruments', () => {
  it('gates double-slit and Born-rule benches to their modes', () => {
    expect(INSTRUMENT_TOOLS_FOR_MODE.interference).toEqual(['double_slit_intensity']);
    expect(INSTRUMENT_TOOLS_FOR_MODE.superposition).toEqual(['born_probabilities']);
    expect(INSTRUMENT_TOOLS_FOR_MODE.teleportation).toEqual([
      'teleportation_fidelity',
      'pauli_correction',
    ]);
    expect(INSTRUMENT_TOOLS_FOR_MODE.qdp).toEqual([]);
  });

  it('evaluates Horodecki teleportation fidelity without a network hop', () => {
    const out = evaluateInstrument('teleportation_fidelity', {
      bell_purity: 1,
      decoherence: 0,
    });
    expect(out.structured.fidelity).toBeCloseTo(1, 10);
    expect(out.structured.formula).toBe('(2f+1)/3');
    expect(out.structured.singlet_fraction).toBeCloseTo(1, 10);

    const mixed = evaluateInstrument('teleportation_fidelity', {
      bell_purity: 1 / 3,
      decoherence: 0,
    });
    expect(mixed.structured.fidelity).toBeCloseTo(2 / 3, 10);
    expect(mixed.structured.entangled).toBe(false);
  });

  it('matches physics.ts closed forms for double-slit and Born-rule instruments', () => {
    const slit = evaluateInstrument('double_slit_intensity', {
      y_mm: 0,
      slit_separation_um: 100,
      wavelength_nm: 633,
      screen_distance_mm: 1000,
    });
    expect(slit.structured.intensity).toBeCloseTo(1, 10);

    const born = evaluateInstrument('born_probabilities', { theta_rad: 0 });
    expect(born.structured.p0).toBeCloseTo(1, 10);
    expect(born.structured.p1).toBeCloseTo(0, 10);
  });

  it('returns Pauli operators from Bell bits', () => {
    const xz = evaluateInstrument('pauli_correction', { m1: 1, m2: 1 });
    expect(xz.structured.operator).toBe('X·Z');
    expect(xz.structured.bits).toBe('11');
  });

  it('keeps Horodecki F identical to (1 + p(1-d))/2', () => {
    const p = 0.72;
    const d = 0.15;
    const F = teleportationFidelity(p, d);
    const f = wernerSingletFraction(p, d);
    expect(F).toBeCloseTo((2 * f + 1) / 3, 12);
    expect(F).toBeCloseTo((1 + p * (1 - d)) / 2, 12);
  });
});
