import { twoSiteModel, localizationKernel, compareModels } from './physics';

export interface AnomalyParameters {
  g: number;         // Matter-scalar coupling strength
  delta: number;     // Inter-site mixing amplitude Δ (eV)
  phiA: number;      // Local scalar field at site A
  phiB: number;      // Local scalar field at site B
  alpha: number;     // Response strength α
  gamma: number;     // Linewidth Γ
  omega_w: number;   // Drive frequency ω_w
}

export interface CandidateAnomaly {
  id: string;
  parameters: AnomalyParameters;
  standardQM: number;
  fieldModulatedModel: number;
  deltaP: number;
  percentDeviation: number;
  score: number;
  numericalStability: 'Stable' | 'Marginal' | 'Unstable';
  sensitiveObservable: string;
  candidatePlatform: string;
  falsificationCondition: string;
  experimentType: 'two_site' | 'scalar_kernel' | 'teleportation';
}

/** Simple Mulberry32 deterministic pseudo-random generator */
function pseudoRandom(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SearchOptions {
  seed?: number;
  iterations?: number;
  experimentType?: 'two_site' | 'scalar_kernel' | 'teleportation';
}

/**
 * Numerically sweep parameter space to discover parameter combinations
 * that maximize measurable deviation between Standard QM and Woodyard Model.
 */
export function searchAnomalies(options: SearchOptions = {}): CandidateAnomaly[] {
  const seed = options.seed ?? 42;
  const iterations = options.iterations ?? 200;
  const rng = pseudoRandom(seed);

  const candidates: CandidateAnomaly[] = [];

  for (let i = 0; i < iterations; i++) {
    // Sample parameters deterministically within physical bounds
    const g = Number((0.1 + rng() * 2.9).toFixed(3));
    const delta = Number((0.05 + rng() * 0.95).toFixed(3));
    const phiA = Number((-2.0 + rng() * 4.0).toFixed(3));
    const phiB = Number((-2.0 + rng() * 4.0).toFixed(3));
    const alpha = Number((0.1 + rng() * 2.9).toFixed(3));
    const gamma = Number((0.3 + rng() * 2.7).toFixed(3));
    const omega_w = Number((5.0 + rng() * 20.0).toFixed(2));

    // Reject unphysical or degenerate states
    if (!Number.isFinite(g) || !Number.isFinite(delta) || Math.abs(phiA - phiB) < 1e-4) {
      continue;
    }

    const params: AnomalyParameters = { g, delta, phiA, phiB, alpha, gamma, omega_w };

    // Select experiment mode to evaluate
    const mode = options.experimentType ?? (i % 2 === 0 ? 'two_site' : 'scalar_kernel');
    const comp = compareModels(mode, params);

    // Calculate stability and measurability score
    const absDelta = Math.abs(comp.delta);

    // Reject non-finite or zero-deviation results
    if (!Number.isFinite(absDelta) || absDelta < 1e-4) {
      continue;
    }

    const stability: 'Stable' | 'Marginal' | 'Unstable' =
      g * alpha < 6.0 ? 'Stable' : g * alpha < 8.5 ? 'Marginal' : 'Unstable';

    // Skip unstable parameter regions
    if (stability === 'Unstable') continue;

    // Score combines deviation magnitude, parameter moderation, and stability weight
    const stabilityWeight = stability === 'Stable' ? 1.0 : 0.7;
    const score = Number((absDelta * 100 * stabilityWeight * (1 / (1 + g * 0.1))).toFixed(2));

    // Determine platform and observable based on parameter regime
    let candidatePlatform = 'Atom Interferometer';
    let sensitiveObservable = 'Matter-wave interferometric phase';

    if (mode === 'scalar_kernel') {
      candidatePlatform = 'Optical Lattice (Strontium Clock)';
      sensitiveObservable = 'Differential frequency shift Δν';
    } else if (Math.abs(phiB - phiA) > 2.5) {
      candidatePlatform = 'Superconducting Transmon Circuit';
      sensitiveObservable = 'Avoided crossing charge offset';
    } else if (alpha > 2.0) {
      candidatePlatform = 'Trapped Ion (171Yb+)';
      sensitiveObservable = 'Phonon mode population imbalance';
    }

    candidates.push({
      id: `ANM-${seed}-${i.toString().padStart(3, '0')}`,
      parameters: params,
      standardQM: Number(comp.standardQM.toFixed(4)),
      fieldModulatedModel: Number(comp.woodyardModel.toFixed(4)),
      deltaP: Number(comp.delta.toFixed(4)),
      percentDeviation: Number(comp.percentDeviation.toFixed(2)),
      score,
      numericalStability: stability,
      sensitiveObservable,
      candidatePlatform,
      falsificationCondition:
        `If the predicted deviation ΔP = ${comp.delta.toFixed(4)} is absent within modeled uncertainty under parameters (g=${g}, α=${alpha}, Δ=${delta}), this parameter region is excluded.`,
      experimentType: mode,
    });
  }

  // Rank candidate anomalies by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return top candidates
  return candidates.slice(0, 10);
}
