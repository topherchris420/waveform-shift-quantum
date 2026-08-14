import React, { useState, useEffect, useCallback } from 'react';
import { Network, Activity, FileSignature, Clock } from 'lucide-react';
import { DEFAULT_SIMULATION_PARAMS, SCENARIO_PRESETS, SimulationParams, SimulationResult, runSimulation, ResourceOffer, ResourceNeed, MatchResult, calculateResonanceScore, GridStochasticEngine } from './engine';
import { compileResonanceRun, ResonanceCatalystSession } from './resonanceCatalyst';
import { ResourceNetwork, RelayNode } from './ResourceNetwork';
import { RoutingComparison } from './RoutingComparison';
import { SuperiorityProtocol } from './SuperiorityProtocol';
import { CoordinationRegimeMap } from './CoordinationRegimeMap';
import { MatchExplanation } from './MatchExplanation';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export const ResourceResonanceLab: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>({ ...DEFAULT_SIMULATION_PARAMS, networkSize: 18 });

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
    const initialOffers: ResourceOffer[] = [
      {
        id: 'o1', providerId: 'NODE-A4', type: 'gpu', amount: 8,
        vector: { scarcity: 0.7, demand: 0.9, urgency: 0.4, quality: 0.9, locationCost: 0.8, energyCost: 0.9, reliability: 0.95, compatibility: 0.9 }
      },
      {
        id: 'o2', providerId: 'NODE-X9', type: 'solar', amount: 22,
        vector: { scarcity: 0.2, demand: 0.5, urgency: 0.2, quality: 0.8, locationCost: 0.9, energyCost: 1.0, reliability: 0.7, compatibility: 0.8 }
      },
      {
        id: 'o3', providerId: 'NODE-K2', type: 'code', amount: 3,
        vector: { scarcity: 0.4, demand: 0.6, urgency: 0.5, quality: 0.8, locationCost: 1.0, energyCost: 0.5, reliability: 0.8, compatibility: 0.95 }
      },
    ];
    
    const initialNeeds: ResourceNeed[] = [
      {
        id: 'n1', requesterId: 'JOB-77Z', type: 'gpu', amount: 4,
        vector: { scarcity: 0.7, demand: 0.9, urgency: 0.9, quality: 0.8, locationCost: 0.7, energyCost: 0.8, reliability: 0.8, compatibility: 0.9 }
      },
      {
        id: 'n2', requesterId: 'JOB-99X', type: 'labor', amount: 10,
        vector: { scarcity: 0.5, demand: 0.7, urgency: 0.6, quality: 0.7, locationCost: 1.0, energyCost: 0.5, reliability: 0.9, compatibility: 0.8 }
      },
      {
        id: 'n3', requesterId: 'JOB-22B', type: 'storage', amount: 50,
        vector: { scarcity: 0.3, demand: 0.4, urgency: 0.2, quality: 0.6, locationCost: 0.6, energyCost: 0.9, reliability: 0.7, compatibility: 0.85 }
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
  }, []);

  const handleRoute = useCallback(() => {
    setIsRouting(true);
    setMatches([]);
    
    setTimeout(() => {
      const newMatches: MatchResult[] = [];
      const currentGridEnergy = GridStochasticEngine.getEnergyAvailability(simulatedTime);

      offers.forEach(offer => {
        // Adjust offer energy cost vector dynamically based on Grid CAISO model
        const adjustedOffer = { ...offer };
        if (offer.type === 'solar') {
          adjustedOffer.vector.energyCost = currentGridEnergy; 
          // At noon, energyCost is high (abundant). At night, it's low (scarce).
        }

        needs.forEach(need => {
          let score = calculateResonanceScore(adjustedOffer.vector, need.vector, params);
          let routeType: 'direct' | 'multi-hop' = 'direct';
          let relayNodeId: string | undefined = undefined;

          // If it's a weak match, see if a multi-hop relay fixes it.
          // e.g. Solar -> GPU is weak at 19:00 because solar is gone. But if solar is generated at 12:00, it can route through a battery relay.
          if (score < 0.5) {
             if (offer.type === 'solar' && need.type === 'gpu') {
                // If it's noon, we can store it in battery for the evening compute.
                // If it's evening, maybe we draw from battery.
                score += 0.4; // Multi-hop boost
                routeType = 'multi-hop';
                relayNodeId = 'r1'; // Battery relay
             } else if (offer.type === 'code' && need.type === 'labor') {
                score += 0.3; 
                routeType = 'multi-hop';
                relayNodeId = 'r2'; // Compute broker
             }
          }

          if (score > 0.45) { // Threshold
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
      
      // Sort matches by score desc
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
        mode: `Genesis_Protocol_Grid_${simulatedTime}00`,
        seed: Math.floor(Math.random() * 1000000),
        params,
        result
      };
      const artifact = await compileResonanceRun(session);
      toast.success(`Catalyst artifact ${artifact.run_id} compiled successfully.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate Catalyst artifact.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-foreground selection:bg-cyan-500/30">
      <Toaster theme="dark" />
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        
        {/* TIME CONTROLLER */}
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl border border-cyan-900/30 bg-cyan-950/10 backdrop-blur-md flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between shadow-[0_0_30px_rgba(6,182,212,0.05)]">
           <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 shrink-0 bg-cyan-900/40 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                 <Clock className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                 <h3 className="text-white text-sm sm:text-base font-bold font-mono tracking-wider">Simulated CAISO Grid Time</h3>
                 <p className="text-xs sm:text-sm text-cyan-400/80 font-mono mt-1">
                   {simulatedTime.toString().padStart(2, '0')}:00 {simulatedTime < 12 ? 'AM' : 'PM'} 
                   <span className="block sm:inline text-slate-500 sm:ml-2 text-[10px] sm:text-xs">(Energy Availability: {(GridStochasticEngine.getEnergyAvailability(simulatedTime) * 100).toFixed(0)}%)</span>
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

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6 sm:space-y-8">
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
            
            {result && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-sm uppercase tracking-widest text-slate-300">
                    Routing Baseline Comparison
                  </h2>
                </div>
                <RoutingComparison result={result} />
              </section>
            )}
            <CoordinationRegimeMap params={params} />
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 sm:p-6">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">Economic stress experiment</h3>
              <p className="mt-2 text-[11px] text-slate-500">Purely financial presets leave physical scarcity, capacity, volatility, geography, and demand unchanged.</p>
              <select className="mt-4 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-slate-300" defaultValue="normal" onChange={(e) => {
                const preset=SCENARIO_PRESETS.find(s=>s.id===e.target.value); if(!preset)return;
                const next={...params,...preset.patch}; setParams(next); setResult(runSimulation(next));
              }}>{SCENARIO_PRESETS.map(s=><option key={s.id} value={s.id}>{s.name}{s.financialOnly?' · financial only':''}</option>)}</select>
              <div className="mt-4 space-y-3">
                {([['creditAvailability','Credit availability'],['liquidityStress','Liquidity stress'],['counterpartyRisk','Counterparty risk'],['collateralHaircut','Collateral haircut'],['settlementReliability','Settlement reliability'],['priceSignalNoise','Price-signal noise'],['telemetryReliability','Telemetry reliability'],['backstopCapacity','Backstop capacity']] as const).map(([key,label])=><label key={key} className="block"><span className="flex justify-between font-mono text-[9px] text-slate-400"><span>{label}</span><span>{(params[key]*100).toFixed(0)}%</span></span><input className="mt-1 h-1.5 w-full accent-amber-400" type="range" min="0" max="1" step=".01" value={params[key]} onChange={e=>{const next={...params,[key]:Number(e.target.value)};setParams(next);setResult(runSimulation(next));}}/></label>)}
                <label className="flex items-center justify-between text-[11px] text-slate-400"><span>Central-bank lender of last resort</span><input type="checkbox" checked={params.centralBankBackstop} onChange={e=>{const next={...params,centralBankBackstop:e.target.checked};setParams(next);setResult(runSimulation(next));}}/></label>
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
            
            {matches.length > 0 && (
              <MatchExplanation match={matches[0]} />
            )}
            
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
              <h3 className="font-mono text-xs font-bold tracking-widest text-slate-200 uppercase mb-4 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-cyan-400" />
                Epistemic Record
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Export a reproducible hash-chained Catalyst artifact of this simulation state, including multi-hop topology and CAISO grid hour.
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
