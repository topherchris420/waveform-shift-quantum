import { ModelComparisonResult } from '@/lib/physics';
import { CandidateAnomaly } from '@/lib/anomalyEngine';
import { CatalystArtifact } from '@/lib/catalyst';

export type ExperimentType =
  | 'two_site_transfer'
  | 'scalar_kernel'
  | 'signatures'
  | 'classical_limit'
  | 'teleportation'
  | 'interference'
  | 'superposition'
  | 'qdp'
  | 'interferometry'
  | 'density_matrix';

export interface QuantumLabParameters {
  g: number;
  delta: number;
  phiA: number;
  phiB: number;
  alpha: number;
  gamma: number;
  omega_w: number;
  purity: number;
  decoherence: number;
}

export type { ModelComparisonResult, CandidateAnomaly, CatalystArtifact };
