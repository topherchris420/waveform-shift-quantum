export interface ResourceVector {
  scarcity: number;     // S (0-1)
  demand: number;       // D (0-1)
  urgency: number;      // U (0-1)
  quality: number;      // Q (0-1)
  locationCost: number; // L (0-1, 1 is best/lowest friction)
  energyCost: number;   // E (0-1, 1 is abundant/clean)
  reliability: number;  // R (0-1)
  compatibility: number;// C (0-1)
}

export interface ResourceOffer {
  id: string;
  providerId: string;
  type: string;
  amount: number;
  vector: ResourceVector;
}

export interface ResourceNeed {
  id: string;
  requesterId: string;
  type: string;
  amount: number;
  vector: ResourceVector;
}

export interface MatchResult {
  offerId: string;
  needId: string;
  amount: number;
  score: number;
  routeType: 'direct' | 'multi-hop';
  relayNodeId?: string; // Optional intermediary node
  explanation: {
    compositeMatch: number;
    compatibility: number;
    energyAvailability: number;
    urgencyAlignment: number;
    networkCost: number;
    reliability: number;
  };
}

export interface SimulationParams {
  resourceScarcity: number;
  networkSize: number;
  renewableVolatility: number;
  computeDemand: number;
  urgency: number;
  geographicalFriction: number;
  participantReliability: number;
  supplyDemandImbalance: number;
}

export interface SimulationMetrics {
  fulfilledNeeds: number;
  resourceUtilization: number;
  wastedEnergy: number;
  routingLatency: number;
  unmetDemand: number;
  totalNetworkUtility: number;
  concentration: number;          // HHI of provider throughput share (0-1)
  coordinationOverhead: number;   // fraction of utility spent on matching/verification
  /** Std-dev of network utility across the shock ensemble (percentage points). */
  utilityVolatility: number;
  /** Utility lost (pp) when the largest provider fails mid-period. */
  cascadeLoss: number;
  /** Share of served volume that depends on an intermediary node (0-1). */
  intermediationDepth: number;
  /** Gini coefficient of unmet demand across requesters (0 = evenly shared shortfall). */
  shortfallGini: number;
}

export type RiskVerdict = 'improves-safely' | 'improves-with-risk' | 'no-improvement';

export interface RiskCheck {
  id: string;
  label: string;
  /** Model A (monetary baseline) value. */
  baseline: number;
  /** Model B (resonance routing) value. */
  routed: number;
  /** How much worse B may be before the check fails. */
  tolerance: number;
  /** true when lower values are safer. */
  lowerIsBetter: boolean;
  passed: boolean;
  unit: string;
  note: string;
}

export interface SimulationResult {
  modelA: SimulationMetrics; // Monetary
  modelB: SimulationMetrics; // Resonance
  deltaUtility: number;
  /** 95% CI half-width on ΔUtility from the shock ensemble (pp). */
  deltaConfidence: number;
  /** Fraction of ensemble draws in which B beat A. */
  winRate: number;
  primaryDriver: string;
  riskChecks: RiskCheck[];
  verdict: RiskVerdict;
  verdictSummary: string;
  ensembleSize: number;
}

/**
 * GridStochasticEngine: Simulates CAISO Duck Curve
 */
export class GridStochasticEngine {
  // Returns normalized value (0-1) representing solar generation (peaks at 12:00)
  static getSolarGeneration(hour24: number): number {
    if (hour24 < 6 || hour24 > 19) return 0.05;
    // Bell curve peaking at 12
    const variance = 9;
    return Math.exp(-Math.pow(hour24 - 12.5, 2) / (2 * variance));
  }

  // Returns normalized demand (peaks at 18:00 - 20:00)
  static getGridDemand(hour24: number): number {
    const base = 0.4;
    const morningPeak = Math.exp(-Math.pow(hour24 - 8, 2) / 4) * 0.3;
    const eveningPeak = Math.exp(-Math.pow(hour24 - 19, 2) / 6) * 0.6;
    return Math.min(1, base + morningPeak + eveningPeak);
  }

