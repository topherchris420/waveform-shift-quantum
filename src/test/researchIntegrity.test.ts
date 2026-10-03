import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareModels } from '../lib/physics';
import { COMPARISON_DERIVATIONS, EPISTEMIC_CLASSES } from '../lib/epistemics';
import { OBSERVABLES } from '../lib/observables';
import { RESEARCH_MODELS } from '../lib/researchModels';
import { TWO_SITE_UNITS, KERNEL_UNITS } from '../lib/units';
import { SPEC_SCHEMA } from '../experiments/engine';

const comparisonParams = { g: 0.8, phiA: -0.6, phiB: 0.6, delta: 0.25, alpha: 1.2, gamma: 1.5, omega_w: 12 };

describe('compareModels classification', () => {
  it('labels how every proposed number was produced', () => {
    const derivation = (type: string) => compareModels(type, comparisonParams).derivation;
    expect(derivation('two_site')).toBe('derived_prediction');
    expect(derivation('scalar_kernel')).toBe('illustrative_transformation');
    expect(derivation('teleportation')).toBe('speculative_scenario');
    expect(derivation('interference')).toBe('illustrative_transformation');
  });

  it('never presents a placeholder as a proposed-model result', () => {
    const fallback = compareModels('interference', comparisonParams);
    expect(fallback.scientificStatus).toBe('Speculative');
    expect(COMPARISON_DERIVATIONS[fallback.derivation].isModelPrediction).toBe(false);
  });

  it('does not invent an experimental noise floor in falsification text', () => {
    for (const type of ['two_site', 'scalar_kernel', 'teleportation', 'interference']) {
      const c = compareModels(type, comparisonParams);
      expect(c.falsificationCondition).not.toMatch(/1e-4/);
      expect(c.derivationNote.length).toBeGreaterThan(20);
    }
  });
});

describe('observable registry', () => {
  it('uses only the four declared kinds and invents no sensitivities', () => {
    const kinds = new Set(['internal_model_variable', 'numerical_diagnostic', 'simulated_observable', 'experimentally_measurable']);
    for (const o of OBSERVABLES) {
      expect(kinds.has(o.kind), o.id).toBe(true);
      expect(['unknown', 'not applicable']).toContain(o.requiredSensitivity);
    }
  });

  it('does not claim a defined prediction for any uncalibrated physical observable', () => {
    for (const o of OBSERVABLES.filter((x) => x.kind === 'experimentally_measurable' || x.kind === 'simulated_observable')) {
      expect(o.predictionDefined, o.id).toBe(false);
    }
  });

  it('every model references only registered observables and a known epistemic class', () => {
    for (const m of RESEARCH_MODELS) {
      expect(EPISTEMIC_CLASSES[m.epistemicClass]).toBeDefined();
      for (const id of m.observables) expect(OBSERVABLES.some((o) => o.id === id), id).toBe(true);
    }
  });

  it('no proposed model has an operational empirical falsification while g and φ are uncalibrated', () => {
    for (const m of RESEARCH_MODELS.filter((x) => x.epistemicClass === 'proposed')) {
      const empirical = m.falsificationConditions.filter((f) => f.level === 'empirical');
      expect(empirical.length).toBeGreaterThan(0);
      for (const f of empirical) {
        expect(f.operational).toBe(false);
        expect(f.missing.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('unit declarations', () => {
  it('declare a unit for every workbench input', () => {
    const declared = new Set(TWO_SITE_UNITS.quantities.map((q) => q.codeKey));
    for (const key of ['g', 'phiA', 'phiB', 'delta', 'driveAmplitude', 'driveOmega', 'EA', 'EB', 'duration', 'dt']) {
      expect(declared.has(key), key).toBe(true);
    }
    expect(Object.keys(SPEC_SCHEMA.shape)).toContain('maxCoupling');
  });

  it('report g and φ as underspecified rather than calibrated', () => {
    for (const s of ['g', 'φ_A', 'φ_B']) {
      expect(TWO_SITE_UNITS.quantities.find((q) => q.symbol === s)?.calibration).toBe('underspecified');
    }
    expect(KERNEL_UNITS.quantities.every((q) => q.calibration !== 'calibrated')).toBe(true);
    expect(TWO_SITE_UNITS.system).toMatchObject({ kind: 'dimensionless', hbar: 1, timeUnit: 'ħ/ε₀' });
  });
});

// Physics verification applies to physics. Financial and resource models keep
// their own validation; neither side may import the other's claims.
describe('domain separation', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
    });
  const physics = /(quantum\/validation|lib\/(researchModels|observables|units|realitySplit|physics|epistemics))/;
  const finance = /(systemic-lab|resource-resonance)/;

  it('financial and resource labs do not import the physics research layer', () => {
    for (const f of [...files('src/systemic-lab'), ...files('src/resource-resonance')]) {
      const imports = readFileSync(f, 'utf8').match(/from\s+['"][^'"]+['"]/g) ?? [];
      for (const i of imports) expect(i, f).not.toMatch(physics);
    }
  });

  it('the physics research layer does not import financial or resource models', () => {
    for (const f of [
      ...files('src/quantum/validation'),
      'src/lib/researchModels.ts',
      'src/lib/observables.ts',
      'src/lib/units.ts',
      'src/experiments/engine.ts',
    ]) {
      const imports = readFileSync(f, 'utf8').match(/from\s+['"][^'"]+['"]/g) ?? [];
      for (const i of imports) expect(i, f).not.toMatch(finance);
    }
  });
});
