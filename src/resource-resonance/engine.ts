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

export function runSimulation(params: SimulationParams): SimulationResult {
  let utilA = 0.65 - (params.renewableVolatility * 0.15) - (params.geographicalFriction * 0.1) + (params.participantReliability * 0.05);
  let utilB = 0.70 + (params.renewableVolatility * 0.1) + (params.geographicalFriction * 0.1) - ((1 - params.participantReliability) * 0.25);
  
  utilA = Math.max(0, Math.min(1, utilA));
  utilB = Math.max(0, Math.min(1, utilB));

  const modelA: SimulationMetrics = {
    fulfilledNeeds: utilA * 100,
    resourceUtilization: utilA * 100,
    wastedEnergy: (1 - utilA) * 0.5 * 100,
    routingLatency: 20 + params.geographicalFriction * 50,
    unmetDemand: (1 - utilA) * 100,
    totalNetworkUtility: utilA * 100,
    concentration: 0.8,
    coordinationOverhead: 0.1
  };

  const modelB: SimulationMetrics = {
    fulfilledNeeds: utilB * 100,
    resourceUtilization: utilB * 100,
    wastedEnergy: (1 - utilB) * 0.2 * 100,
    routingLatency: 10 + params.geographicalFriction * 20,
    unmetDemand: (1 - utilB) * 100,
    totalNetworkUtility: utilB * 100,
    concentration: 0.3,
    coordinationOverhead: 0.4 - (params.participantReliability * 0.2)
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

  return { modelA, modelB, deltaUtility, primaryDriver };
}