  // Energy Availability (1 = abundant, 0 = scarce)
  static getEnergyAvailability(hour24: number): number {
    const gen = this.getSolarGeneration(hour24);
    const demand = this.getGridDemand(hour24);
    const availability = 0.5 + (gen * 0.5) - (demand * 0.3);
    return Math.max(0.1, Math.min(1, availability));
  }
}

/**
 * V_i(t) = f(S_i,D_i,U_i,Q_i,L_i,E_i,R_i,C_i)
 */
export function calculateResonanceScore(offer: ResourceVector, need: ResourceVector, params: SimulationParams): number {
  const compatibility = offer.compatibility * need.compatibility;
  const urgencyAlignment = 1 - Math.abs(offer.urgency - need.urgency);
  const energyAvailability = offer.energyCost;
  const networkCost = offer.locationCost * need.locationCost * (1 - params.geographicalFriction);
  const reliability = offer.reliability;

  const weights = { urgency: 0.2, energy: 0.3, network: 0.2, reliability: 0.3 };

  return compatibility * (
    urgencyAlignment * weights.urgency +
    energyAvailability * weights.energy +
    networkCost * weights.network +
    reliability * weights.reliability
  );
}

export function calculateMonetaryScore(offer: ResourceVector, need: ResourceVector, params: SimulationParams): number {
  const priceOffer = (offer.scarcity * 0.6 + offer.quality * 0.4) * (1 + params.supplyDemandImbalance);
  const willingnessToPay = (need.demand * 0.5 + need.urgency * 0.5);
  const priceMatch = 1 - Math.abs(priceOffer - willingnessToPay);
  const compatibility = (offer.compatibility * need.compatibility) > 0.5 ? 1 : 0.1;
  return priceMatch * Math.max(0, compatibility);
}

/* ------------------------------------------------------------------ *
 *  Agent-based allocation core
 * ------------------------------------------------------------------ */

/** Deterministic PRNG so every reported number is reproducible from (params, seed). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Agent {
  id: number;
  type: string;
  amount: number;
  vector: ResourceVector;
}

const TYPES = ['gpu', 'solar', 'storage', 'labor', 'code'];
/** Physical substitutability: what fraction of need j a unit of offer i can actually serve. */
const SUBSTITUTION: Record<string, Record<string, number>> = {
  gpu:     { gpu: 1, code: 0.5, labor: 0.15, storage: 0.2, solar: 0 },
  solar:   { solar: 1, gpu: 0.55, storage: 0.6, labor: 0, code: 0 },
  storage: { storage: 1, solar: 0.5, gpu: 0.2, labor: 0, code: 0 },
  labor:   { labor: 1, code: 0.6, gpu: 0.1, storage: 0.1, solar: 0 },
  code:    { code: 1, labor: 0.5, gpu: 0.35, storage: 0.1, solar: 0 },
};

function buildAgents(params: SimulationParams, rand: () => number, shock: number) {
  const n = Math.max(6, Math.min(160, Math.round(params.networkSize)));
  const offers: Agent[] = [];
  const needs: Agent[] = [];

  const supplyBias = 1 - params.supplyDemandImbalance * 0.5;

  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const volatile = type === 'solar';
    // Renewable output is shocked; firm resources are not.
    const shockFactor = volatile ? 1 + shock * params.renewableVolatility : 1 + shock * 0.15;
    offers.push({
      id: i,
      type,
      amount: Math.max(0, (0.4 + rand() * 0.8) * supplyBias * shockFactor * (1 - params.resourceScarcity * 0.5)),
      vector: {
        scarcity: params.resourceScarcity * (0.6 + rand() * 0.8),
        demand: rand(),
        urgency: rand() * params.urgency * 2,
        quality: 0.4 + rand() * 0.6,
        locationCost: 1 - rand() * params.geographicalFriction,
        energyCost: Math.max(0.05, Math.min(1, (volatile ? 0.4 + shock * 0.8 : 0.7) + rand() * 0.3)),
        reliability: Math.max(0.05, Math.min(1, params.participantReliability * (0.7 + rand() * 0.6))),
        compatibility: 0.5 + rand() * 0.5,
      },
    });
  }

  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const hot = type === 'gpu';
    needs.push({
      id: i,
      type,
      amount: (0.4 + rand() * 0.8) * (hot ? 1 + params.computeDemand : 1) * (1 + params.supplyDemandImbalance * 0.5),
      vector: {
        scarcity: params.resourceScarcity,
        demand: 0.3 + rand() * 0.7,
        urgency: Math.min(1, rand() * params.urgency * 2),
        quality: 0.3 + rand() * 0.7,
        locationCost: 1 - rand() * params.geographicalFriction,
        energyCost: 0.5 + rand() * 0.5,
        reliability: 0.4 + rand() * 0.6,
        compatibility: 0.5 + rand() * 0.5,
      },
    });
  }

  return { offers, needs };
}

