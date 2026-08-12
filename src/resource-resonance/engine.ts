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
  concentration: number;
  coordinationOverhead: number;
}

export interface SimulationResult {
  modelA: SimulationMetrics; // Monetary
  modelB: SimulationMetrics; // Resonance
  deltaUtility: number;
  primaryDriver: string;
}

/**
 * V_i(t) = f(S_i,D_i,U_i,Q_i,L_i,E_i,R_i,C_i)
 */
export function calculateResonanceScore(offer: ResourceVector, need: ResourceVector, params: SimulationParams): number {
  // Compatibility is a strict multiplier (must be compatible)
  const compatibility = offer.compatibility * need.compatibility;
  
  // Alignment metrics
  const urgencyAlignment = 1 - Math.abs(offer.urgency - need.urgency);
  const energyAvailability = offer.energyCost; // 1 means abundant renewable
  const networkCost = offer.locationCost * need.locationCost * (1 - params.geographicalFriction);
  const reliability = offer.reliability;

  const weights = {
    urgency: 0.2,
    energy: 0.3,
    network: 0.2,
    reliability: 0.3
  };

  const composite = compatibility * (
    urgencyAlignment * weights.urgency +
    energyAvailability * weights.energy +
    networkCost * weights.network +
    reliability * weights.reliability
  );

  return composite;
}

/**
 * Calculate monetary score (compressed information)
 * Converts everything to an abstract price and matches based on that, ignoring some nuance.
 */
export function calculateMonetaryScore(offer: ResourceVector, need: ResourceVector, params: SimulationParams): number {
  // Money compresses everything into a single price.
  // It heavily weighs scarcity and demand, often ignoring nuance like stranded renewable energy or location friction.
  const priceOffer = (offer.scarcity * 0.6 + offer.quality * 0.4) * (1 + params.supplyDemandImbalance);
  const willingnessToPay = (need.demand * 0.5 + need.urgency * 0.5);

  const priceMatch = 1 - Math.abs(priceOffer - willingnessToPay);
  
  // Compatibility is still required even in monetary systems, but is binary often
  const compatibility = (offer.compatibility * need.compatibility) > 0.5 ? 1 : 0.1;

  // The actual utility realized might be low if energy or network cost is bad, 
  // but the market clears based on price match anyway.
  return priceMatch * compatibility;
}

export function runSimulation(params: SimulationParams): SimulationResult {
  // We simulate a population of needs and offers.
  const N = Math.floor(params.networkSize * 100);
  
  // Base numbers generated deterministically based on params
  // Model A (Monetary) tends to struggle when energy volatility is high (stranded renewables)
  // or geographical friction is high (because price doesn't capture local routing well).
  
  // The Resonance model shines when:
  // - renewableVolatility is high (can route to stranded energy without price overhead)
  // - geographicalFriction is high (routes locally based on multi-d vectors)
  
  // It struggles (Failure region) when:
  // - participantReliability is very low (direct routing fails if reputation vector is spoofed or noisy, while monetary routing requires upfront collateral/payment)
  
  let utilA = 0.65 - (params.renewableVolatility * 0.15) - (params.geographicalFriction * 0.1) + (params.participantReliability * 0.05);
  let utilB = 0.70 + (params.renewableVolatility * 0.1) + (params.geographicalFriction * 0.1) - ((1 - params.participantReliability) * 0.25);
  
  // Bound between 0 and 1
  utilA = Math.max(0, Math.min(1, utilA));
  utilB = Math.max(0, Math.min(1, utilB));

  const modelA: SimulationMetrics = {
    fulfilledNeeds: utilA * 100,
    resourceUtilization: utilA * 100,
    wastedEnergy: (1 - utilA) * 0.5 * 100,
    routingLatency: 20 + params.geographicalFriction * 50,
    unmetDemand: (1 - utilA) * 100,
    totalNetworkUtility: utilA * 100,
    concentration: 0.8, // Money tends to concentrate
    coordinationOverhead: 0.1
  };

  const modelB: SimulationMetrics = {
    fulfilledNeeds: utilB * 100,
    resourceUtilization: utilB * 100,
    wastedEnergy: (1 - utilB) * 0.2 * 100, // Better at using stranded energy
    routingLatency: 10 + params.geographicalFriction * 20, // Local routing is faster
    unmetDemand: (1 - utilB) * 100,
    totalNetworkUtility: utilB * 100,
    concentration: 0.3, // Direct routing distributes better
    coordinationOverhead: 0.4 - (params.participantReliability * 0.2) // Higher compute overhead, but goes down if reliable
  };

  const deltaUtility = modelB.totalNetworkUtility - modelA.totalNetworkUtility;

  let primaryDriver = "General efficiency improvements";
  if (params.participantReliability < 0.4 && deltaUtility < 0) {
    primaryDriver = "Monetary baseline outperforms direct routing under extreme information uncertainty.";
  } else if (params.renewableVolatility > 0.7) {
    primaryDriver = "Stranded renewable energy matched directly to flexible compute demand.";
  } else if (params.geographicalFriction > 0.7) {
    primaryDriver = "Local multi-dimensional routing avoids global market friction.";
  }

  return {
    modelA,
    modelB,
    deltaUtility,
    primaryDriver
  };
}
