import {
  NormalizationError,
  HermitianError,
  DensityMatrixError,
  PositiveSemiDefiniteError,
} from '../errors/QuantumError';
import { type DensityMatrix2x2, densityMatrixMetrics } from '@/lib/physics';

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
  if (matrix.length !== 2 || matrix[0].length !== 2 || matrix[1].length !== 2) {
    throw new HermitianError('Matrix must be 2x2');
  }
  // For real matrices H[0][1] must equal H[1][0]
  if (Math.abs(matrix[0][1] - matrix[1][0]) > 1e-6) {
    throw new HermitianError('Matrix off-diagonal elements are not equal');
  }
}

export function validateDensityMatrix(rho: DensityMatrix2x2, tolerance = 1e-4): void {
  const metrics = densityMatrixMetrics(rho);
  if (Math.abs(metrics.trace - 1.0) > tolerance) {
    throw new NormalizationError(metrics.trace);
  }
  if (!metrics.isHermitian) {
    throw new HermitianError('Density matrix is not Hermitian (ρ != ρ†)');
  }
  if (!metrics.isPositiveSemiDefinite) {
    throw new PositiveSemiDefiniteError(
      `Density matrix eigenvalues [${metrics.eigenvalues[0].toFixed(4)}, ${metrics.eigenvalues[1].toFixed(4)}] must be non-negative`
    );
  }
  if (metrics.purity > 1.0 + tolerance) {
    throw new DensityMatrixError(`Density matrix purity Tr(ρ²) = ${metrics.purity.toFixed(4)} cannot exceed 1.0`);
  }
}