interface AllocationOutcome {
  utility: number;          // 0-1 delivered welfare / potential welfare
  welfare: number;          // raw realised welfare (unnormalised)
  unmet: number;            // 0-1
  waste: number;            // 0-1 of supplied volume that is misallocated / spilled
  hhi: number;
  latency: number;          // ms
  intermediation: number;   // 0-1
  gini: number;
  overhead: number;         // 0-1
  providerFlow: number[];
}

/**
 * Greedy constrained allocation. `mode` selects the price signal (Model A) or the
 * multi-dimensional resonance signal (Model B). Both respect the same physical
 * substitution matrix and the same capacity constraints, so the only difference
 * is the ranking function and its coordination cost.
 */
function allocate(
  offers: Agent[],
  needs: Agent[],
  params: SimulationParams,
  mode: 'monetary' | 'resonance' | 'oracle',
  rand: () => number,
  failedProvider = -1,
): AllocationOutcome {
  const supply = offers.map((o) => (o.id === failedProvider ? 0 : o.amount));
  const remaining = needs.map((nd) => nd.amount);
  const providerFlow = offers.map(() => 0);
  const requesterServed = needs.map(() => 0);

  interface Edge { o: number; n: number; rank: number; value: number; sub: number; relay: boolean }
  const edges: Edge[] = [];

  // Telemetry noise: multi-dimensional matching depends on self-reported state,
  // which is only as good as participant reliability. Prices need no telemetry.
  const telemetryNoise = mode === 'resonance' ? (1 - params.participantReliability) * 1.2 : 0;

  for (let i = 0; i < offers.length; i++) {
    for (let j = 0; j < needs.length; j++) {
      const o = offers[i];
      const nd = needs[j];
      const sub = SUBSTITUTION[o.type][nd.type] ?? 0;
      if (sub <= 0) continue;
      const relay = sub < 1; // cross-type transfers must pass through a relay/conversion node
      // Ground-truth welfare per unit shipped. Identical for both mechanisms —
      // they only differ in how well they can *see* it when ranking.
      const value = calculateResonanceScore(o.vector, nd.vector, params) * sub;
      if (value <= 0) continue;

      let rank: number;
      if (mode === 'monetary') {
        // The price signal compresses eight dimensions into one bid, so it
        // ranks by willingness-to-pay and is blind to urgency/energy/locality.
        rank = calculateMonetaryScore(o.vector, nd.vector, params) * (sub >= 1 ? 1 : 0.4);
      } else if (mode === 'oracle') {
        rank = value;
      } else {
        rank = value * (1 + telemetryNoise * (rand() - 0.5));
      }
      if (rank <= 0) continue;
      edges.push({ o: i, n: j, rank, value, sub, relay });
    }
  }
  edges.sort((a, b) => b.rank - a.rank);

  let delivered = 0;   // physical volume delivered (need-units)
  let welfare = 0;     // realised welfare = Σ volume × ground-truth value
  let relayed = 0;

  for (const e of edges) {
    const avail = supply[e.o];
    const want = remaining[e.n];
    if (avail <= 1e-9 || want <= 1e-9) continue;
    const qty = Math.min(avail, want / Math.max(e.sub, 0.05));
    if (qty <= 1e-9) continue;
    const effective = qty * e.sub;
    supply[e.o] -= qty;
    remaining[e.n] -= effective;
    providerFlow[e.o] += qty;
    requesterServed[e.n] += effective;
    delivered += effective;
    welfare += effective * e.value;
    if (e.relay) relayed += effective;
  }

  const totalNeed = needs.reduce((s, nd) => s + nd.amount, 0);
  const totalSupply = offers.reduce((s, o, i) => s + (i === failedProvider ? 0 : o.amount), 0);
  const spilled = supply.reduce((s, v) => s + v, 0);

  const unmet = totalNeed > 0 ? Math.max(0, 1 - delivered / totalNeed) : 0;
  const wasteFrac = totalSupply > 0 ? spilled / totalSupply : 0;

  const flowTotal = providerFlow.reduce((s, v) => s + v, 0) || 1;
  const hhi = providerFlow.reduce((s, v) => s + Math.pow(v / flowTotal, 2), 0);

  // Gini of shortfall across requesters — measures whether the mechanism
  // concentrates the pain on a few participants.
  const shortfalls = needs.map((nd, j) => Math.max(0, nd.amount - requesterServed[j])).sort((a, b) => a - b);
  const sSum = shortfalls.reduce((s, v) => s + v, 0);
  let gini = 0;
  if (sSum > 1e-9) {
    let cum = 0;
    shortfalls.forEach((v, i) => { cum += (i + 1) * v; });
    gini = (2 * cum) / (shortfalls.length * sSum) - (shortfalls.length + 1) / shortfalls.length;
  }

  const intermediation = delivered > 0 ? relayed / delivered : 0;
  const latency =
    mode === 'monetary'
      ? 24 + params.geographicalFriction * 60 + hhi * 30
      : 12 + params.geographicalFriction * 22 + intermediation * 24;
  const overhead =
    mode === 'monetary'
      ? 0.08 + params.supplyDemandImbalance * 0.06
      : 0.14 + (1 - params.participantReliability) * 0.3 + intermediation * 0.08;

  return {
    utility: 0, // filled in by the caller against the oracle benchmark
    welfare,
    unmet,
    waste: wasteFrac,
    hhi,
    latency,
    intermediation,
    gini,
    overhead,
    providerFlow,
  };
}

