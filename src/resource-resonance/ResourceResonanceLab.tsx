import React, { useState, useEffect, useCallback } from 'react';
import { Network, Activity, FileSignature, Clock, Users, Building, ShieldAlert, Layers } from 'lucide-react';
import { DEFAULT_SIMULATION_PARAMS, SCENARIO_PRESETS, SimulationParams, SimulationResult, runSimulation, ResourceOffer, ResourceNeed, MatchResult, calculateResonanceScore, GridStochasticEngine, evaluateSubjectivePreference, genesisOperatingPolicy, SubjectivePreference } from './engine';
import { compileResonanceRun, ResonanceCatalystSession } from './resonanceCatalyst';
import { ResourceNetwork, RelayNode } from './ResourceNetwork';
import { RoutingComparison } from './RoutingComparison';
import { SuperiorityProtocol } from './SuperiorityProtocol';
import { AssumptionSensitivity } from './AssumptionSensitivity';

import { CoordinationRegimeMap } from './CoordinationRegimeMap';
import { MatchExplanation } from './MatchExplanation';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export const ResourceResonanceLab: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>({ ...DEFAULT_SIMULATION_PARAMS, networkSize: 18 });
  const genesisPolicy = genesisOperatingPolicy(params);

  const [result, setResult] = useState<SimulationResult | null>(null);
  
  // Peer Network State
  const [offers, setOffers] = useState<ResourceOffer[]>([]);
  const [needs, setNeeds] = useState<ResourceNeed[]>([]);
  const [relays, setRelays] = useState<RelayNode[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState<number>(12); // 12:00 PM default

  useEffect(() => {
    // Generate initial baseline network
    const declared = (overrides: Partial<SubjectivePreference> = {}): SubjectivePreference => ({
      declaredReservationValue: .75,
      priorityWeight: .7,
      qualityWeight: .7,
      localityWeight: .6,
      consent: true,
      communityDecision: 'approved',
      source: 'human-declared',
      ...overrides,
    });
    const initialOffers: ResourceOffer[] = [
      {
        id: 'o1', providerId: 'NODE-A4', type: 'gpu', amount: 8,
        vector: { scarcity: 0.7, demand: 0.9, urgency: 0.4, quality: 0.9, locationCost: 0.8, energyCost: 0.9, reliability: 0.95, compatibility: 0.9 },
        subjectivePreference: declared({ source: 'community-declared' }),
      },
      {
        id: 'o2', providerId: 'NODE-X9', type: 'solar', amount: 22,
        vector: { scarcity: 0.2, demand: 0.5, urgency: 0.2, quality: 0.8, locationCost: 0.9, energyCost: 1.0, reliability: 0.7, compatibility: 0.8 },
        subjectivePreference: declared({ declaredReservationValue: .6, localityWeight: .8 }),
      },
      {
        id: 'o3', providerId: 'NODE-K2', type: 'code', amount: 3,
        vector: { scarcity: 0.4, demand: 0.6, urgency: 0.5, quality: 0.8, locationCost: 1.0, energyCost: 0.5, reliability: 0.8, compatibility: 0.95 },
        subjectivePreference: declared({ declaredReservationValue: .5, priorityWeight: .55 }),
      },
    ];
    
    const initialNeeds: ResourceNeed[] = [
      {
        id: 'n1', requesterId: 'JOB-77Z', type: 'gpu', amount: 4,
        vector: { scarcity: 0.7, demand: 0.9, urgency: 0.9, quality: 0.8, locationCost: 0.7, energyCost: 0.8, reliability: 0.8, compatibility: 0.9 },
        subjectivePreference: declared({ declaredReservationValue: .95, priorityWeight: .95, qualityWeight: .9 }),
      },
      {
        id: 'n2', requesterId: 'JOB-99X', type: 'labor', amount: 10,
        vector: { scarcity: 0.5, demand: 0.7, urgency: 0.6, quality: 0.7, locationCost: 1.0, energyCost: 0.5, reliability: 0.9, compatibility: 0.8 },
        subjectivePreference: declared({ declaredReservationValue: .7, priorityWeight: .65, localityWeight: .9 }),
      },
      {
        id: 'n3', requesterId: 'JOB-22B', type: 'storage', amount: 50,
        vector: { scarcity: 0.3, demand: 0.4, urgency: 0.2, quality: 0.6, locationCost: 0.6, energyCost: 0.9, reliability: 0.7, compatibility: 0.85 },
        subjectivePreference: declared({ source: 'community-declared', declaredReservationValue: .8, priorityWeight: .8, localityWeight: .75 }),
      }
    ];

    const initialRelays: RelayNode[] = [
      { id: 'r1', type: 'battery', name: 'MegaPack-C1', capacity: 100 },
      { id: 'r2', type: 'broker', name: 'Compute-Exchange', capacity: 50 },
      { id: 'r3', type: 'hub', name: 'Data-Transit-09', capacity: 1000 }
    ];

    setOffers(initialOffers);
    setNeeds(initialNeeds);
    setRelays(initialRelays);
    
    setResult(runSimulation(params));
  }, [params]);

  const handleRoute = useCallback(() => {
    setIsRouting(true);
    setMatches([]);
    
    setTimeout(() => {
      const newMatches: MatchResult[] = [];
      const currentGridEnergy = GridStochasticEngine.getEnergyAvailability(simulatedTime);

      offers.forEach(offer => {
        const adjustedOffer = { ...offer, vector: { ...offer.vector } };
        if (offer.type === 'solar') {
          adjustedOffer.vector.energyCost = currentGridEnergy; 
        }

        needs.forEach(need => {
          let score = calculateResonanceScore(adjustedOffer.vector, need.vector, params);
          const preference = evaluateSubjectivePreference(adjustedOffer, need);
          if (!preference.allowed) return;
          score *= preference.score;
          let routeType: 'direct' | 'multi-hop' = 'direct';
          let relayNodeId: string | undefined = undefined;

          if (score < 0.5) {
             if (offer.type === 'solar' && need.type === 'gpu') {
                score += 0.4;
                routeType = 'multi-hop';
                relayNodeId = 'r1';
             } else if (offer.type === 'code' && need.type === 'labor') {
                score += 0.3; 
                routeType = 'multi-hop';
                relayNodeId = 'r2';
             }
          }

          if (score > 0.45) {
            newMatches.push({
              offerId: offer.id,
              needId: need.id,
              amount: Math.min(offer.amount, need.amount),
              score,
              routeType,
              relayNodeId,
              explanation: {
                compositeMatch: score,
                compatibility: offer.vector.compatibility * need.vector.compatibility,
                energyAvailability: adjustedOffer.vector.energyCost,
                urgencyAlignment: 1 - Math.abs(offer.vector.urgency - need.vector.urgency),
                networkCost: offer.vector.locationCost * need.vector.locationCost,
                reliability: offer.vector.reliability
              }
            });
          }
        });
      });
      
      newMatches.sort((a, b) => b.score - a.score);
      setMatches(newMatches.slice(0, 3));
      setIsRouting(false);
    }, 1500);
  }, [offers, needs, params, simulatedTime]);

  const handleDiscover = (newParams: SimulationParams) => {
    setParams(newParams);
    setResult(runSimulation(newParams));
    toast.success("Region frozen — challenging on holdout seeds");
  };

  const handleGenerateCatalyst = async () => {
    if (!result) return;
    try {
      const session: ResonanceCatalystSession = {
        mode: `Genesis_Coordination_Assist_${simulatedTime}00`,
        seed: 20260813,
        params,
        result
      };
      const artifact = await compileResonanceRun(session);
      const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${artifact.run_id}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Catalyst artifact ${artifact.run_id} exported.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate Catalyst artifact.");
    }
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-black text-foreground selection:bg-cyan-500/30">
      <Toaster theme="dark" />
      <header className="mx-auto max-w-7xl px-6 pt-8">
        <p className="font-mono text-xs text-amber-300">BOUNDED LOGISTICS SIMULATION · HUMAN-APPROVED COORDINATION ASSIST</p>
        <h1 className="mt-2 text-2xl text-white">Genesis Coordination Lab</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">Genesis proposes routes for declared physical needs. It does not replace money, banks, markets, or civic judgment; people and communities set priorities, and the existing settlement rail remains the crisis anchor.</p>
        <div className="mt-4 grid gap-2 rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-4 text-[11px] leading-relaxed text-slate-300 sm:grid-cols-3">
          <p><span className="font-mono uppercase tracking-widest text-cyan-300">Role</span><br />Operational fit and routing advice only.</p>
          <p><span className="font-mono uppercase tracking-widest text-cyan-300">Human boundary</span><br />Declared consent and community decisions can veto or hold a route.</p>
          <p><span className="font-mono uppercase tracking-widest text-cyan-300">Failure policy</span><br />{genesisPolicy.fallbackApplied ? 'Routing grid unavailable: cash/market fallback is active.' : 'Cash-first settlement is active; outage fallback is armed.'}</p>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        
        {/* TIME CONTROLLER */}
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl border border-cyan-900/30 bg-cyan-950/10 backdrop-blur-md flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between shadow-[0_0_30px_rgba(6,182,212,0.05)]">
           <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 shrink-0 bg-cyan-900/40 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                 <Clock className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                 <h3 className="text-white text-sm sm:text-base font-bold font-mono tracking-wider">Simulated energy availability</h3>
                 <p className="text-xs sm:text-sm text-cyan-400/80 font-mono mt-1">
                   {simulatedTime.toString().padStart(2, '0')}:00 {simulatedTime < 12 ? 'AM' : 'PM'} 
                   <span className="block sm:inline text-slate-500 sm:ml-2 text-[10px] sm:text-xs">(stochastic grid input: {(GridStochasticEngine.getEnergyAvailability(simulatedTime) * 100).toFixed(0)}%)</span>
                 </p>
              </div>
           </div>
           <div className="w-full lg:flex-1 lg:max-w-xl lg:mx-8">
              <input 
                type="range" 
                min="0" 
                max="23" 
                value={simulatedTime} 
                onChange={(e) => setSimulatedTime(parseInt(e.target.value))}
                className="w-full h-3 sm:h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-500">
                <span>00:00 (Midnight)</span>
                <span className="text-amber-500/70">12:00 (Peak Solar)</span>
                <span>23:00 (Night)</span>
              </div>
           </div>
        </div>

        <div className="grid min-w-0 gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6 sm:space-y-8">
            <section>
              <ResourceNetwork 
                offers={offers}
                needs={needs}
                relays={relays}
                matches={matches}
                onRoute={handleRoute}
                isRouting={isRouting}
              />
            </section>

            <section className="rounded-xl border border-violet-900/40 bg-violet-950/10 p-4 sm:p-5">
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-violet-300">Human / community priorities</h2>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                The route preview may rank only within a declared boundary. A person or community can approve, hold,
                or reject each request; the algorithm cannot turn a disagreement into a price.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {needs.map((need) => (
                  <label key={need.id} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">{need.id} · {need.type}</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1.5 font-mono text-[10px] text-slate-300"
                      value={need.subjectivePreference?.communityDecision ?? 'pending'}
                      onChange={(event) => {
                        const decision = event.target.value as SubjectivePreference['communityDecision'];
                        setNeeds((current) => current.map((item) => item.id === need.id
                          ? { ...item, subjectivePreference: item.subjectivePreference
                            ? { ...item.subjectivePreference, communityDecision: decision }
                            : undefined }
                          : item));
                      }}
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Hold for discussion</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>
            
            {result && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-sm uppercase tracking-widest text-slate-300">
                    Routing Baseline Comparison
                  </h2>
                </div>
                <RoutingComparison result={result} params={params} />
              </section>
            )}
            <CoordinationRegimeMap params={params} />
          </div>

          <div className="min-w-0 space-y-6">
            {/* Hierarchical Controls: Multi-Layer Toggles */}
            <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4 sm:p-6 space-y-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Multi-Layer Engine Architecture
              </h3>
              <div className="grid grid-cols-1 gap-3 pt-1 min-[380px]:grid-cols-2">
                <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <input
                    type="checkbox"
                    checked={params.behavioralEnabled ?? false}
                    onChange={(e) => {
                      const next = { ...params, behavioralEnabled: e.target.checked };
                      setParams(next);
                      setResult(runSimulation(next));
                    }}
                    className="accent-rose-400"
                  />
                  <span>Behavioral Layer</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <input
                    type="checkbox"
                    checked={params.institutionalEnabled ?? false}
                    onChange={(e) => {
                      const next = { ...params, institutionalEnabled: e.target.checked };
                      setParams(next);
                      setResult(runSimulation(next));
                    }}
                    className="accent-indigo-400"
                  />
                  <span>Institutional Layer</span>
                </label>
              </div>
            </div>

            {/* Behavioral Environment Controls */}
            {params.behavioralEnabled && (
              <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-4 sm:p-6 space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-rose-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" />
                  Behavioral Environment
                </h3>
                {([
                  ['riskAversion', 'Risk aversion'],
                  ['lossAversion', 'Loss aversion'],
                  ['herdingIntensity', 'Herding intensity'],
                  ['liquidityPreference', 'Liquidity preference'],
                  ['hoardingSensitivity', 'Precautionary hoarding'],
                  ['trustSensitivity', 'Trust sensitivity'],
                  ['informationAsymmetry', 'Information asymmetry'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="flex justify-between font-mono text-[9px] text-slate-400">
                      <span>{label}</span>
                      <span>{(params[key] * 100).toFixed(0)}%</span>
                    </span>
                    <input
                      className="mt-1 h-1.5 w-full accent-rose-400"
                      type="range" min="0" max="1" step=".01"
                      value={params[key]}
                      onChange={e => {
                        const next = { ...params, [key]: Number(e.target.value) };
                        setParams(next);
                        setResult(runSimulation(next));
                      }}
                    />
                  </label>
                ))}
              </div>
            )}

            {/* Institutional Environment Controls */}
            {params.institutionalEnabled && (
              <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/10 p-4 sm:p-6 space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-300 flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-400" />
                  Institutional Environment
                </h3>
                {([
                  ['regulatoryFriction', 'Regulatory friction'],
                  ['capitalConstraints', 'Capital constraints'],
                  ['governanceLatency', 'Governance latency'],
                  ['policyResponsiveness', 'Policy responsiveness'],
                  ['confidenceShock', 'Confidence shock'],
                  ['regulatoryShock', 'Regulatory shock'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="flex justify-between font-mono text-[9px] text-slate-400">
                      <span>{label}</span>
                      <span>{(params[key] * 100).toFixed(0)}%</span>
                    </span>
                    <input
                      className="mt-1 h-1.5 w-full accent-indigo-400"
                      type="range" min="0" max="1" step=".01"
                      value={params[key]}
                      onChange={e => {
                        const next = { ...params, [key]: Number(e.target.value) };
                        setParams(next);
                        setResult(runSimulation(next));
                      }}
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 sm:p-6">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Economic stress experiment</h3>
              <p className="mt-2 text-[11px] text-slate-500">Preset experiment regimes configure coupled physical, monetary, behavioral, and institutional parameters.</p>
              <select className="mt-4 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-slate-300" defaultValue="normal" onChange={(e) => {
                const preset=SCENARIO_PRESETS.find(s=>s.id===e.target.value); if(!preset)return;
                const next={...params,...preset.patch}; setParams(next); setResult(runSimulation(next));
              }}>{SCENARIO_PRESETS.map(s=><option key={s.id} value={s.id}>{s.name}{s.financialOnly?' · financial only':''}</option>)}</select>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="flex justify-between font-mono text-[9px] text-slate-400"><span>Genesis settlement policy</span><span className="text-cyan-300">{params.genesisSettlementMode === 'advisory' ? 'advisory' : 'cash-first'}</span></span>
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-slate-300"
                    value={params.genesisSettlementMode ?? 'cash-first'}
                    onChange={e=>{const next={...params,genesisSettlementMode:e.target.value as SimulationParams['genesisSettlementMode']};setParams(next);setResult(runSimulation(next));}}
                  >
                    <option value="cash-first">Cash-first assist (settlement required)</option>
                    <option value="advisory">Advisory only (human approves execution)</option>
                  </select>
                </label>
                {([['creditAvailability','Credit availability'],['liquidityStress','Liquidity stress'],['counterpartyRisk','Counterparty risk'],['collateralHaircut','Collateral haircut'],['settlementReliability','Settlement reliability'],['cashSettlementReliability','Cash fallback reliability'],['priceSignalNoise','Price-signal noise'],['telemetryReliability','Telemetry reliability'],['infrastructureOutage','Routing-grid outage'],['backstopCapacity','Backstop capacity']] as const).map(([key,label])=><label key={key} className="block"><span className="flex justify-between font-mono text-[9px] text-slate-400"><span>{label}</span><span>{((params[key] ?? 0)*100).toFixed(0)}%</span></span><input className="mt-1 h-1.5 w-full accent-amber-400" type="range" min="0" max="1" step=".01" value={params[key] ?? 0} onChange={e=>{const next={...params,[key]:Number(e.target.value)};setParams(next);setResult(runSimulation(next));}}/></label>)}
                <label className="flex items-center justify-between text-[11px] text-slate-400"><span>Central-bank lender of last resort</span><input type="checkbox" checked={params.centralBankBackstop} onChange={e=>{const next={...params,centralBankBackstop:e.target.checked};setParams(next);setResult(runSimulation(next));}}/></label>
              </div>
            </div>
            {/* Market dynamics stress controls */}
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4 sm:p-6">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Market dynamics stress
              </h3>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Harden the price-only baseline: more clearing rounds sharpen price discovery, and more aggressive
                re-bidding escalates willingness-to-pay against congested nodes. Compare Genesis assistance against this baseline; a win is not a banking-replacement claim.
              </p>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="flex justify-between font-mono text-[10px] text-slate-400">
                    <span>Clearing rounds</span><span>{params.marketClearingRounds ?? 4}</span>
                  </span>
                  <input
                    type="range" min="1" max="12" step="1" value={params.marketClearingRounds ?? 4}
                    onChange={(event) => {
                      const next = { ...params, marketClearingRounds: Number(event.target.value) };
                      setParams(next);
                      setResult(runSimulation(next));
                    }}
                    className="mt-2 h-1.5 w-full cursor-pointer accent-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="flex justify-between font-mono text-[10px] text-slate-400">
                    <span>Buyer re-bid aggressiveness</span><span>{((params.bidAggressiveness ?? .5) * 100).toFixed(0)}%</span>
                  </span>
                  <input
                    type="range" min="0" max="1" step="0.01" value={params.bidAggressiveness ?? .5}
                    onChange={(event) => {
                      const next = { ...params, bidAggressiveness: Number(event.target.value) };
                      setParams(next);
                      setResult(runSimulation(next));
                    }}
                    className="mt-2 h-1.5 w-full cursor-pointer accent-emerald-400"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-200">Cost assumptions</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Welfare deductions are assumptions, not facts. Change them before discovery to run a sensitivity check.
              </p>
              <div className="mt-4 space-y-4">
                {([
                  ['marketOverhead', 'Market clearing'],
                  ['hybridOverhead', 'Hybrid optimizer'],
                  ['genesisOverhead', 'Genesis routing'],
                  ['telemetryVerificationCost', 'Telemetry verification'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>{label}</span><span>{(params[key] * 100).toFixed(0)}%</span>
                    </span>
                    <input
                      type="range" min="0" max="0.4" step="0.01" value={params[key]}
                      onChange={(event) => {
                        const next = { ...params, [key]: Number(event.target.value) };
                        setParams(next);
                        setResult(runSimulation(next));
                      }}
                      className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </div>
            <SuperiorityProtocol onAdopt={handleDiscover} baseParams={params} />

            <AssumptionSensitivity
              params={params}
              onChange={(patch) => {
                const next = { ...params, ...patch };
                setParams(next);
                setResult(runSimulation(next));
              }}
            />

            
            {matches.length > 0 && (
              <MatchExplanation match={matches[0]} />
            )}
            
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
              <h3 className="font-mono text-xs font-bold tracking-widest text-slate-200 uppercase mb-4 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-cyan-400" />
                Epistemic Record
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Export a reproducible hash-chained Catalyst artifact of this simulation state, including routing topology, energy availability, human-boundary policy, and fallback status.
              </p>
              <Button 
                onClick={handleGenerateCatalyst}
                variant="outline"
                className="w-full border-cyan-900/50 hover:bg-cyan-950/30 text-cyan-400 font-mono text-[10px] uppercase tracking-wider"
              >
                Compile Catalyst Artifact
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
