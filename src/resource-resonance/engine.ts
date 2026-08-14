export interface ResourceVector {
  scarcity: number; demand: number; urgency: number; quality: number;
  locationCost: number; energyCost: number; reliability: number; compatibility: number;
}

export interface ResourceOffer { id: string; providerId: string; type: string; amount: number; vector: ResourceVector }
export interface ResourceNeed { id: string; requesterId: string; type: string; amount: number; vector: ResourceVector }
export interface MatchResult {
  offerId: string; needId: string; amount: number; score: number; routeType: 'direct' | 'multi-hop'; relayNodeId?: string;
  explanation: { compositeMatch: number; compatibility: number; energyAvailability: number; urgencyAlignment: number; networkCost: number; reliability: number };
}

/** All rates are fractions in [0, 1], except latency (periods) and costs. */
export interface SimulationParams {
  resourceScarcity: number; networkSize: number; renewableVolatility: number; computeDemand: number; urgency: number;
  geographicalFriction: number; participantReliability: number; supplyDemandImbalance: number; flexibleComputeShare: number;
  marketOverhead: number; hybridOverhead: number; genesisOverhead: number; telemetryVerificationCost: number;
  creditAvailability: number; liquidityStress: number; counterpartyRisk: number; collateralHaircut: number;
  settlementReliability: number; settlementLatency: number; fundingCost: number; priceSignalNoise: number;
  centralBankBackstop: boolean; backstopCapacity: number; telemetryReliability: number;
  criticalDemandThreshold: number; monetaryDeteriorationThreshold: number; physicalAvailabilityThreshold: number;
  riskTolerance: number;
}

export type Architecture = 'market' | 'stabilizedMarket' | 'hybrid' | 'genesis';
export type ArchitectureVerdict = 'MARKET SUPERIOR' | 'STABILIZED MARKET SUPERIOR' | 'HYBRID SUPERIOR' |
  'GENESIS SUPERIOR IN THIS REGIME' | 'NO SIGNIFICANT DIFFERENCE' | 'INSUFFICIENT EVIDENCE';
export type SafetyValveState = 'NORMAL' | 'FINANCIAL_STRESS' | 'STABILIZED_MARKET' | 'HYBRID' | 'GENESIS_BASELINE' | 'RECOVERY';

export interface UnmetDemandDecomposition {
  physicalShortage: number; financialExclusion: number; networkConstraint: number; compatibilityConstraint: number;
}

export interface SimulationMetrics {
  fulfilledNeeds: number; resourceUtilization: number; wastedEnergy: number; routingLatency: number; unmetDemand: number;
  totalNetworkUtility: number; concentration: number; coordinationOverhead: number; utilityVolatility: number; cascadeLoss: number;
  intermediationDepth: number; shortfallGini: number;
  creditConcentration: number; settlementFailureRate: number; backstopUtilization: number; liquidityShortfall: number;
  feasibleButUnservedDemand: number; strandedPhysicalUtility: number; telemetryCorruptionSensitivity: number;
  unmetDemandDecomposition: UnmetDemandDecomposition;
}

export type RiskVerdict = 'improves-safely' | 'improves-with-risk' | 'no-improvement';
export interface RiskCheck { id: string; label: string; baseline: number; routed: number; tolerance: number; lowerIsBetter: boolean; passed: boolean; unit: string; note: string }
export interface SafetyValveAssessment { state: SafetyValveState; conditions: { id: string; label: string; value: number | boolean; threshold?: number; passed: boolean }[]; explanation: string }
export interface SimulationResult {
  architectures: Record<Architecture, SimulationMetrics>;
  modelA: SimulationMetrics; modelStabilized: SimulationMetrics; modelHybrid: SimulationMetrics; modelB: SimulationMetrics;
  deltaUtility: number; deltaVsHybrid: number; deltaConfidence: number; winRate: number; primaryDriver: string;
  riskChecks: RiskCheck[]; verdict: RiskVerdict; architectureVerdict: ArchitectureVerdict; verdictSummary: string;
  reasons: Record<Architecture, string[]>; safetyValve: SafetyValveAssessment; physicalCapacity: number; totalDemand: number; ensembleSize: number;
}