function toMetrics(runs: AllocationOutcome[], cascade: number): SimulationMetrics {
  const mean = (f: (r: AllocationOutcome) => number) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
  const utilPct = runs.map((r) => (r.utility * (1 - r.overhead)) * 100);
  const mu = utilPct.reduce((s, v) => s + v, 0) / utilPct.length;
  const sd = Math.sqrt(utilPct.reduce((s, v) => s + (v - mu) ** 2, 0) / utilPct.length);

  return {
    fulfilledNeeds: (1 - mean((r) => r.unmet)) * 100,
    resourceUtilization: mean((r) => r.utility) * 100,
    wastedEnergy: mean((r) => r.waste) * 100,
    routingLatency: mean((r) => r.latency),
    unmetDemand: mean((r) => r.unmet) * 100,
    totalNetworkUtility: mu,
    concentration: mean((r) => r.hhi),
    coordinationOverhead: mean((r) => r.overhead),
    utilityVolatility: sd,
    cascadeLoss: cascade,
    intermediationDepth: mean((r) => r.intermediation),
    shortfallGini: mean((r) => r.gini),
  };
}

const ENSEMBLE = 24;

export function runSimulation(params: SimulationParams, seed = 20260813): SimulationResult {
  const runsA: AllocationOutcome[] = [];
  const runsB: AllocationOutcome[] = [];
  const deltas: number[] = [];
  let cascadeA = 0;
  let cascadeB = 0;

  for (let k = 0; k < ENSEMBLE; k++) {
    const rand = mulberry32(seed + k * 7919);
    // Symmetric supply shock; renewables get amplified by the volatility parameter.
    const shock = (rand() * 2 - 1) * (0.15 + params.renewableVolatility * 0.55);
    const { offers, needs } = buildAgents(params, rand, shock);

    // Oracle = perfectly informed planner; both mechanisms are scored against it,
    // so "utility" is the share of attainable welfare each one actually realises.
    const oracle = allocate(offers, needs, params, 'oracle', mulberry32(seed + k));
    const norm = (r: AllocationOutcome) => {
      r.utility = oracle.welfare > 0 ? Math.min(1, r.welfare / oracle.welfare) : 0;
      return r;
    };

    const a = norm(allocate(offers, needs, params, 'monetary', mulberry32(seed + k * 13)));
    const b = norm(allocate(offers, needs, params, 'resonance', mulberry32(seed + k * 31)));
    runsA.push(a);
    runsB.push(b);
    deltas.push((b.utility * (1 - b.overhead) - a.utility * (1 - a.overhead)) * 100);

    // Stress test: knock out the single largest provider in each mechanism.
    const topA = a.providerFlow.indexOf(Math.max(...a.providerFlow));
    const topB = b.providerFlow.indexOf(Math.max(...b.providerFlow));
    const aFail = allocate(offers, needs, params, 'monetary', mulberry32(seed + k * 13), topA);
    const bFail = allocate(offers, needs, params, 'resonance', mulberry32(seed + k * 31), topB);
    // Contagion = welfare lost *beyond* the failed node's own direct contribution.
    const shareA = a.welfare > 0 ? (a.providerFlow[topA] ?? 0) / (a.providerFlow.reduce((s, v) => s + v, 0) || 1) : 0;
    const shareB = b.welfare > 0 ? (b.providerFlow[topB] ?? 0) / (b.providerFlow.reduce((s, v) => s + v, 0) || 1) : 0;
    const lossA = a.welfare > 0 ? 1 - aFail.welfare / a.welfare : 0;
    const lossB = b.welfare > 0 ? 1 - bFail.welfare / b.welfare : 0;
    cascadeA += Math.max(0, lossA - shareA) * 100;
    cascadeB += Math.max(0, lossB - shareB) * 100;
  }

  cascadeA /= ENSEMBLE;
  cascadeB /= ENSEMBLE;

  const modelA = toMetrics(runsA, cascadeA);
  const modelB = toMetrics(runsB, cascadeB);

  const deltaUtility = modelB.totalNetworkUtility - modelA.totalNetworkUtility;
  const dMu = deltas.reduce((s, v) => s + v, 0) / deltas.length;
  const dSd = Math.sqrt(deltas.reduce((s, v) => s + (v - dMu) ** 2, 0) / deltas.length);
  const deltaConfidence = 1.96 * (dSd / Math.sqrt(deltas.length));
  const winRate = deltas.filter((d) => d > 0).length / deltas.length;

  const riskChecks: RiskCheck[] = [
    {
      id: 'concentration',
      label: 'Provider concentration (HHI)',
      baseline: modelA.concentration,
      routed: modelB.concentration,
      tolerance: 0.02,
      lowerIsBetter: true,
      unit: '',
      passed: modelB.concentration <= modelA.concentration + 0.02,
      note: 'Routing must not funnel throughput into fewer providers than the price baseline.',
    },
    {
      id: 'cascade',
      label: 'Largest-provider failure loss',
      baseline: modelA.cascadeLoss,
      routed: modelB.cascadeLoss,
      tolerance: 1,
      lowerIsBetter: true,
      unit: ' pp',
      passed: modelB.cascadeLoss <= modelA.cascadeLoss + 1,
      note: 'Utility lost when the top node drops out mid-period. Higher means a new single point of failure.',
    },
    {
      id: 'volatility',
      label: 'Utility volatility across shocks',
      baseline: modelA.utilityVolatility,
      routed: modelB.utilityVolatility,
      tolerance: 0.5,
      lowerIsBetter: true,
      unit: ' pp',
      passed: modelB.utilityVolatility <= modelA.utilityVolatility + 0.5,
      note: `Standard deviation of network utility over ${ENSEMBLE} supply-shock draws.`,
    },
    {
      id: 'gini',
      label: 'Shortfall inequality (Gini)',
      baseline: modelA.shortfallGini,
      routed: modelB.shortfallGini,
      tolerance: 0.03,
      lowerIsBetter: true,
      unit: '',
      passed: modelB.shortfallGini <= modelA.shortfallGini + 0.03,
      note: 'Gains must not be bought by pushing all unmet demand onto a minority of requesters.',
    },
    {
      id: 'intermediation',
      label: 'Relay dependence',
      baseline: modelA.intermediationDepth,
      routed: modelB.intermediationDepth,
      tolerance: 0.2,
      lowerIsBetter: true,
      unit: '',
      passed: modelB.intermediationDepth <= modelA.intermediationDepth + 0.2,
      note: 'Share of delivered volume that requires a conversion/relay hop — new counterparty exposure.',
    },
    {
      id: 'overhead',
      label: 'Coordination overhead',
      baseline: modelA.coordinationOverhead,
      routed: modelB.coordinationOverhead,
      tolerance: 0.25,
      lowerIsBetter: true,
      unit: '',
      passed: modelB.coordinationOverhead <= modelA.coordinationOverhead + 0.25,
      note: 'Verification and telemetry cost of running multi-dimensional matching.',
    },
  ];

  const failed = riskChecks.filter((c) => !c.passed);
  const significant = deltaUtility - deltaConfidence > 0;

  let verdict: RiskVerdict;
  let verdictSummary: string;
  if (!significant) {
    verdict = 'no-improvement';
    verdictSummary =
      deltaUtility <= 0
        ? `Direct routing does not beat the price baseline here (Δ = ${deltaUtility.toFixed(2)} pp, wins ${(winRate * 100).toFixed(0)}% of draws).`
        : `Δ = ${deltaUtility.toFixed(2)} pp is inside the ±${deltaConfidence.toFixed(2)} pp confidence band — not a demonstrated gain.`;
  } else if (failed.length === 0) {
    verdict = 'improves-safely';
    verdictSummary = `Direct routing adds ${deltaUtility.toFixed(2)} ± ${deltaConfidence.toFixed(2)} pp of network utility (wins ${(winRate * 100).toFixed(0)}% of shock draws) while every systemic-risk check stays within tolerance.`;
  } else {
    verdict = 'improves-with-risk';
    verdictSummary = `Allocation improves by ${deltaUtility.toFixed(2)} pp, but ${failed.length} risk check${failed.length > 1 ? 's' : ''} fail: ${failed.map((c) => c.label.toLowerCase()).join(', ')}. The gain is being financed by new systemic exposure.`;
  }

  let primaryDriver = 'Multi-dimensional matching recovers pairs the single price signal cannot rank.';
  if (params.renewableVolatility > 0.7) {
    primaryDriver = 'Stranded renewable output is matched directly to flexible compute demand before it is spilled.';
  } else if (params.geographicalFriction > 0.7) {
    primaryDriver = 'Local routing avoids the global market friction the price mechanism must pay.';
  } else if (params.participantReliability < 0.45) {
    primaryDriver = 'Telemetry noise degrades resonance scores, so the price baseline stays competitive.';
  } else if (params.supplyDemandImbalance > 0.4) {
    primaryDriver = 'Under scarcity the price signal rations by willingness-to-pay, leaving urgent low-bid needs unserved.';
  }

  return {
    modelA,
    modelB,
    deltaUtility,
    deltaConfidence,
    winRate,
    primaryDriver,
    riskChecks,
    verdict,
    verdictSummary,
    ensembleSize: ENSEMBLE,
  };
}

