import { describe, it, expect } from 'vitest';
import {
  QuantumError,
  NormalizationError,
  HermitianError,
  DensityMatrixError,
  PositiveSemiDefiniteError,
} from '../quantum/errors/QuantumError';
import { validateNormalization, validateHermitian2x2 } from '../quantum/validation/validateParameters';

describe('Quantum Errors & Parameter Validation', () => {
  it('should instantiate QuantumError and its sub-classes correctly', () => {
    const err = new QuantumError('Generic error', 'GENERIC');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(QuantumError);
    expect(err.code).toBe('GENERIC');

    const normErr = new NormalizationError(0.85);
    expect(normErr).toBeInstanceOf(QuantumError);
    expect(normErr.code).toBe('NORM_ERROR');
    expect(normErr.probability).toBe(0.85);

    const hermErr = new HermitianError();
    expect(hermErr).toBeInstanceOf(QuantumError);
    expect(hermErr.code).toBe('HERM_ERROR');

    const dmErr = new DensityMatrixError('Invalid rho');
    expect(dmErr).toBeInstanceOf(QuantumError);
    expect(dmErr.code).toBe('DENSITY_MATRIX_ERROR');

    const psdErr = new PositiveSemiDefiniteError();
    expect(psdErr).toBeInstanceOf(QuantumError);
    expect(psdErr.code).toBe('PSD_ERROR');
  });

  it('should validate probability normalization', () => {
    expect(() => validateNormalization([0.5, 0.5])).not.toThrow();
    expect(() => validateNormalization([0.6, 0.2])).toThrow(NormalizationError);
  });

  it('should validate 2x2 Hermitian matrices', () => {
    const validHermitian: [[number, number], [number, number]] = [[1, 2], [2, 3]];
    expect(() => validateHermitian2x2(validHermitian)).not.toThrow();

    const nonHermitian: [[number, number], [number, number]] = [[1, 2], [5, 3]];
    expect(() => validateHermitian2x2(nonHermitian)).toThrow(HermitianError);
  });
});