export interface ScenarioPreset { id: string; name: string; description: string; patch: Partial<SimulationParams>; financialOnly?: boolean }
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: 'normal', name: 'Normal Market', description: 'Liquid credit and reliable settlement.', patch: { liquidityStress: .08, creditAvailability: .9, counterpartyRisk: .05, settlementReliability: .98, priceSignalNoise: .05 } },
  { id: 'credit-freeze', name: 'Credit Freeze', description: 'Credit supply contracts while physical capacity is unchanged.', financialOnly: true, patch: { creditAvailability: .12, liquidityStress: .88, fundingCost: .2 } },
  { id: 'intermediary-failure', name: 'Major Intermediary Failure', description: 'Counterparty and credit concentration stress.', financialOnly: true, patch: { counterpartyRisk: .72, settlementReliability: .7, creditAvailability: .35 } },
  { id: 'settlement', name: 'Settlement Disruption', description: 'Payment rails become slow and unreliable.', financialOnly: true, patch: { settlementReliability: .42, settlementLatency: .85 } },
  { id: 'inflation', name: 'Inflation / Price-Signal Noise', description: 'Relative-price information is obscured without removing supply.', financialOnly: true, patch: { priceSignalNoise: .75, fundingCost: .14 } },
  { id: 'cb-success', name: 'Successful Central-Bank Liquidity Intervention', description: 'A solvent market receives ample lender-of-last-resort liquidity.', financialOnly: true, patch: { liquidityStress: .76, creditAvailability: .35, counterpartyRisk: .08, centralBankBackstop: true, backstopCapacity: .8 } },
  { id: 'telemetry', name: 'Telemetry Corruption', description: 'Physical reports become unreliable.', patch: { telemetryReliability: .25, participantReliability: .45 } },
  { id: 'physical', name: 'Real Physical Resource Shock', description: 'Energy, compute and storage capacity disappear.', patch: { resourceScarcity: .92, renewableVolatility: .85, supplyDemandImbalance: .65 } },
  { id: 'trust', name: 'Low-Trust Network', description: 'Both counterparties and telemetry are difficult to verify.', patch: { counterpartyRisk: .55, telemetryReliability: .38, participantReliability: .45, settlementReliability: .65 } },
  { id: 'combined', name: 'Combined Financial + Physical Crisis', description: 'Credit and settlement disruption coincide with real scarcity.', patch: { resourceScarcity: .88, supplyDemandImbalance: .6, liquidityStress: .85, creditAvailability: .2, settlementReliability: .5, counterpartyRisk: .6 } },
];

export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  resourceScarcity: .5, networkSize: 24, renewableVolatility: .6, computeDemand: .8, urgency: .5,
  geographicalFriction: .3, participantReliability: .8, supplyDemandImbalance: .1, flexibleComputeShare: .65,
  marketOverhead: .04, hybridOverhead: .07, genesisOverhead: .09, telemetryVerificationCost: .08,
  creditAvailability: .78, liquidityStress: .18, counterpartyRisk: .1, collateralHaircut: .2,
  settlementReliability: .96, settlementLatency: .12, fundingCost: .05, priceSignalNoise: .08,
  centralBankBackstop: true, backstopCapacity: .45, telemetryReliability: .88,
  criticalDemandThreshold: .16, monetaryDeteriorationThreshold: .12, physicalAvailabilityThreshold: .35, riskTolerance: .05,
};