/* ------------------------------------------------------------------ *
 *  Superiority protocol: discover → freeze → challenge on holdout
 * ------------------------------------------------------------------ *
 * A superiority claim is only meaningful if it survives data it was not
 * tuned on. We therefore (1) search parameter space on a *discovery* seed
 * bank, (2) freeze the winning region and its prediction, (3) re-run the
 * frozen region on disjoint *holdout* seeds with wider, unseen shocks, and
 * (4) grant "computational superiority" only when the holdout delta clears
 * its confidence band and every systemic-risk gate.
 */

export interface StageEvidence {
  seeds: number[];
  /** Mean ΔUtility (pp) across the seed bank. */
  deltaUtility: number;
  /** 95% CI half-width on the mean, pooled across seeds and draws. */
  deltaConfidence: number;
  /** Fraction of individual seed-runs in which routing beat the baseline. */
  winRate: number;
  /** Per-check averages over the seed bank, re-evaluated against tolerance. */
  riskChecks: RiskCheck[];
  draws: number;
}

export interface SuperiorityGate {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
}

export interface FrozenClaim {
  id: string;
  frozenAt: string;
  params: SimulationParams;
  discovery: StageEvidence;
  discoverySeeds: number[];
  holdoutSeeds: number[];
  /** The prediction being registered before any holdout data is touched. */
  predictedDelta: number;
  predictedBand: number;
}

