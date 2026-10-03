import { NormalizationError, HermitianError } from '../errors/QuantumError';
import { checkHermitian2x2 } from './results';

// Throwing guards for inputs. They share their arithmetic with the structured
// checks in ./results, which a research run uses instead so that every failure
// is recorded rather than thrown.

export interface Matrix2x2 {
  elements: [[number, number], [number, number]];
}

export function validateNormalization(probabilities: number[], tolerance = 1e-4): void {
  const sum = probabilities.reduce((acc, p) => acc + p, 0);
  if (Math.abs(sum - 1.0) > tolerance) {
    throw new NormalizationError(sum);
  }
}

export function validateHermitian2x2(matrix: [[number, number], [number, number]] | number[][]): void {
  const result = checkHermitian2x2(
    { id: 'hermitian-guard', label: 'Hermitian 2×2', category: 'structure', gate: 'numerics' },
    matrix,
    1e-6
  );
  if (result.status !== 'pass') throw new HermitianError(result.explanation);
}