export class GridStochasticEngine {
  static getSolarGeneration(hour24: number) { return hour24 < 6 || hour24 > 19 ? .05 : Math.exp(-((hour24 - 12.5) ** 2) / 18); }
  static getGridDemand(hour24: number) { return Math.min(1, .4 + Math.exp(-((hour24 - 8) ** 2) / 4) * .3 + Math.exp(-((hour24 - 19) ** 2) / 6) * .6); }
  static getEnergyAvailability(hour24: number) { return clamp(.5 + this.getSolarGeneration(hour24) * .5 - this.getGridDemand(hour24) * .3, .1, 1); }
}
export function calculateResonanceScore(o: ResourceVector, n: ResourceVector, p: SimulationParams) {
  return o.compatibility * n.compatibility * ((1 - Math.abs(o.urgency - n.urgency)) * .2 + o.energyCost * .3 + o.locationCost * n.locationCost * (1 - p.geographicalFriction) * .2 + o.reliability * .3);
}
export function calculateMonetaryScore(o: ResourceVector, n: ResourceVector, p: SimulationParams) {
  const price = (o.scarcity * .45 + o.quality * .35 + (1 - o.locationCost) * .2) * (1 + p.supplyDemandImbalance);
  const bid = n.demand * .45 + n.urgency * .55;
  return Math.max(0, 1 - Math.abs(price - bid)) * (o.compatibility * n.compatibility > .5 ? 1 : .1);
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function mulberry32(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TYPES = ['gpu', 'solar', 'storage'];
const SUB: Record<string, Record<string, number>> = { gpu: { gpu: 1, solar: 0, storage: .15 }, solar: { gpu: .72, solar: 1, storage: .9 }, storage: { gpu: .7, solar: .82, storage: 1 } };
interface Agent { id: number; type: string; amount: number; vector: ResourceVector; balance: number; credit: number; collateral: number; solvent: boolean; intermediary: number }
interface World { offers: Agent[]; needs: Agent[]; physicalCapacity: number; totalDemand: number }

function buildWorld(p: SimulationParams, seed: number, shock: number): World {
  const rand = mulberry32(seed); const n = Math.max(6, Math.min(120, Math.round(p.networkSize))); const offers: Agent[] = []; const needs: Agent[] = [];
  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rand() * 3)]; const factor = type === 'solar' ? 1 + shock * p.renewableVolatility : 1 + shock * .12;
    const vector: ResourceVector = { scarcity: clamp(p.resourceScarcity * (.7 + rand() * .6)), demand: rand(), urgency: rand(), quality: .45 + rand() * .55, locationCost: clamp(1 - rand() * p.geographicalFriction), energyCost: clamp((type === 'solar' ? .55 + shock * .5 : .7) + rand() * .25, .05), reliability: clamp(p.participantReliability * (.75 + rand() * .4), .05), compatibility: .55 + rand() * .45 };
    offers.push({ id: i, type, amount: Math.max(0, (.45 + rand() * .75) * (1 - p.resourceScarcity * .55) * (1 - p.supplyDemandImbalance * .35) * factor), vector, balance: .2 + rand(), credit: .2 + rand(), collateral: .15 + rand(), solvent: rand() > p.counterpartyRisk * .35, intermediary: Math.floor(rand() * Math.max(2, n / 8)) });
  }
  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rand() * 3)]; const hot = type === 'gpu'; const flexible = hot && rand() < p.flexibleComputeShare;
    const vector: ResourceVector = { scarcity: p.resourceScarcity, demand: .3 + rand() * .7, urgency: clamp(rand() * p.urgency * 2), quality: .3 + rand() * .7, locationCost: flexible ? .8 + rand() * .2 : clamp(1 - rand() * p.geographicalFriction), energyCost: .5 + rand() * .5, reliability: .5 + rand() * .5, compatibility: .55 + rand() * .45 };
    needs.push({ id: i, type, amount: (.45 + rand() * .75) * (hot ? 1 + p.computeDemand : 1) * (1 + p.supplyDemandImbalance * .4), vector, balance: .12 + rand() * .9, credit: .15 + rand(), collateral: .1 + rand(), solvent: rand() > p.counterpartyRisk * .45, intermediary: Math.floor(rand() * Math.max(2, n / 8)) });
  }
  return { offers, needs, physicalCapacity: offers.reduce((s, x) => s + x.amount, 0), totalDemand: needs.reduce((s, x) => s + x.amount, 0) };
}

interface Outcome { welfare: number; attainable: number; delivered: number; demand: number; capacity: number; spill: number; hhi: number; latency: number; relay: number; gini: number; overhead: number; flows: number[]; financialRejected: number; settlementAttempts: number; settlementFailures: number; backstop: number; liquidityShortfall: number; creditFlows: number[]; decomposition: UnmetDemandDecomposition; telemetrySensitivity: number }
interface Edge { oi: number; ni: number; sub: number; value: number; rank: number; relay: boolean; accessible: boolean }