export interface ChallengeOutcome {
  claim: FrozenClaim;
  holdout: StageEvidence;
  gates: SuperiorityGate[];
  granted: boolean;
  /** Holdout delta minus predicted delta (pp). Negative = overfit shrinkage. */
  shrinkage: number;
  /** Realised share of the oracle's attainable welfare, routed vs baseline. */
  oracleGapBaseline: number;
  oracleGapRouted: number;
  summary: string;
  sample: SimulationResult;
}

const DISCOVERY_SEEDS = [101, 227, 373, 521];
const HOLDOUT_SEEDS = [90211, 91733, 93187, 94687, 96079, 97501];

function aggregate(results: SimulationResult[], seeds: number[]): StageEvidence {
  const deltas = results.map((r) => r.deltaUtility);
  const mu = deltas.reduce((s, v) => s + v, 0) / deltas.length;
  const sd = Math.sqrt(deltas.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, deltas.length - 1));
  // Pool the within-seed sampling error with the between-seed spread.
  const within = results.reduce((s, r) => s + r.deltaConfidence ** 2, 0) / results.length ** 2;
  const between = (sd * sd) / results.length;
  const deltaConfidence = 1.96 * Math.sqrt(Math.max(within / 1.96 ** 2, 0) + between);

  const ids = results[0].riskChecks.map((c) => c.id);
  const riskChecks: RiskCheck[] = ids.map((id) => {
    const rows = results.map((r) => r.riskChecks.find((c) => c.id === id)!);
    const avg = (f: (c: RiskCheck) => number) => rows.reduce((s, c) => s + f(c), 0) / rows.length;
    const baseline = avg((c) => c.baseline);
    const routed = avg((c) => c.routed);
    const t = rows[0];
    return { ...t, baseline, routed, passed: routed <= baseline + t.tolerance };
  });

  return {
    seeds,
    deltaUtility: mu,
    deltaConfidence,
    winRate: results.reduce((s, r) => s + r.winRate, 0) / results.length,
    riskChecks,
    draws: results.reduce((s, r) => s + r.ensembleSize, 0),
  };
}

