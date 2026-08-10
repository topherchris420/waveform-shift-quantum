// Reality Split engine.
//
// Evolves two competing descriptions of the SAME physical system from
// IDENTICAL initial conditions:
//
//   Branch A — Established Physics (standard QM):
//     H_std = [[E_A, Δ], [Δ, E_B]]              (no matter-scalar coupling)
//
//   Branch B — Proposed Model (Woodyard 2026):
//     H_mod(t) = [[E_A + g φ_A(t), Δ], [Δ, E_B + g φ_B(t)]]
//
// Both branches are propagated with the same exact unitary propagator
// (evolveTwoSiteState), so any difference between them is a consequence of the
// proposed coupling g alone — never of numerical asymmetry between the two
// integrations. When g = 0 the two branches are identical for all t, which is
// the engine's central falsifiable invariant (see src/test/realitySplit.test.ts).

import {
  evolveTwoSiteState,
  localizationKernel,
  observedLocalizationDensity,
  type TwoSiteStateVector,
} from './physics';

export type SplitMode = 'two_site' | 'scalar_kernel';

export interface RealitySplitParams {
  /** Bare site A energy (eV). */
  EA: number;
  /** Bare site B energy (eV). */
  EB: number;
  /** Static scalar field value at site A. */
  phiA: number;
  /** Static scalar field value at site B. */
  phiB: number;
  /** Matter-scalar coupling strength g. Setting g = 0 collapses the split. */
  g: number;
  /** Inter-site mixing amplitude Δ (eV). */
  delta: number;
  /** Amplitude of the time-dependent field drive applied antisymmetrically to A/B. */
  driveAmplitude: number;
  /** Angular frequency of the field drive. */
  driveOmega: number;
  /** Response strength α for the localization kernel (scalar_kernel mode). */
  alpha: number;
  /** Response linewidth Γ (scalar_kernel mode). */
  gamma: number;
  /** External drive frequency ω_w (scalar_kernel mode). */
  omega_w: number;
}

export const DEFAULT_SPLIT_PARAMS: RealitySplitParams = {
  EA: 1.0,
  EB: 1.0,
  phiA: -0.6,
  phiB: 0.6,
  g: 0.8,
  delta: 0.25,
  driveAmplitude: 0.4,
  driveOmega: 1.5,
  alpha: 1.2,
  gamma: 1.5,
  omega_w: 12.0,
};

export interface BranchFrame {
  PA: number;
  PB: number;
  /** |c_A|² + |c_B|², retained so norm drift is visible rather than hidden. */
  norm: number;
}

export interface SplitFrame {
  t: number;
  standard: BranchFrame;
  model: BranchFrame;
  /** P_B^model(t) − P_B^standard(t). Signed, so the direction of the split is legible. */
  deltaPB: number;
  /**
   * Trace distance between the two predicted occupation distributions,
   * D = ½ Σ_i |p_i − q_i|. For a two-level population this reduces to |ΔP_B|.
   * D is the maximum probability advantage any single measurement can have in
   * distinguishing the two models, so it is the natural "distinguishability" axis.
   */
  traceDistance: number;
}

/** Scalar field at site A under the time-dependent drive. */
export function fieldAtA(params: RealitySplitParams, t: number): number {
  return params.phiA + params.driveAmplitude * Math.sin(params.driveOmega * t);
}

/** Scalar field at site B under the time-dependent drive (antisymmetric to A). */
export function fieldAtB(params: RealitySplitParams, t: number): number {
  return params.phiB - params.driveAmplitude * Math.sin(params.driveOmega * t);
}

const initialState = (): TwoSiteStateVector => ({
  cA: { re: 1, im: 0 },
  cB: { re: 0, im: 0 },
});

export interface SimulateOptions {
  /** Total simulated duration (arbitrary time units). */
  duration?: number;
  /** Integration step. Smaller is more accurate; the propagator is exact per step. */
  dt?: number;
  /**
   * Detection threshold used to report when the two models first become
   * distinguishable. Supply a platform noise floor to make this meaningful.
   */
  noiseFloor?: number;
}

export interface RealitySplitTrajectory {
  frames: SplitFrame[];
  dt: number;
  duration: number;
  /** Largest trace distance reached over the simulated window. */
  maxDivergence: number;
  /** Time at which maxDivergence occurs. */
  maxDivergenceTime: number;
  /** Time-averaged trace distance — a fairer target for time-integrated measurements. */
  meanDivergence: number;
  /**
   * First time the trace distance exceeds the supplied noise floor, or null if
   * the two models never separate beyond it within the window.
   */
  firstDetectableTime: number | null;
}