function allocate(world: World, p: SimulationParams, mode: Architecture | 'oracle', seed: number, failed = -1): Outcome {
  const rand = mulberry32(seed); const supply = world.offers.map((o, i) => i === failed ? 0 : o.amount); const remain = world.needs.map(n => n.amount); const served = world.needs.map(() => 0); const flows = world.offers.map(() => 0); const creditFlows = world.needs.map(() => 0);
  const monetary = mode === 'market' || mode === 'stabilizedMarket' || mode === 'hybrid'; const telemetry = mode === 'hybrid' || mode === 'genesis'; const edges: Edge[] = [];
  for (let oi = 0; oi < world.offers.length; oi++) for (let ni = 0; ni < world.needs.length; ni++) {
    const o = world.offers[oi], n = world.needs[ni], sub = SUB[o.type][n.type] ?? 0; if (!sub) continue;
    const accessible = o.vector.locationCost * n.vector.locationCost >= p.geographicalFriction * .28;
    if (!accessible) continue;
    const relay = sub < 1; const conversion = relay ? .82 : 1; const value = Math.max(0, (o.vector.quality * n.vector.demand + .25 * n.vector.urgency + (o.type === 'solar' ? .12 * o.vector.energyCost : 0)) * (.72 + .28 * o.vector.locationCost * n.vector.locationCost) * conversion * o.vector.reliability * sub);
    let rank = value;
    if (mode !== 'oracle') {
      const price = calculateMonetaryScore(o.vector, n.vector, p) * sub * (1 + p.priceSignalNoise * (rand() - .5) * 2);
      const signal = calculateResonanceScore(o.vector, n.vector, p) * sub * (1 + (1 - p.telemetryReliability) * (rand() - .5) * 2.4);
      rank = mode === 'market' || mode === 'stabilizedMarket' ? price : mode === 'hybrid' ? signal * .72 + price * .28 : signal;
    }
    edges.push({ oi, ni, sub, value, rank, relay, accessible });
  }
  edges.sort((a, b) => b.rank - a.rank || a.oi - b.oi || a.ni - b.ni);
  let welfare = 0, delivered = 0, relayed = 0, financialRejected = 0, settlementAttempts = 0, settlementFailures = 0, backstop = 0, liquidityShortfall = 0;
  for (const e of edges) {
    const raw = Math.min(supply[e.oi], remain[e.ni] / e.sub); if (raw <= 1e-9) continue; const effective = raw * e.sub;
    if (monetary) {
      settlementAttempts++; const buyer = world.needs[e.ni], seller = world.offers[e.oi];
      const price = (.35 + seller.vector.scarcity * .45 + p.fundingCost) * raw; const liquid = buyer.balance * (1 - p.liquidityStress); const collateralCredit = buyer.credit * p.creditAvailability * buyer.collateral * (1 - p.collateralHaircut);
      const gap = Math.max(0, price - liquid - collateralCredit); const solvent = buyer.solvent && seller.solvent; const settlementOk = rand() < p.settlementReliability * (1 - p.counterpartyRisk * (buyer.intermediary === seller.intermediary ? 1 : .35));
      let rescued = 0;
      if (gap > 0 && mode !== 'market' && p.centralBankBackstop && solvent) rescued = Math.min(gap, Math.max(0, p.backstopCapacity * world.totalDemand - backstop));
      if (!solvent || !settlementOk || gap - rescued > 1e-9) {
        financialRejected += effective; liquidityShortfall += Math.max(0, gap - rescued); if (!settlementOk || !solvent) settlementFailures++; continue;
      }
      backstop += rescued; buyer.balance = Math.max(0, buyer.balance - Math.min(price, liquid)); creditFlows[e.ni] += Math.max(0, price - liquid);
    }
    supply[e.oi] -= raw; remain[e.ni] -= effective; flows[e.oi] += raw; served[e.ni] += effective; delivered += effective; welfare += effective * e.value; if (e.relay) relayed += effective;
  }
  const demand = world.totalDemand, capacity = failed < 0 ? world.physicalCapacity : world.physicalCapacity - world.offers[failed].amount;
  const unmetVolume = Math.max(0, demand - delivered); const physicalShortageV = Math.min(unmetVolume, Math.max(0, demand - capacity));
  const compatibilityCapacity = world.offers.reduce((sum, o, oi) => sum + (oi === failed ? 0 : o.amount * Math.max(...world.needs.map(n => SUB[o.type][n.type] ?? 0))), 0);
  const compatibilityV = Math.min(unmetVolume - physicalShortageV, Math.max(0, Math.min(demand, capacity) - compatibilityCapacity));
  const inaccessibleShare = p.geographicalFriction * .12; const networkV = Math.min(Math.max(0, unmetVolume - physicalShortageV - compatibilityV), Math.min(demand, capacity) * inaccessibleShare);
  const financialV = monetary ? Math.min(financialRejected, Math.max(0, unmetVolume - physicalShortageV - compatibilityV - networkV)) : 0;
  const residual = Math.max(0, unmetVolume - physicalShortageV - compatibilityV - networkV - financialV);
  const decomposition = { physicalShortage: (physicalShortageV + residual) / demand * 100, financialExclusion: financialV / demand * 100, networkConstraint: networkV / demand * 100, compatibilityConstraint: compatibilityV / demand * 100 };
  const totalFlow = flows.reduce((s, x) => s + x, 0) || 1; const hhi = flows.reduce((s, x) => s + (x / totalFlow) ** 2, 0); const shortfalls = world.needs.map((n, i) => n.amount - served[i]).sort((a,b)=>a-b); const sumShort = shortfalls.reduce((s,x)=>s+x,0); let weighted = 0; shortfalls.forEach((x,i)=>weighted+=(i+1)*x); const gini = sumShort ? 2*weighted/(shortfalls.length*sumShort)-(shortfalls.length+1)/shortfalls.length : 0;
  const overhead = mode === 'market' || mode === 'stabilizedMarket' ? p.marketOverhead + backstop / Math.max(demand, 1) * .04 : mode === 'hybrid' ? p.hybridOverhead + p.telemetryVerificationCost * (1-p.telemetryReliability) : mode === 'genesis' ? p.genesisOverhead + p.telemetryVerificationCost * (1-p.telemetryReliability) : 0;
  return { welfare, attainable: 0, delivered, demand, capacity, spill: supply.reduce((s,x)=>s+x,0), hhi, latency: 12 + p.geographicalFriction*30 + (monetary ? p.settlementLatency*50 : 0) + (telemetry ? 8 : 0), relay: delivered ? relayed/delivered : 0, gini, overhead, flows, financialRejected, settlementAttempts, settlementFailures, backstop, liquidityShortfall, creditFlows, decomposition, telemetrySensitivity: telemetry ? (1-p.telemetryReliability) * (welfare/(delivered||1))*100 : 0 };
}