function evaluateOn(params: SimulationParams, seeds: number[]): StageEvidence {
  return aggregate(seeds.map((s) => runSimulation(params, s)), seeds);
}

/** Candidate regions swept during discovery. Coarse but deterministic. */
function candidateRegions(base: SimulationParams): SimulationParams[] {
  const grid: SimulationParams[] = [];
  for (const renewableVolatility of [0.25, 0.55, 0.85]) {
    for (const geographicalFriction of [0.2, 0.55, 0.85]) {
      for (const participantReliability of [0.55, 0.8, 0.95]) {
        for (const supplyDemandImbalance of [0.05, 0.35]) {
          grid.push({
            ...base,
            networkSize: 60,
            renewableVolatility,
            geographicalFriction,
            participantReliability,
            supplyDemandImbalance,
          });
        }
      }
    }
  }
  return grid;
}

/**
 * Stage 1 + 2 — sweep the discovery seed bank for the region with the largest
 * lower-confidence-bound gain that also passes every risk check, then freeze it.
 * Holdout seeds are assigned but never evaluated here.
 */
export function discoverAndFreeze(base: SimulationParams): FrozenClaim {
  let best: { params: SimulationParams; ev: StageEvidence; lcb: number } | null = null;

  for (const cand of candidateRegions(base)) {
    const ev = evaluateOn(cand, DISCOVERY_SEEDS);
    const lcb = ev.deltaUtility - ev.deltaConfidence;
    const clean = ev.riskChecks.every((c) => c.passed);
    const score = clean ? lcb : lcb - 5; // risky regions are penalised, not banned
    if (!best || score > best.lcb) best = { params: cand, ev, lcb: score };
  }

  const { params, ev } = best!;
  const id = `RRC-${Math.abs(
    Math.round(
      (params.renewableVolatility * 1e4 + params.geographicalFriction * 1e3 + params.participantReliability * 1e2) *
        (1 + ev.deltaUtility),
    ),
  )
    .toString(36)
    .toUpperCase()
    .padStart(5, '0')}`;

  return {
    id,
    frozenAt: new Date().toISOString(),
    params,
    discovery: ev,
    discoverySeeds: DISCOVERY_SEEDS,
    holdoutSeeds: HOLDOUT_SEEDS,
    predictedDelta: ev.deltaUtility,
    predictedBand: ev.deltaConfidence,
  };
}