/**
 * Propagate both branches from the same |ψ(0)⟩ = |A⟩ and record the split.
 *
 * The returned trajectory is deterministic: identical inputs always give
 * identical frames, which is what makes the exported experiment cards
 * reproducible.
 */
export function simulateRealitySplit(
  params: RealitySplitParams,
  options: SimulateOptions = {}
): RealitySplitTrajectory {
  const duration = options.duration ?? 12;
  const dt = options.dt ?? 0.02;
  const steps = Math.max(1, Math.round(duration / dt));

  let standardState = initialState();
  let modelState = initialState();

  const frames: SplitFrame[] = [
    {
      t: 0,
      // Identical initial conditions: the split starts at exactly zero.
      standard: { PA: 1, PB: 0, norm: 1 },
      model: { PA: 1, PB: 0, norm: 1 },
      deltaPB: 0,
      traceDistance: 0,
    },
  ];

  let maxDivergence = 0;
  let maxDivergenceTime = 0;
  let divergenceSum = 0;
  let firstDetectableTime: number | null = null;
  const noiseFloor = options.noiseFloor ?? 0;

  for (let step = 1; step <= steps; step += 1) {
    // Midpoint sampling of the drive keeps the time-dependent branch
    // second-order accurate instead of first-order.
    const tMid = (step - 0.5) * dt;
    const t = step * dt;

    // Established physics: no matter-scalar coupling at all.
    const standardStep = evolveTwoSiteState(
      standardState,
      { EA: params.EA, EB: params.EB, phiA: 0, phiB: 0, g: 0, delta: params.delta },
      dt
    );

    // Proposed model: identical Hamiltonian plus the g φ(t) diagonal terms.
    const modelStep = evolveTwoSiteState(
      modelState,
      {
        EA: params.EA,
        EB: params.EB,
        phiA: fieldAtA(params, tMid),
        phiB: fieldAtB(params, tMid),
        g: params.g,
        delta: params.delta,
      },
      dt
    );

    standardState = standardStep.state;
    modelState = modelStep.state;

    const deltaPB = modelStep.PB - standardStep.PB;
    // ½(|ΔP_A| + |ΔP_B|) = |ΔP_B| because ΔP_A = −ΔP_B under normalization.
    const traceDistance = Math.abs(deltaPB);

    if (traceDistance > maxDivergence) {
      maxDivergence = traceDistance;
      maxDivergenceTime = t;
    }
    divergenceSum += traceDistance;
    if (firstDetectableTime === null && noiseFloor > 0 && traceDistance > noiseFloor) {
      firstDetectableTime = t;
    }

    frames.push({
      t,
      standard: { PA: standardStep.PA, PB: standardStep.PB, norm: standardStep.norm },
      model: { PA: modelStep.PA, PB: modelStep.PB, norm: modelStep.norm },
      deltaPB,
      traceDistance,
    });
  }

  return {
    frames,
    dt,
    duration: steps * dt,
    maxDivergence,
    maxDivergenceTime,
    meanDivergence: divergenceSum / steps,
    firstDetectableTime,
  };
}

/** Sample a trajectory at an arbitrary time by linear interpolation between frames. */
export function sampleTrajectory(trajectory: RealitySplitTrajectory, t: number): SplitFrame {
  const { frames, dt } = trajectory;
  if (frames.length === 0) {
    return {
      t: 0,
      standard: { PA: 1, PB: 0, norm: 1 },
      model: { PA: 1, PB: 0, norm: 1 },
      deltaPB: 0,
      traceDistance: 0,
    };
  }
  const clampedT = Math.min(Math.max(t, 0), trajectory.duration);
  const raw = clampedT / dt;
  const lo = Math.min(frames.length - 1, Math.floor(raw));
  const hi = Math.min(frames.length - 1, lo + 1);
  const w = raw - lo;
  const a = frames[lo];
  const b = frames[hi];
  const mix = (x: number, y: number) => x + (y - x) * w;
  return {
    t: mix(a.t, b.t),
    standard: {
      PA: mix(a.standard.PA, b.standard.PA),
      PB: mix(a.standard.PB, b.standard.PB),
      norm: mix(a.standard.norm, b.standard.norm),
    },
    model: {
      PA: mix(a.model.PA, b.model.PA),
      PB: mix(a.model.PB, b.model.PB),
      norm: mix(a.model.norm, b.model.norm),
    },
    deltaPB: mix(a.deltaPB, b.deltaPB),
    traceDistance: mix(a.traceDistance, b.traceDistance),
  };
}

// ---------------------------------------------------------------------------
// Divergence field: where in SPACE the two models disagree, not just by how much
// ---------------------------------------------------------------------------