const ENSEMBLE = 20;
function mean<T>(xs: T[], f: (x:T)=>number) { return xs.reduce((s,x)=>s+f(x),0)/xs.length; }
function metrics(runs: Outcome[], casc: number): SimulationMetrics {
  const net = runs.map(r => r.attainable ? r.welfare/r.attainable*(1-r.overhead)*100 : 0); const mu=net.reduce((s,x)=>s+x,0)/net.length; const flowHHI=(r:Outcome)=>{const s=r.creditFlows.reduce((a,x)=>a+x,0)||1; return r.creditFlows.reduce((a,x)=>a+(x/s)**2,0)};
  const dec = (k:keyof UnmetDemandDecomposition)=>mean(runs,r=>r.decomposition[k]);
  return { fulfilledNeeds: mean(runs,r=>r.delivered/r.demand)*100, resourceUtilization: mean(runs,r=>r.attainable?r.welfare/r.attainable:0)*100, wastedEnergy: mean(runs,r=>r.capacity?r.spill/r.capacity:0)*100, routingLatency: mean(runs,r=>r.latency), unmetDemand: mean(runs,r=>1-r.delivered/r.demand)*100, totalNetworkUtility: mu, concentration: mean(runs,r=>r.hhi), coordinationOverhead: mean(runs,r=>r.overhead), utilityVolatility: Math.sqrt(net.reduce((s,x)=>s+(x-mu)**2,0)/net.length), cascadeLoss: casc, intermediationDepth: mean(runs,r=>r.relay), shortfallGini: mean(runs,r=>r.gini), creditConcentration: mean(runs,flowHHI), settlementFailureRate: mean(runs,r=>r.settlementAttempts?r.settlementFailures/r.settlementAttempts:0), backstopUtilization: mean(runs,r=>r.backstop/Math.max(r.demand,1)), liquidityShortfall: mean(runs,r=>r.liquidityShortfall/r.demand), feasibleButUnservedDemand: dec('financialExclusion'), strandedPhysicalUtility: mean(runs,r=>r.attainable?Math.max(0,(r.attainable-r.welfare)/r.attainable)*100:0), telemetryCorruptionSensitivity: mean(runs,r=>r.telemetrySensitivity), unmetDemandDecomposition: { physicalShortage:dec('physicalShortage'), financialExclusion:dec('financialExclusion'), networkConstraint:dec('networkConstraint'), compatibilityConstraint:dec('compatibilityConstraint') } };
}

