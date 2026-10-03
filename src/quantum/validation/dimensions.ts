// Executable dimensional analysis over a protocol's unit declaration.
//
// Dimensional analysis is the cheapest physics check there is, so it is run,
// not asserted: every equation-level constraint in a UnitDeclaration is reduced
// to exponent vectors and compared. A declaration also cannot quietly claim
// more than it has — a time labelled in seconds under ħ = 1, or a "calibrated"
// quantity without a named calibration, fails.

import {
  formatDimension,
  formatTerm,
  termDimension,
  dimEquals,
  type Dimension,
  type UnitDeclaration,
} from '@/lib/units';
import { metadataWarning, type VerificationResult } from './results';

export function checkDimensionalConsistency(declaration: UnitDeclaration): VerificationResult {
  const failures: string[] = [];
  for (const constraint of declaration.constraints) {
    const dims: Dimension[] = [];
    for (const term of constraint.terms) {
      const d = termDimension(declaration, term);
      if ('missing' in d) {
        failures.push(`${constraint.id}: undeclared symbol ${d.missing}`);
        continue;
      }
      dims.push(d);
    }
    if (dims.some((d) => !dimEquals(d, dims[0]))) {
      failures.push(
        `${constraint.id}: ${constraint.terms
          .map((t) => {
            const d = termDimension(declaration, t);
            return `${formatTerm(t)} [${'missing' in d ? '?' : formatDimension(d)}]`;
          })
          .join(' vs ')}`
      );
    }
  }
  const coupling = declaration.quantities.find((q) => q.symbol === 'g');
  return {
    id: `dimensions-${declaration.id}`,
    label: 'Dimensional consistency of the model equations',
    category: 'units',
    gate: 'model',
    source: 'executed',
    status: failures.length === 0 ? 'pass' : 'fail',
    measured: failures.length,
    tolerance: 0,
    explanation:
      failures.length === 0
        ? `All ${declaration.constraints.length} equation-level constraints balance (${declaration.constraints.map((c) => c.id).join(', ')}).${coupling ? ` They require [g] = ${formatDimension(coupling.dimension)}, where F is the unidentified dimension of φ.` : ''}`
        : `Inconsistent: ${failures.join('; ')}`,
  };
}

/** Displayed units must agree with the protocol that actually runs. */
export function checkUnitLabels(declaration: UnitDeclaration): VerificationResult {
  const problems: string[] = [];
  if (declaration.system.kind === 'dimensionless') {
    for (const q of declaration.quantities) {
      if ((q.dimension.T ?? 0) !== 0 && /(^|[^a-z])(s|sec|seconds?)$/i.test(q.simulationUnit.trim())) {
        problems.push(`${q.symbol} is labelled in seconds under ħ = 1`);
      }
      if (/\beV\b/.test(q.simulationUnit)) problems.push(`${q.symbol} is labelled in eV under simulation units`);
    }
  }
  return {
    id: `unit-labels-${declaration.id}`,
    label: 'Unit labels match the executed unit system',
    category: 'units',
    gate: 'empirical',
    source: 'executed',
    status: problems.length === 0 ? 'pass' : 'fail',
    measured: problems.length,
    tolerance: 0,
    explanation:
      problems.length === 0
        ? `${declaration.quantities.length} quantities labelled in ${declaration.system.kind === 'dimensionless' ? 'simulation units (energy ε₀, time ħ/ε₀)' : 'physical units'}; none claims seconds or eV it does not have.`
        : problems.join('; '),
  };
}

export function checkCalibrationClaims(declaration: UnitDeclaration): VerificationResult {
  const unsupported = declaration.quantities.filter(
    (q) => q.calibration === 'calibrated' && !q.calibrationSource?.trim()
  );
  return {
    id: `calibration-claims-${declaration.id}`,
    label: 'No calibration claimed without a source',
    category: 'calibration',
    gate: 'empirical',
    source: 'executed',
    status: unsupported.length === 0 ? 'pass' : 'fail',
    measured: unsupported.length,
    tolerance: 0,
    explanation:
      unsupported.length === 0
        ? 'No quantity claims a calibration it cannot name.'
        : `Claimed calibrated without a source: ${unsupported.map((q) => q.symbol).join(', ')}.`,
  };
}

/** What the model leaves undetermined. Always a warning, never a pass. */
export function unitSpecificationWarning(declaration: UnitDeclaration): VerificationResult {
  const under = declaration.quantities.filter((q) => q.calibration === 'underspecified').map((q) => q.symbol);
  return metadataWarning(
    {
      id: `unit-specification-${declaration.id}`,
      label: 'Physical units not calibrated',
      category: 'calibration',
      gate: 'empirical',
    },
    `${declaration.system.kind === 'dimensionless' ? 'Simulation-unit protocol (ħ = 1) is defined. ' : ''}Underspecified: ${under.length ? under.join(', ') : 'none declared'}. ${declaration.underspecified.join(' ')}`
  );
}
