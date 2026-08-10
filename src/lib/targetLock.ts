// Target Lock.
//
// The user names an experimental platform and the smallest deviation they are
// willing to chase. Target Lock then sweeps parameter space and returns the
// STRONGEST TESTABLE prediction inside those constraints — ranked by statistical
// significance against that apparatus's real noise model, not by raw ΔP.
//
// A large deviation that sits under a platform's systematic floor is worthless;
// a small one that clears it by 20σ is a decisive experiment. Ranking by
// significance is what makes the difference visible.
//
// When nothing survives the constraints the search does not fail silently: it
// reports why each candidate was rejected and what the user would have to relax
// (or which apparatus they would have to switch to) for a viable experiment.

import { compareModels } from './physics';
import { sampleParameters, type AnomalyParameters } from './anomalyEngine';
import {
  buildExperimentCard,
  classifyTestability,
  DETECTION_SIGMA,
  modelValidity,
  toObservableUnits,
  type ExperimentCard,
  type ModelValidity,
  type Testability,
} from './experimentCard';
import {
  ANY_PLATFORM_ID,
  getPlatform,
  platformResolution,
  PLATFORMS,
  type Platform,
} from './platforms';

export type SweepMode = 'two_site' | 'scalar_kernel' | 'teleportation';

export interface TargetLockRequest {
  /** Platform id, or ANY_PLATFORM_ID to let the search pick the best apparatus. */
  platformId: string;
  /** Smallest |Δ| worth pursuing, in observable units. */
  sensitivityLimit: number;
  seed?: number;
  iterations?: number;
  /** Restrict the sweep to particular comparison modes. */
  modes?: SweepMode[];
  /** Confidence required to call a prediction testable. */
  nSigma?: number;
}

export interface RejectionTally {
  unstable: number;
  belowSensitivity: number;
  degenerate: number;
  unsupportedMode: number;
  belowSystematicFloor: number;
  beyondShotBudget: number;
}

export type LockVerdict =
  | 'locked'
  | 'testable_only_with_longer_integration'
  | 'no_regime_above_sensitivity'
  | 'no_testable_regime';

export interface TargetLockResult {
  request: Required<Omit<TargetLockRequest, 'modes'>> & { modes: SweepMode[] };
  /** Ranked cards, strongest testable prediction first. */
  cards: ExperimentCard[];
  best: ExperimentCard | null;
  /** Parameter points evaluated. */
  scanned: number;
  rejected: RejectionTally;
  verdict: LockVerdict;
  /** Concrete next actions when the lock is weak or empty. */
  guidance: string[];
  /**
   * Largest |Δ| seen anywhere in the sweep, even if untestable. Used to explain
   * how far the constraints are from being satisfiable.
   */
  strongestDeltaSeen: number;
  /** Platform that could test strongestDeltaSeen, if the chosen one cannot. */
  suggestedPlatform: Platform | null;
}

interface ScoredCandidate {
  parameters: AnomalyParameters;
  mode: SweepMode;
  platform: Platform;
  delta: number;
  significance: number;
  testability: Testability;
  validity: ModelValidity;
  requiredShots: number;
}

const DEFAULT_MODES: SweepMode[] = ['two_site', 'scalar_kernel'];

/** g·α beyond this is treated as outside the model's perturbative validity. */
const STABILITY_LIMIT = 8.5;

export function isStableRegime(params: AnomalyParameters): boolean {
  return params.g * params.alpha < STABILITY_LIMIT;
}

/**
 * Run the constrained sweep and return the strongest testable prediction.
 */