export function runSimulation(input: SimulationParams, seed=20260813): SimulationResult {
  const p={...DEFAULT_SIMULATION_PARAMS,...input}; const all:Record<Architecture,Outcome[]>={market:[],stabilizedMarket:[],hybrid:[],genesis:[]}; const deltaDraws:number[]=[]; let capacity=0,demand=0; const casc:Record<Architecture,number>={market:0,stabilizedMarket:0,hybrid:0,genesis:0};
  for(let k=0;k<ENSEMBLE;k++){ const shockRand=mulberry32(seed+k*7919); const shock=(shockRand()*2-1)*(.12+p.renewableVolatility*.35); const world=buildWorld(p,seed+k*7919+17,shock); capacity+=world.physicalCapacity; demand+=world.totalDemand; const oracle=allocate(world,p,'oracle',seed+k*31); for(const mode of Object.keys(all) as Architecture[]){ const out=allocate(world,p,mode,seed+k*101+3); out.attainable=oracle.welfare; all[mode].push(out); const top=out.flows.indexOf(Math.max(...out.flows)); const failed=allocate(world,p,mode,seed+k*101+3,top); const loss=out.welfare?Math.max(0,1-failed.welfare/out.welfare-(out.flows[top]||0)/(out.flows.reduce((s,x)=>s+x,0)||1))*100:0; casc[mode]+=loss/ENSEMBLE; } const g=all.genesis[k],m=all.market[k]; deltaDraws.push(((g.attainable?g.welfare/g.attainable:0)*(1-g.overhead)-(m.attainable?m.welfare/m.attainable:0)*(1-m.overhead))*100); }
  const architectures={ market:metrics(all.market,casc.market), stabilizedMarket:metrics(all.stabilizedMarket,casc.stabilizedMarket), hybrid:metrics(all.hybrid,casc.hybrid), genesis:metrics(all.genesis,casc.genesis) }; const delta=architectures.genesis.totalNetworkUtility-architectures.market.totalNetworkUtility; const dmu=mean(deltaDraws,x=>x); const dsd=Math.sqrt(mean(deltaDraws,x=>(x-dmu)**2)); const ci=1.96*dsd/Math.sqrt(ENSEMBLE); const strongest=(Object.entries(architectures) as [Architecture,SimulationMetrics][]).sort((a,b)=>b[1].totalNetworkUtility-a[1].totalNetworkUtility); const gap=strongest[0][1].totalNetworkUtility-strongest[1][1].totalNetworkUtility;
  const riskChecks:RiskCheck[]=[['concentration','Provider concentration',architectures.market.concentration,architectures.genesis.concentration,.03,'Throughput HHI must remain bounded.'],['cascade','Cascade loss',architectures.market.cascadeLoss,architectures.genesis.cascadeLoss,1,'Largest-provider failure contagion.'],['volatility','Utility volatility',architectures.market.utilityVolatility,architectures.genesis.utilityVolatility,.75,'Shock-ensemble stability.'],['gini','Shortfall Gini',architectures.market.shortfallGini,architectures.genesis.shortfallGini,.04,'Shortfall inequality.'],['relay','Relay dependence',architectures.market.intermediationDepth,architectures.genesis.intermediationDepth,.2,'Conversion-node dependence.'],['overhead','Coordination overhead',architectures.market.coordinationOverhead,architectures.genesis.coordinationOverhead,.25,'Explicit clearing and verification cost.'],['telemetry','Telemetry corruption sensitivity',0,architectures.genesis.telemetryCorruptionSensitivity,20,'Sensitivity to corrupted physical reports.']].map(([id,label,baseline,routed,tolerance,note])=>({id:id as string,label:label as string,baseline:baseline as number,routed:routed as number,tolerance:tolerance as number,lowerIsBetter:true,passed:(routed as number)<=(baseline as number)+(tolerance as number),unit:'',note:note as string}));
  let architectureVerdict:ArchitectureVerdict=gap<ci?'NO SIGNIFICANT DIFFERENCE':strongest[0][0]==='market'?'MARKET SUPERIOR':strongest[0][0]==='stabilizedMarket'?'STABILIZED MARKET SUPERIOR':strongest[0][0]==='hybrid'?'HYBRID SUPERIOR':'GENESIS SUPERIOR IN THIS REGIME'; const failed=riskChecks.filter(x=>!x.passed); if(architectureVerdict==='GENESIS SUPERIOR IN THIS REGIME'&&failed.length) architectureVerdict='INSUFFICIENT EVIDENCE';
  const physicalAvailable=capacity/demand>=p.physicalAvailabilityThreshold, deterioration=architectures.market.feasibleButUnservedDemand>=p.monetaryDeteriorationThreshold*100, critical=architectures.market.unmetDemand>=p.criticalDemandThreshold*100, cbInsufficient=architectures.stabilizedMarket.unmetDemand>p.criticalDemandThreshold*100, hybridSafe=architectures.hybrid.totalNetworkUtility>architectures.stabilizedMarket.totalNetworkUtility&&failed.length===0; let state:SafetyValveState='NORMAL'; if(deterioration)state='FINANCIAL_STRESS'; if(deterioration&&p.centralBankBackstop)state='STABILIZED_MARKET'; if(cbInsufficient&&architectures.hybrid.totalNetworkUtility>architectures.stabilizedMarket.totalNetworkUtility)state='HYBRID'; if(physicalAvailable&&deterioration&&critical&&cbInsufficient&&hybridSafe&&architectures.genesis.totalNetworkUtility>architectures.hybrid.totalNetworkUtility)state='GENESIS_BASELINE'; if(!deterioration&&p.liquidityStress<.15)state='RECOVERY'; const conditions=[{id:'physical',label:'Physical resources remain available',value:capacity/demand,threshold:p.physicalAvailabilityThreshold,passed:physicalAvailable},{id:'monetary',label:'Monetary fulfillment materially deteriorated',value:architectures.market.feasibleButUnservedDemand/100,threshold:p.monetaryDeteriorationThreshold,passed:deterioration},{id:'critical',label:'Critical unmet demand exceeds threshold',value:architectures.market.unmetDemand/100,threshold:p.criticalDemandThreshold,passed:critical},{id:'backstop',label:'Central-bank stabilization is insufficient',value:cbInsufficient,passed:cbInsufficient},{id:'routing',label:'Computational routing improves within risk tolerance',value:hybridSafe,passed:hybridSafe}];
  const reasons={} as Record<Architecture,string[]>; for(const [a,m] of Object.entries(architectures) as [Architecture,SimulationMetrics][]) reasons[a]=[m.feasibleButUnservedDemand>5?`${m.feasibleButUnservedDemand.toFixed(1)}% of demand was physically feasible but could not clear financially.`:'Financial clearing preserved access to most physically feasible trades.',m.telemetryCorruptionSensitivity>8?'Unreliable telemetry reduced optimizer accuracy.':'Information inputs remained sufficiently reliable.',m.coordinationOverhead>.15?'Coordination costs materially reduced realized welfare.':'Coordination costs stayed moderate.'];
  const significant=delta-ci>0, verdict:RiskVerdict=!significant?'no-improvement':failed.length?'improves-with-risk':'improves-safely'; return {architectures,modelA:architectures.market,modelStabilized:architectures.stabilizedMarket,modelHybrid:architectures.hybrid,modelB:architectures.genesis,deltaUtility:delta,deltaVsHybrid:architectures.genesis.totalNetworkUtility-architectures.hybrid.totalNetworkUtility,deltaConfidence:ci,winRate:deltaDraws.filter(x=>x>0).length/ENSEMBLE,primaryDriver:p.liquidityStress>.55?'Financial rejection strands physically feasible demand.':p.telemetryReliability<.5?'Telemetry corruption limits computational coordination.':'Prices and physical telemetry reveal different constraints.',riskChecks,verdict,architectureVerdict,verdictSummary:`${architectureVerdict}. ${strongest[0][0]} achieved ${strongest[0][1].totalNetworkUtility.toFixed(1)}% net attainable welfare; the runner-up achieved ${strongest[1][1].totalNetworkUtility.toFixed(1)}%.`,reasons,safetyValve:{state,conditions,explanation:`The valve is explicitly in ${state}; transitions require the displayed preregistered conditions and never create physical capacity.`},physicalCapacity:capacity/ENSEMBLE,totalDemand:demand/ENSEMBLE,ensembleSize:ENSEMBLE};
}