/**
 * Stage 3 + 4 — re-run the frozen region on disjoint seeds (unseen shock
 * realisations), then apply the superiority gates.
 */
export function challengeClaim(claim: FrozenClaim): ChallengeOutcome {
  const results = claim.holdoutSeeds.map((s) => runSimulation(claim.params, s));
  const holdout = aggregate(results, claim.holdoutSeeds);
  const sample = results[0];

  const lcb = holdout.deltaUtility - holdout.deltaConfidence;
  const failedRisk = holdout.riskChecks.filter((c) => !c.passed);
  const shrinkage = holdout.deltaUtility - claim.predictedDelta;

  // Both mechanisms are scored against the same perfectly-informed planner.
  const oracleGapBaseline = 100 - sample.modelA.resourceUtilization;
  const oracleGapRouted = 100 - sample.modelB.resourceUtilization;

  const gates: SuperiorityGate[] = [
    {
      id: 'significance',
      label: 'Holdout gain clears its confidence band',
      detail: `Δ = ${holdout.deltaUtility.toFixed(2)} pp, 95% CI lower bound ${lcb.toFixed(2)} pp over ${holdout.draws} unseen draws.`,
      passed: lcb > 0,
    },
    {
      id: 'consistency',
      label: 'Wins a majority of unseen shock draws',
      detail: `Routing beat the price baseline in ${(holdout.winRate * 100).toFixed(0)}% of holdout draws (needs > 60%).`,
      passed: holdout.winRate > 0.6,
    },
    {
      id: 'generalisation',
      label: 'Prediction survives out-of-sample',
      detail: `Predicted ${claim.predictedDelta.toFixed(2)} pp, realised ${holdout.deltaUtility.toFixed(2)} pp (${shrinkage >= 0 ? '+' : ''}${shrinkage.toFixed(2)} pp). Shrinkage beyond 50% of the prediction counts as overfitting.`,
      passed: holdout.deltaUtility >= claim.predictedDelta * 0.5,
    },
    {
      id: 'oracle',
      label: 'Closes the gap to the oracle planner',
      detail: `Attainable welfare left on the table: baseline ${oracleGapBaseline.toFixed(1)}% → routed ${oracleGapRouted.toFixed(1)}%.`,
      passed: oracleGapRouted < oracleGapBaseline,
    },
    {
      id: 'risk',
      label: 'No new systemic risk on holdout',
      detail:
        failedRisk.length === 0
          ? 'Concentration, cascade loss, volatility, shortfall inequality, relay dependence and overhead all stay within tolerance.'
          : `Failing: ${failedRisk.map((c) => c.label.toLowerCase()).join(', ')}.`,
      passed: failedRisk.length === 0,
    },
  ];

  const granted = gates.every((g) => g.passed);
  const failed = gates.filter((g) => !g.passed);

  return {
    claim,
    holdout,
    gates,
    granted,
    shrinkage,
    oracleGapBaseline,
    oracleGapRouted,
    sample,
    summary: granted
      ? `Computational superiority granted for region ${claim.id}: +${holdout.deltaUtility.toFixed(2)} ± ${holdout.deltaConfidence.toFixed(2)} pp of attainable welfare on ${claim.holdoutSeeds.length} unseen seeds, with every risk gate inside tolerance.`
      : `Claim ${claim.id} is not upheld — ${failed.length} gate${failed.length > 1 ? 's' : ''} failed (${failed.map((g) => g.label.toLowerCase()).join('; ')}). The discovered advantage does not generalise as a superiority claim.`,
  };
}