export function runTargetLock(request: TargetLockRequest): TargetLockResult {
  const seed = request.seed ?? 42;
  const iterations = request.iterations ?? 600;
  const modes = request.modes ?? DEFAULT_MODES;
  const nSigma = request.nSigma ?? DETECTION_SIGMA;
  const sensitivityLimit = request.sensitivityLimit ?? 0;
  const platformId = request.platformId ?? ANY_PLATFORM_ID;

  const lockedPlatform = getPlatform(platformId);
  const candidatePlatforms = lockedPlatform ? [lockedPlatform] : PLATFORMS;

  const rejected: RejectionTally = {
    unstable: 0,
    belowSensitivity: 0,
    degenerate: 0,
    unsupportedMode: 0,
    belowSystematicFloor: 0,
    beyondShotBudget: 0,
  };

  const scored: ScoredCandidate[] = [];
  let strongestDeltaSeen = 0;
  let strongestDeltaParams: { parameters: AnomalyParameters; mode: SweepMode } | null = null;
  let scanned = 0;

  for (let i = 0; i < iterations; i += 1) {
    const parameters = sampleParameters(seed, i);

    if (Math.abs(parameters.phiA - parameters.phiB) < 1e-4) {
      rejected.degenerate += 1;
      continue;
    }
    if (!isStableRegime(parameters)) {
      rejected.unstable += 1;
      continue;
    }

    scanned += 1;
    const mode = modes[i % modes.length];
    const comparison = compareModels(mode, parameters);
    // Compare in the units the apparatus reads out, not in the raw units of the
    // model's internal quantity — see toObservableUnits.
    const delta =
      toObservableUnits(mode, comparison.woodyardModel) -
      toObservableUnits(mode, comparison.standardQM);
    const absDelta = Math.abs(delta);
    const validity = modelValidity(mode, parameters);

    if (!Number.isFinite(absDelta) || absDelta < 1e-9) {
      rejected.degenerate += 1;
      continue;
    }

    if (absDelta > strongestDeltaSeen) {
      strongestDeltaSeen = absDelta;
      strongestDeltaParams = { parameters, mode };
    }

    if (absDelta < sensitivityLimit) {
      rejected.belowSensitivity += 1;
      continue;
    }

    for (const platform of candidatePlatforms) {
      if (!platform.supportedModes.includes(mode)) {
        rejected.unsupportedMode += 1;
        continue;
      }
      const { testability, requiredShots } = classifyTestability(platform, delta, nSigma);
      if (testability === 'below_systematic_floor') {
        rejected.belowSystematicFloor += 1;
        continue;
      }
      if (testability === 'needs_more_integration') {
        rejected.beyondShotBudget += 1;
      }
      const sigmaTotal = platformResolution(platform, platform.practicalShots);
      const significance = sigmaTotal > 0 ? absDelta / sigmaTotal : 0;
      scored.push({
        parameters,
        mode,
        platform,
        delta,
        significance,
        testability,
        validity,
        requiredShots,
      });
    }
  }

  // Rank: apparatus-ready experiments first; then regimes inside the model's
  // derived domain ahead of extrapolations, so a spectacular number obtained by
  // pushing the model past its own validity never outranks a modest result the
  // model genuinely predicts; then by significance; then by shot budget.
  scored.sort((a, b) => {
    const readiness = (c: ScoredCandidate) => (c.testability === 'testable_now' ? 0 : 1);
    const derived = (c: ScoredCandidate) => (c.validity === 'perturbative' ? 0 : 1);
    if (readiness(a) !== readiness(b)) return readiness(a) - readiness(b);
    if (derived(a) !== derived(b)) return derived(a) - derived(b);
    if (b.significance !== a.significance) return b.significance - a.significance;
    return a.requiredShots - b.requiredShots;
  });

  // Keep the strongest few, but deliberately spread them across apparatus and
  // outcome. A single dominant regime would otherwise fill the entire list with
  // interchangeable entries, which is a worse answer to "where should I look?"
  // than a shorter, more varied one.
  const deduped: ScoredCandidate[] = [];
  const seenKeys = new Set<string>();
  const perPlatform = new Map<string, number>();
  // With a platform locked there is only one apparatus to show, so the cap
  // exists purely to force variety when the search is free to choose.
  const MAX_PER_PLATFORM = lockedPlatform ? 8 : 2;

  for (const candidate of scored) {
    const key = [
      candidate.platform.id,
      candidate.mode,
      // Two entries whose predicted separation agrees to two significant
      // figures propose the same experiment, whatever their parameters.
      candidate.delta.toExponential(2),
    ].join('|');
    if (seenKeys.has(key)) continue;

    const used = perPlatform.get(candidate.platform.id) ?? 0;
    if (used >= MAX_PER_PLATFORM) continue;

    seenKeys.add(key);
    perPlatform.set(candidate.platform.id, used + 1);
    deduped.push(candidate);
    if (deduped.length >= 8) break;
  }

  const cards = deduped.map((candidate, index) =>
    buildExperimentCard(candidate.mode, candidate.parameters, candidate.platform, {
      seed: seed * 1000 + index,
      nSigma,
      id: `EXP-${candidate.platform.id.toUpperCase().slice(0, 4)}-${seed}-${index
        .toString()
        .padStart(2, '0')}`,
    })
  );

  const best = cards.length > 0 ? cards[0] : null;

  // Which apparatus could test the strongest deviation we saw?
  let suggestedPlatform: Platform | null = null;
  if (strongestDeltaParams) {
    const viable = PLATFORMS.filter(
      (p) =>
        p.supportedModes.includes(strongestDeltaParams.mode) &&
        classifyTestability(p, strongestDeltaSeen, nSigma).testability !== 'below_systematic_floor'
    ).sort((a, b) => a.systematicFloor - b.systematicFloor);
    suggestedPlatform = viable[0] ?? null;
  }

  let verdict: LockVerdict;
  if (best && best.testability === 'testable_now') {
    verdict = 'locked';
  } else if (best) {
    verdict = 'testable_only_with_longer_integration';
  } else if (strongestDeltaSeen < sensitivityLimit) {
    verdict = 'no_regime_above_sensitivity';
  } else {
    verdict = 'no_testable_regime';
  }

  const guidance = buildGuidance({
    verdict,
    best,
    lockedPlatform: lockedPlatform ?? null,
    sensitivityLimit,
    strongestDeltaSeen,
    suggestedPlatform,
    nSigma,
    modes,
  });

  return {
    request: { platformId, sensitivityLimit, seed, iterations, nSigma, modes },
    cards,
    best,
    scanned,
    rejected,
    verdict,
    guidance,
    strongestDeltaSeen,
    suggestedPlatform,
  };
}

