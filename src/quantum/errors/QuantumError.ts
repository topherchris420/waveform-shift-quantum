export class QuantumError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QuantumError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NormalizationError extends QuantumError {
  constructor(public probability: number) {
    super(`Probability normalization failed: ${probability}`, 'NORM_ERROR');
    this.name = 'NormalizationError';
  }
}

export class HermitianError extends QuantumError {
  constructor(details: string = 'Hamiltonian matrix must be Hermitian') {
    super(details, 'HERM_ERROR');
    this.name = 'HermitianError';
  }
}

export class DensityMatrixError extends QuantumError {
  constructor(message: string = 'Invalid quantum density matrix', code = 'DENSITY_MATRIX_ERROR') {
    super(message, code);
    this.name = 'DensityMatrixError';
  }
}

export class PositiveSemiDefiniteError extends QuantumError {
  constructor(message: string = 'Density matrix must be positive semi-definite (eigenvalues >= 0)') {
    super(message, 'PSD_ERROR');
    this.name = 'PositiveSemiDefiniteError';
  }
}

