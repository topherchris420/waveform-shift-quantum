// Timestep convergence ladder: dt → dt/2 → dt/4.
//
// What is being measured. Each Reality Split step applies the exact exponential
// of a frozen Hamiltonian, so the ONLY discretisation error is that of freezing
// a time-dependent H(t) at each step's midpoint (exponential midpoint rule,
// global error O(dt²)). The ladder therefore expects:
//
//   static H (no drive, or the established branch)  errors at rounding level;
//   driven H                                         error ratio ≈ 4 per halving.
//
// To isolate integration error from observation sampling, every metric is
// evaluated at the coarse-grid times, which all three ladders share exactly
// (the finer grids nest the coarse one). A maximum taken over a finer grid would
// also pick up peak-sampling error and could even grow under refinement.

import { simulateRealitySplit, type RealitySplitParams, type RealitySplitTrajectory } from '@/lib/realitySplit';
import type { TwoSiteStateVector } from '@/lib/physics';
import type { VerificationResult } from './results';

export type ConvergenceMetricId =
  | 'PA'
  | 'PB'
  | 'traceDistance'
  | 'maxDivergence'
  | 'meanDivergence'
  | 'coherence';

export const CONVERGENCE_METRICS: { id: ConvergenceMetricId; label: string; definition: string }[] = [
  { id: 'PA', label: 'P_A', definition: 'max over coarse times and both branches of |ΔP_A|' },
  { id: 'PB', label: 'P_B', definition: 'max over coarse times and both branches of |ΔP_B|' },
  { id: 'traceDistance', label: 'Trace distance D(t)', definition: 'max over coarse times of |ΔD|' },
  { id: 'maxDivergence', label: 'Maximum divergence', definition: '|Δ max D| over the coarse times' },
  { id: 'meanDivergence', label: 'Mean divergence', definition: '|Δ mean D| over the coarse times' },
  {
    id: 'coherence',
    label: 'Coherence c_A*c_B (phase)',
    definition: 'final-time |Δ(c_A* c_B)|, both branches; invariant under a global phase',
  },
];

export type LadderErrors = Record<ConvergenceMetricId, [coarseVsHalf: number, halfVsQuarter: number]>;

export interface TimestepLadder {
  trajectories: [RealitySplitTrajectory, RealitySplitTrajectory, RealitySplitTrajectory];
  errors: LadderErrors;
  /** Largest |norm − 1| over every frame of every ladder rung, both branches. */
  normError: number;
}

const coherence = (s: TwoSiteStateVector) => ({
  re: s.cA.re * s.cB.re + s.cA.im * s.cB.im,
  im: s.cA.re * s.cB.im - s.cA.im * s.cB.re,
});

function pairErrors(coarse: RealitySplitTrajectory, fine: RealitySplitTrajectory, stride: number, fineStride: number) {
  let pa = 0;
  let pb = 0;
  let d = 0;
  let maxC = 0;
  let maxF = 0;
  let sumC = 0;
  let sumF = 0;
  const n = (coarse.frames.length - 1) / stride;
  for (let i = 0; i <= n; i += 1) {
    const a = coarse.frames[i * stride];
    const b = fine.frames[i * fineStride];
    pa = Math.max(pa, Math.abs(a.standard.PA - b.standard.PA), Math.abs(a.model.PA - b.model.PA));
    pb = Math.max(pb, Math.abs(a.standard.PB - b.standard.PB), Math.abs(a.model.PB - b.model.PB));
    d = Math.max(d, Math.abs(a.traceDistance - b.traceDistance));
    maxC = Math.max(maxC, a.traceDistance);
    maxF = Math.max(maxF, b.traceDistance);
    if (i > 0) {
      // Same convention as the engine's meanDivergence: post-step frames only.
      sumC += a.traceDistance;
      sumF += b.traceDistance;
    }
  }
  let coh = 0;
  for (const [x, y] of [
    [coarse.finalStandard, fine.finalStandard],
    [coarse.finalModel, fine.finalModel],
  ] as const) {
    const cx = coherence(x);
    const cy = coherence(y);
    coh = Math.max(coh, Math.hypot(cx.re - cy.re, cx.im - cy.im));
  }
  return { PA: pa, PB: pb, traceDistance: d, maxDivergence: Math.abs(maxC - maxF), meanDivergence: Math.abs(sumC - sumF) / n, coherence: coh };
}

export function runTimestepLadder(params: RealitySplitParams, duration: number, dt: number): TimestepLadder {
  const trajectories = [dt, dt / 2, dt / 4].map((step) => simulateRealitySplit(params, { duration, dt: step })) as [
    RealitySplitTrajectory,
    RealitySplitTrajectory,
    RealitySplitTrajectory,
  ];
  const [c, h, q] = trajectories;
  const first = pairErrors(c, h, 1, 2);
  // dt/2 vs dt/4, still on the coarse times: every 2nd half-step frame, every 4th quarter-step frame.
  const second = pairErrors(h, q, 2, 4);
  const errors = Object.fromEntries(
    CONVERGENCE_METRICS.map(({ id }) => [id, [first[id], second[id]]])
  ) as LadderErrors;
  let normError = 0;
  for (const t of trajectories) {
    for (const f of t.frames) {
      normError = Math.max(normError, Math.abs(f.standard.norm - 1), Math.abs(f.model.norm - 1));
    }
  }
  return { trajectories, errors, normError };
}