interface GuidanceInput {
  verdict: LockVerdict;
  best: ExperimentCard | null;
  lockedPlatform: Platform | null;
  sensitivityLimit: number;
  strongestDeltaSeen: number;
  suggestedPlatform: Platform | null;
  nSigma: number;
  modes: SweepMode[];
}

function buildGuidance(input: GuidanceInput): string[] {
  const {
    verdict,
    best,
    lockedPlatform,
    sensitivityLimit,
    strongestDeltaSeen,
    suggestedPlatform,
    nSigma,
  } = input;
  const out: string[] = [];
  const sci = (v: number) => (Number.isFinite(v) ? v.toExponential(2) : '∞');

  switch (verdict) {
    case 'locked':
      if (best) {
        out.push(
          `Strongest testable prediction: |Δ| = ${sci(Math.abs(best.delta))} on ${best.platform.label}, ` +
            `worth ${best.significance.toFixed(1)}σ at ${best.uncertainty.shots.toExponential(0)} shots.`
        );
        out.push(
          `Reaching ${nSigma}σ needs ${Number.isFinite(best.requiredShots) ? best.requiredShots.toExponential(1) : '∞'} shots ` +
            `— within the platform's practical budget of ${best.platform.practicalShots.toExponential(0)}.`
        );
        if (best.modelValidity === 'extrapolated') {
          out.push(
            `Caution: this regime sits outside the weak-response range the kernel was derived in (α = ${best.parameters.alpha}). ` +
              `Treat the number as an extrapolation of the model, not a prediction of it.`
          );
        }
        out.push(
          `Load these parameters into the Reality Split to watch the divergence build, then run the controls on the card before claiming anything.`
        );
      }
      break;

    case 'testable_only_with_longer_integration':
      if (best) {
        out.push(
          `No regime clears ${nSigma}σ inside ${best.platform.label}'s practical shot budget ` +
            `(${best.platform.practicalShots.toExponential(0)} shots).`
        );
        out.push(
          `The best candidate needs ${Number.isFinite(best.requiredShots) ? best.requiredShots.toExponential(1) : '∞'} shots — ` +
            `extend integration time, or move to an apparatus with a lower systematic floor.`
        );
        if (suggestedPlatform && suggestedPlatform.id !== best.platform.id) {
          out.push(
            `${suggestedPlatform.label} has a systematic floor of ${sci(suggestedPlatform.systematicFloor)} and would reach ${nSigma}σ sooner.`
          );
        }
      }
      break;

    case 'no_regime_above_sensitivity':
      out.push(
        `Nothing in the swept parameter space produced a deviation as large as your ` +
          `sensitivity limit of ${sci(sensitivityLimit)}.`
      );
      out.push(
        `The strongest separation found anywhere was |Δ| = ${sci(strongestDeltaSeen)}. ` +
          `Lower the sensitivity limit below that value to see candidates.`
      );
      break;

    default:
      out.push(
        `The sweep found deviations up to |Δ| = ${sci(strongestDeltaSeen)}, but none is testable ` +
          `on ${lockedPlatform ? lockedPlatform.label : 'any registered platform'} at ${nSigma}σ.`
      );
      if (lockedPlatform) {
        out.push(
          `${lockedPlatform.label} has a systematic floor of ${sci(lockedPlatform.systematicFloor)}; ` +
            `a ${nSigma}σ result needs 1σ precision better than ${sci(strongestDeltaSeen / nSigma)}.`
        );
      }
      if (suggestedPlatform) {
        out.push(
          `Switch Target Lock to ${suggestedPlatform.label} (systematic floor ${sci(suggestedPlatform.systematicFloor)}) — ` +
            `it can resolve the strongest deviation this sweep found.`
        );
      } else {
        out.push(
          `No registered apparatus can resolve this prediction. In its current form the model is not ` +
            `experimentally distinguishable from standard quantum mechanics here — that is itself a reportable result.`
        );
      }
      break;
  }

  return out;
}