export interface DivergenceField {
  /** Spatial sample coordinates, normalized to [-1, 1]. */
  x: number[];
  /** Predicted spatial density under established physics. */
  rhoStandard: number[];
  /** Predicted spatial density under the proposed model. */
  rhoModel: number[];
  /** Signed difference ρ_model(x) − ρ_standard(x). Integrates to zero. */
  divergence: number[];
  /** Largest |ρ_model − ρ_standard| across the grid. */
  maxAbs: number;
  /**
   * ∫|ρ_model − ρ_standard| dx = 2 × total-variation distance between the two
   * predicted spatial distributions. This is the quantity an imaging experiment
   * would actually have to resolve.
   */
  l1: number;
}

const SITE_A_X = -0.55;
const SITE_B_X = 0.55;
const SITE_WIDTH = 0.28;

/** Field coupling coefficient β in ω_loc = ω₀ + βφ + κ∇²φ. */
const KERNEL_BETA = 2.0;
/** Field curvature coefficient κ in the same expression. */
const KERNEL_KAPPA = 0.15;
/** Width over which the scalar field crosses between its two asymptotic values. */
const FIELD_TRANSITION_WIDTH = 0.5;

/**
 * Scalar field profile across the sample, with its analytic Laplacian.
 *
 * φ(x) = φ̄ + (Δφ/2)·tanh(x/w),  φ''(x) = −(Δφ/w²)·sech²(x/w)·tanh(x/w)
 *
 * A smooth transition is used rather than a straight line between φA and φB
 * because a linear profile has ∇²φ ≡ 0, which would silently switch off the κ
 * term of the local resonance. (An earlier version did exactly that: it paired
 * a linear φ with a fabricated curvature −2(φB−φA)x, and for β = 2, κ = 0.5 the
 * two terms cancelled identically, pinning ω_loc at ω₀ and making the entire
 * scalar divergence field vanish.)
 */
export function scalarFieldProfile(
  params: Pick<RealitySplitParams, 'phiA' | 'phiB'>,
  x: number
): { phi: number; laplacian: number } {
  const mean = (params.phiA + params.phiB) / 2;
  const span = params.phiB - params.phiA;
  const w = FIELD_TRANSITION_WIDTH;
  const t = Math.tanh(x / w);
  const sech2 = 1 - t * t;
  return {
    phi: mean + (span / 2) * t,
    laplacian: -(span / (w * w)) * sech2 * t,
  };
}

const gaussian = (x: number, mu: number, sigma: number) =>
  Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

const normalizeInPlace = (values: number[], dx: number) => {
  let total = 0;
  for (const v of values) total += v;
  const integral = total * dx;
  if (integral > 0) {
    for (let i = 0; i < values.length; i += 1) values[i] /= integral;
  }
  return values;
};

/**
 * Build the spatial divergence field at a single instant.
 *
 * two_site      — occupations are rendered as two localized wavepackets; the
 *                 field shows which well each model puts the particle in.
 * scalar_kernel — established physics predicts the Born density |ψ|²; the
 *                 proposed model predicts the kernel-biased density
 *                 χ(x)|ψ|² / ∫χ|ψ|². Both are normalized, so the divergence
 *                 field integrates to zero: probability is moved, never created.
 */
export function computeDivergenceField(
  mode: SplitMode,
  params: RealitySplitParams,
  frame: SplitFrame,
  gridSize = 160
): DivergenceField {
  const x: number[] = new Array(gridSize);
  const rhoStandard: number[] = new Array(gridSize);
  const rhoModel: number[] = new Array(gridSize);
  const divergence: number[] = new Array(gridSize);
  const dx = 2 / (gridSize - 1);

  if (mode === 'scalar_kernel') {
    const born: number[] = new Array(gridSize);
    const kernels: { L: number; chi: number }[] = new Array(gridSize);

    for (let i = 0; i < gridSize; i += 1) {
      const xi = -1 + i * dx;
      x[i] = xi;
      // Single localized wavepacket; the kernel, not the state, does the biasing.
      born[i] = gaussian(xi, 0, 0.32);
      const { phi, laplacian } = scalarFieldProfile(params, xi);
      kernels[i] = localizationKernel({
        omega0: 10.0,
        beta: KERNEL_BETA,
        kappa: KERNEL_KAPPA,
        phi,
        d2phi: laplacian,
        omega_w: params.omega_w,
        gamma: params.gamma,
        // α is the kernel sector's own coupling: α → 0 gives χ ≡ 1 and recovers
        // the Born rule exactly. (g is the two-site matter-scalar coupling and
        // does not enter compareModels' kernel branch, so gating on it here
        // would contradict the numbers shown everywhere else.)
        alpha: params.alpha,
      });
    }

    const { Ploc } = observedLocalizationDensity(born, kernels);
    let bornTotal = 0;
    for (const b of born) bornTotal += b;

    for (let i = 0; i < gridSize; i += 1) {
      // Convert the discrete probabilities back into densities (per unit x).
      rhoStandard[i] = born[i] / (bornTotal * dx);
      rhoModel[i] = Ploc[i] / dx;
    }
  } else {
    for (let i = 0; i < gridSize; i += 1) {
      const xi = -1 + i * dx;
      x[i] = xi;
      rhoStandard[i] =
        frame.standard.PA * gaussian(xi, SITE_A_X, SITE_WIDTH) +
        frame.standard.PB * gaussian(xi, SITE_B_X, SITE_WIDTH);
      rhoModel[i] =
        frame.model.PA * gaussian(xi, SITE_A_X, SITE_WIDTH) +
        frame.model.PB * gaussian(xi, SITE_B_X, SITE_WIDTH);
    }
    normalizeInPlace(rhoStandard, dx);
    normalizeInPlace(rhoModel, dx);
  }

  let maxAbs = 0;
  let l1 = 0;
  for (let i = 0; i < gridSize; i += 1) {
    const d = rhoModel[i] - rhoStandard[i];
    divergence[i] = d;
    const a = Math.abs(d);
    if (a > maxAbs) maxAbs = a;
    l1 += a * dx;
  }

  return { x, rhoStandard, rhoModel, divergence, maxAbs, l1 };
}

