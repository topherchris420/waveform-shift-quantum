import { compareModels } from './physics';
import { PLATFORMS } from './platforms';

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
export function pseudoRandom(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically sample one point of parameter space.
 *
 * Indexed rather than sequential so that any consumer — the anomaly sweep or
 * Target Lock — can reproduce the exact same point from (seed, index) alone.
 */
export function sampleParameters(seed: number, index: number): AnomalyParameters {
  const rng = pseudoRandom(seed * 7919 + index * 104729);
  // Discard the first draws so neighbouring indices decorrelate fully.
  rng();
  rng();
  return {
    g: Number((0.1 + rng() * 2.9).toFixed(3)),
    delta: Number((0.05 + rng() * 0.95).toFixed(3)),
    phiA: Number((-2.0 + rng() * 4.0).toFixed(3)),
    phiB: Number((-2.0 + rng() * 4.0).toFixed(3)),
    alpha: Number((0.1 + rng() * 2.9).toFixed(3)),
    gamma: Number((0.3 + rng() * 2.7).toFixed(3)),
    omega_w: Number((5.0 + rng() * 20.0).toFixed(2)),
  };
}

export interface SearchOptions {
  seed?: number;
  iterations?: number;
  experimentType?: 'two_site' | 'scalar_kernel' | 'teleportation';
  targetPlatform?: string;
  sensitivityLimit?: number;
}

const platformLabelById = new Map(PLATFORMS.map((p) => [p.id, p.label]));

/**
 * Pick the apparatus best matched to a parameter regime.
 * Kept as a label so exported artifacts stay human-readable.
 */
function assignPlatform(
  mode: 'two_site' | 'scalar_kernel' | 'teleportation',
  params: AnomalyParameters
): { platform: string; observable: string } {
  if (mode === 'scalar_kernel') {
    return {
      platform: platformLabelById.get('optical_lattice_clock') ?? 'Optical Lattice Clock (Sr)',
      observable: 'Differential fractional frequency Δν/ν',
    };
  }
  if (Math.abs(params.phiB - params.phiA) > 2.5) {
    return {
      platform: platformLabelById.get('transmon_circuit') ?? 'Superconducting Transmon Circuit',
      observable: 'Avoided-crossing population P₁',
    };
  }
  if (params.alpha > 2.0) {
    return {
      platform: platformLabelById.get('trapped_ion') ?? 'Trapped Ion (¹⁷¹Yb⁺)',
      observable: 'Internal-state population P(bright)',
    };
  }
  return {
    platform: platformLabelById.get('atom_interferometer') ?? 'Atom Interferometer',
    observable: 'Matter-wave interferometric phase Δφ',
  };
}

/**
 * Numerically sweep parameter space to discover parameter combinations
 * that maximize measurable deviation between Standard QM and the proposed model.
 */
export function searchAnomalies(options: SearchOptions = {}): CandidateAnomaly[] {
  const seed = options.seed ?? 42;
  const iterations = options.iterations ?? 200;

  const candidates: CandidateAnomaly[] = [];

  for (let i = 0; i < iterations; i++) {
    const params = sampleParameters(seed, i);
    const { g, delta, phiA, phiB, alpha } = params;

    // Reject unphysical or degenerate states
    if (!Number.isFinite(g) || !Number.isFinite(delta) || Math.abs(phiA - phiB) < 1e-4) {
      continue;
    }

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

    const { platform: candidatePlatform, observable: sensitiveObservable } = assignPlatform(
      mode,
      params
    );

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

  // Apply Target Lock constraints if specified
  let filteredCandidates = candidates;
  if (options.targetPlatform && options.targetPlatform !== 'Any') {
    filteredCandidates = filteredCandidates.filter(
      (c) => c.candidatePlatform === options.targetPlatform
    );
  }
  if (options.sensitivityLimit) {
    filteredCandidates = filteredCandidates.filter(
      (c) => Math.abs(c.deltaP) >= options.sensitivityLimit!
    );
  }

  // Return top candidates
  return filteredCandidates.slice(0, 10);
}