/**
 * roundoff        the finest pair agrees to rounding level: no resolvable
 *                 discretisation error (expected for a static Hamiltonian);
 * asymptotic      error falls at least as fast as dt^minimumOrder;
 * pre_asymptotic  error falls, but slower than expected;
 * not_converging  halving the step did not reduce the error.
 */
export type LadderRegime = 'roundoff' | 'asymptotic' | 'pre_asymptotic' | 'not_converging';

const REGIME_SEVERITY: Record<LadderRegime, number> = {
  roundoff: 0,
  asymptotic: 1,
  pre_asymptotic: 2,
  not_converging: 3,
};

export function classifyLadder(
  coarseVsHalf: number,
  halfVsQuarter: number,
  roundoffFloor: number,
  minimumOrder: number
): { regime: LadderRegime; reduction: number | null; observedOrder: number | null } {
  if (!Number.isFinite(coarseVsHalf) || !Number.isFinite(halfVsQuarter)) {
    return { regime: 'not_converging', reduction: null, observedOrder: null };
  }
  if (halfVsQuarter <= roundoffFloor) return { regime: 'roundoff', reduction: null, observedOrder: null };
  if (halfVsQuarter >= coarseVsHalf) {
    return { regime: 'not_converging', reduction: coarseVsHalf / halfVsQuarter, observedOrder: null };
  }
  const reduction = coarseVsHalf / halfVsQuarter;
  const observedOrder = Math.log2(reduction);
  return { regime: observedOrder >= minimumOrder ? 'asymptotic' : 'pre_asymptotic', reduction, observedOrder };
}

export interface LadderMetricSummary {
  metric: ConvergenceMetricId;
  /** Coupling of the sample whose finest-pair error is largest. */
  coupling: number;
  coarseVsHalf: number;
  halfVsQuarter: number;
  reduction: number | null;
  observedOrder: number | null;
  /** Most severe regime over every sample, not only the reported one. */
  regime: LadderRegime;
}

export function summarizeLadders(
  samples: readonly { coupling: number; ladder: LadderErrors }[],
  roundoffFloor: number,
  minimumOrder: number
): LadderMetricSummary[] {
  return CONVERGENCE_METRICS.map(({ id }) => {
    let worst = samples[0];
    let regime: LadderRegime = 'roundoff';
    for (const s of samples) {
      if (s.ladder[id][1] > worst.ladder[id][1]) worst = s;
      const r = classifyLadder(s.ladder[id][0], s.ladder[id][1], roundoffFloor, minimumOrder).regime;
      if (REGIME_SEVERITY[r] > REGIME_SEVERITY[regime]) regime = r;
    }
    const [e1, e2] = worst.ladder[id];
    const { reduction, observedOrder } = classifyLadder(e1, e2, roundoffFloor, minimumOrder);
    return { metric: id, coupling: worst.coupling, coarseVsHalf: e1, halfVsQuarter: e2, reduction, observedOrder, regime };
  });
}

export function convergenceChecks(
  summaries: readonly LadderMetricSummary[],
  tolerance: number,
  minimumOrder: number
): VerificationResult[] {
  const worst = (k: 'coarseVsHalf' | 'halfVsQuarter') => Math.max(...summaries.map((s) => s[k]));
  const pass = (v: number) => (Number.isFinite(v) && v <= tolerance ? 'pass' : 'fail');
  const e1 = worst('coarseVsHalf');
  const e2 = worst('halfVsQuarter');
  const regimes = new Set(summaries.map((s) => s.regime));
  const asymptotic = summaries.filter((s) => s.regime === 'asymptotic' && s.observedOrder !== null);
  const orders = asymptotic.map((s) => (s.observedOrder as number).toFixed(2));
  const trendStatus = regimes.has('not_converging') ? 'fail' : regimes.has('pre_asymptotic') ? 'warning' : 'pass';
  return [
    {
      id: 'timestep-dt-half',
      label: 'dt → dt/2 agreement',
      category: 'convergence',
      gate: 'numerics',
      source: 'executed',
      status: pass(e1),
      measured: e1,
      tolerance,
      explanation: 'Largest error(dt, dt/2) over all metrics and samples, at shared coarse-grid times.',
    },
    {
      id: 'timestep-half-quarter',
      label: 'dt/2 → dt/4 agreement',
      category: 'convergence',
      gate: 'numerics',
      source: 'executed',
      status: pass(e2),
      measured: e2,
      tolerance,
      explanation: 'Largest error(dt/2, dt/4) over all metrics and samples, at shared coarse-grid times.',
    },
    {
      id: 'convergence-trend',
      label: 'Convergence trend (observed order)',
      category: 'convergence',
      gate: 'numerics',
      source: 'executed',
      status: trendStatus,
      measured: asymptotic.length ? Math.min(...asymptotic.map((s) => s.observedOrder as number)) : undefined,
      tolerance: minimumOrder,
      explanation:
        trendStatus === 'fail'
          ? 'Halving the timestep did not reduce the error for at least one metric and sample.'
          : asymptotic.length
            ? `Error falls with each halving; observed orders ${orders.join(', ')} (exponential midpoint rule expects 2). Metrics at rounding level have no resolvable discretisation error.${trendStatus === 'warning' ? ' Some samples fall slower than expected (pre-asymptotic).' : ''}`
            : 'Every metric agrees to rounding level across the ladder: the Hamiltonian is static, so each exact frozen-step propagator is exact for the whole trajectory.',
    },
  ];
}