export interface RegimePoint { x:number; y:number; financialStress:number; telemetryReliability:number; winner:ArchitectureVerdict; utilities:Record<Architecture,number> }
export function buildCoordinationRegimeMap(base:SimulationParams, dimensionX:'resourceScarcity'|'liquidityStress'|'creditAvailability'='liquidityStress', dimensionY:'telemetryReliability'|'geographicalFriction'|'renewableVolatility'='telemetryReliability', steps=5):RegimePoint[]{ const points:RegimePoint[]=[]; for(let yi=0;yi<steps;yi++)for(let xi=0;xi<steps;xi++){const x=xi/(steps-1),y=yi/(steps-1);const p={...base,[dimensionX]:x,[dimensionY]:y};const r=runSimulation(p,4400+yi*101+xi);points.push({x,y,financialStress:p.liquidityStress,telemetryReliability:p.telemetryReliability,winner:r.architectureVerdict,utilities:{market:r.modelA.totalNetworkUtility,stabilizedMarket:r.modelStabilized.totalNetworkUtility,hybrid:r.modelHybrid.totalNetworkUtility,genesis:r.modelB.totalNetworkUtility}})}return points; }

export interface StageEvidence { seeds:number[]; deltaUtility:number; deltaConfidence:number; deltaVsHybrid:number; deltaVsHybridConfidence:number; winRate:number; riskChecks:RiskCheck[]; draws:number }
export interface SuperiorityGate { id:string; label:string; detail:string; passed:boolean }
export interface FrozenClaim { id:string; frozenAt:string; params:SimulationParams; discovery:StageEvidence; discoverySeeds:number[]; holdoutSeeds:number[]; predictedDelta:number; predictedBand:number }
export interface ChallengeOutcome { claim:FrozenClaim; holdout:StageEvidence; gates:SuperiorityGate[]; granted:boolean; shrinkage:number; oracleGapBaseline:number; oracleGapRouted:number; summary:string; sample:SimulationResult }
const DISCOVERY_SEEDS=[101,227,373,521],HOLDOUT_SEEDS=[90211,91733,93187,94687,96079,97501];
function aggregate(results:SimulationResult[],seeds:number[]):StageEvidence{const ds=results.map(r=>r.deltaUtility),mu=mean(ds,x=>x),sd=Math.sqrt(ds.reduce((s,x)=>s+(x-mu)**2,0)/Math.max(1,ds.length-1)),hs=results.map(r=>r.deltaVsHybrid),hm=mean(hs,x=>x),hsd=Math.sqrt(hs.reduce((s,x)=>s+(x-hm)**2,0)/Math.max(1,hs.length-1));return{seeds,deltaUtility:mu,deltaConfidence:1.96*sd/Math.sqrt(ds.length),deltaVsHybrid:hm,deltaVsHybridConfidence:1.96*hsd/Math.sqrt(hs.length),winRate:mean(results,r=>r.winRate),riskChecks:results[0].riskChecks.map(c=>{const rows=results.map(r=>r.riskChecks.find(x=>x.id===c.id)!);const baseline=mean(rows,x=>x.baseline),routed=mean(rows,x=>x.routed);return{...c,baseline,routed,passed:routed<=baseline+c.tolerance}}),draws:results.length*ENSEMBLE}}
export function discoverAndFreeze(base:SimulationParams):FrozenClaim{let best:{p:SimulationParams;e:StageEvidence;l:number}|undefined;for(const stress of [.15,.5,.85])for(const trust of [.35,.65,.92])for(const scarcity of [.25,.55,.85]){const p={...base,liquidityStress:stress,telemetryReliability:trust,resourceScarcity:scarcity};const e=aggregate(DISCOVERY_SEEDS.map(s=>runSimulation(p,s)),DISCOVERY_SEEDS),l=e.deltaUtility-e.deltaConfidence;if(!best||l>best.l)best={p,e,l}}return{id:`RRC-${Math.abs(Math.round(best!.e.deltaUtility*1000)).toString(36).toUpperCase()}`,frozenAt:new Date().toISOString(),params:best!.p,discovery:best!.e,discoverySeeds:DISCOVERY_SEEDS,holdoutSeeds:HOLDOUT_SEEDS,predictedDelta:best!.e.deltaUtility,predictedBand:best!.e.deltaConfidence}}
export function challengeClaim(claim:FrozenClaim):ChallengeOutcome{const results=claim.holdoutSeeds.map(s=>runSimulation(claim.params,s)),h=aggregate(results,claim.holdoutSeeds),sample=results[0],lcb=h.deltaUtility-h.deltaConfidence,hlcb=h.deltaVsHybrid-h.deltaVsHybridConfidence,failed=h.riskChecks.filter(x=>!x.passed),shrinkage=h.deltaUtility-claim.predictedDelta,gates:SuperiorityGate[]=[{id:'significance',label:'Holdout gain exceeds preregistered minimum',detail:`Δ = ${h.deltaUtility.toFixed(2)} pp, 95% CI lower bound ${lcb.toFixed(2)} pp over ${h.draws} unseen draws; ε = 1.00 pp.`,passed:lcb>1},{id:'hybrid',label:'Beats strongest monetary/hybrid comparator',detail:`Genesis minus hybrid = ${h.deltaVsHybrid.toFixed(2)} pp, 95% CI lower bound ${hlcb.toFixed(2)} pp over ${h.seeds.length} holdout seeds.`,passed:hlcb>0&&sample.modelB.totalNetworkUtility>sample.modelStabilized.totalNetworkUtility},{id:'consistency',label:'Survives unseen seeds and shocks',detail:`Genesis beat Market in ${(h.winRate*100).toFixed(0)}% of unseen draws; threshold > 60%.`,passed:h.winRate>.6},{id:'oracle',label:'Closes the oracle welfare gap',detail:`Stranded attainable utility: Market ${sample.modelA.strandedPhysicalUtility.toFixed(1)}% → Genesis ${sample.modelB.strandedPhysicalUtility.toFixed(1)}%.`,passed:sample.modelB.strandedPhysicalUtility<sample.modelA.strandedPhysicalUtility},{id:'risk',label:'Every systemic-risk gate passes',detail:failed.length?`Failing: ${failed.map(x=>x.label).join(', ')}.`:'All concentration, fragility, inequality, dependence and telemetry gates pass.',passed:failed.length===0},{id:'overhead',label:'Not driven solely by overhead assumptions',detail:'Re-evaluated with Genesis overhead set equal to the lowest comparator.',passed:runSimulation({...claim.params,genesisOverhead:Math.min(claim.params.marketOverhead,claim.params.hybridOverhead)},claim.holdoutSeeds[0]).deltaVsHybrid>0}];const granted=gates.every(g=>g.passed);return{claim,holdout:h,gates,granted,shrinkage,oracleGapBaseline:sample.modelA.strandedPhysicalUtility,oracleGapRouted:sample.modelB.strandedPhysicalUtility,summary:granted?`Genesis superiority is supported only in frozen regime ${claim.id}.`:`INSUFFICIENT EVIDENCE: ${gates.filter(g=>!g.passed).map(g=>g.label.toLowerCase()).join('; ')}.`,sample}}