export interface KernelRegionSeparation {
  /** Probability standard QM puts in the region, ∫_R P_B(x) dx. */
  standardFraction: number;
  /** Probability the proposed model puts there, ∫_R P_loc(x) dx. */
  modelFraction: number;
  /** modelFraction − standardFraction. Equals the total-variation distance. */
  delta: number;
  /** Fraction of the sample the region covers, for the experiment write-up. */
  regionWidth: number;
}

/**
 * Reduce the localization-kernel prediction to a single measurable number.
 *
 * The kernel model's actual observable is the NORMALIZED density
 * P_loc(x) = χ(x)P_B(x)/∫χP_B, not the bare kernel factor χ. That distinction
 * matters: a spatially constant χ cancels completely in the normalization, so a
 * flat field predicts exactly zero deviation however large χ is. Reading a
 * separation off a single χ value therefore invents effects the model says are
 * not there.
 *
 * The statistic here is the probability contained in the region where the model
 * predicts an excess — the optimal discriminating region. Because the field
 * integrates to zero, ∫_{Δρ>0} Δρ = ½∫|Δρ| is exactly the total-variation
 * distance between the two predicted distributions, i.e. the largest advantage
 * any single measurement can have in telling them apart. Both fractions are
 * probabilities, so they drop straight into the platform noise model.
 */
export function kernelRegionSeparation(
  params: RealitySplitParams,
  gridSize = 320
): KernelRegionSeparation {
  // The kernel field is static, so any frame gives the same answer.
  const frame: SplitFrame = {
    t: 0,
    standard: { PA: 1, PB: 0, norm: 1 },
    model: { PA: 1, PB: 0, norm: 1 },
    deltaPB: 0,
    traceDistance: 0,
  };
  const field = computeDivergenceField('scalar_kernel', params, frame, gridSize);
  const dx = 2 / (gridSize - 1);

  let standardFraction = 0;
  let modelFraction = 0;
  let cells = 0;
  for (let i = 0; i < gridSize; i += 1) {
    if (field.divergence[i] > 0) {
      standardFraction += field.rhoStandard[i] * dx;
      modelFraction += field.rhoModel[i] * dx;
      cells += 1;
    }
  }

  return {
    standardFraction,
    modelFraction,
    delta: modelFraction - standardFraction,
    regionWidth: cells / gridSize,
  };
}

/**
 * Stack divergence fields over time into an (x, t) map — the scrolling
 * heat-map that makes the split visible as a field rather than a number.
 */
export function computeDivergenceMap(
  mode: SplitMode,
  params: RealitySplitParams,
  trajectory: RealitySplitTrajectory,
  columns = 96,
  gridSize = 96
): { columns: number[][]; times: number[]; maxAbs: number } {
  const cols: number[][] = [];
  const times: number[] = [];
  let maxAbs = 0;

  for (let c = 0; c < columns; c += 1) {
    const t = (c / Math.max(1, columns - 1)) * trajectory.duration;
    const frame = sampleTrajectory(trajectory, t);
    const field = computeDivergenceField(mode, params, frame, gridSize);
    cols.push(field.divergence);
    times.push(t);
    if (field.maxAbs > maxAbs) maxAbs = field.maxAbs;
  }

  return { columns: cols, times, maxAbs };
}
