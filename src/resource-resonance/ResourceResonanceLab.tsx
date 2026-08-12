import React, { useState, useEffect, useCallback } from 'react';
import { Network, Activity, Beaker, FileSignature } from 'lucide-react';
import { SimulationParams, SimulationResult, runSimulation, ResourceOffer, ResourceNeed, MatchResult, calculateResonanceScore } from './engine';
import { compileResonanceRun, ResonanceCatalystSession } from './resonanceCatalyst';
import { ResourceNetwork } from './ResourceNetwork';
import { RoutingComparison } from './RoutingComparison';
import { ResonanceDiscovery } from './ResonanceDiscovery';
import { MatchExplanation } from './MatchExplanation';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export const ResourceResonanceLab: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>({
    resourceScarcity: 0.5,
    networkSize: 10,
    renewableVolatility: 0.6,
    computeDemand: 0.8,
    urgency: 0.5,
    geographicalFriction: 0.3,
    participantReliability: 0.8,
    supplyDemandImbalance: 0.1
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  
  // Peer Network State
  const [offers, setOffers] = useState<ResourceOffer[]>([]);
  const [needs, setNeeds] = useState<ResourceNeed[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isRouting, setIsRouting] = useState(false);

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

    setOffers(initialOffers);
    setNeeds(initialNeeds);
    
    // Initial run
    setResult(runSimulation(params));
  }, []);

  const handleRoute = useCallback(() => {
    setIsRouting(true);
    setMatches([]);
    
    // Simulate routing delay
    setTimeout(() => {
      const newMatches: MatchResult[] = [];
      offers.forEach(offer => {
        needs.forEach(need => {
          if (offer.type === need.type || (offer.type === 'solar' && need.type === 'gpu') || (offer.type === 'code' && need.type === 'labor')) {
            // Compute match
            const score = calculateResonanceScore(offer.vector, need.vector, params);
            if (score > 0.4) { // threshold
              newMatches.push({
                offerId: offer.id,
                needId: need.id,
                amount: Math.min(offer.amount, need.amount),
                score,
                explanation: {
                  compositeMatch: score,
                  compatibility: offer.vector.compatibility * need.vector.compatibility,
                  energyAvailability: offer.vector.energyCost,
                  urgencyAlignment: 1 - Math.abs(offer.vector.urgency - need.vector.urgency),
                  networkCost: offer.vector.locationCost * need.vector.locationCost,
                  reliability: offer.vector.reliability
                }
              });
            }
          }
        });
      });
      
      // Sort matches by score desc
      newMatches.sort((a, b) => b.score - a.score);
      
      // Take top 3 for visualization limits
      setMatches(newMatches.slice(0, 3));
      setIsRouting(false);
    }, 1500);
  }, [offers, needs, params]);

  const handleDiscover = (newParams: SimulationParams) => {
    setParams(newParams);
    setResult(runSimulation(newParams));
    toast.success("Resonance Window Discovered!");
  };

  const handleGenerateCatalyst = async () => {
    if (!result) return;
    try {
      const session: ResonanceCatalystSession = {
        mode: 'Resource_Resonance_Sweep',
        seed: Math.floor(Math.random() * 1000000),
        params,
        result
      };
      const artifact = await compileResonanceRun(session);
      console.log('Generated Catalyst Artifact:', artifact);
      toast.success(`Catalyst artifact ${artifact.run_id} compiled successfully.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate Catalyst artifact.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-foreground selection:bg-cyan-500/30">
      <Toaster theme="dark" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        <header className="mb-12 border-b border-slate-800 pb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Network className="w-6 h-6 text-cyan-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">The Genesis Protocol</h1>
            </div>
            <p className="text-slate-400 max-w-3xl leading-relaxed">
              <strong>Resource Resonance Simulation</strong> <br />
              This protocol does not attempt to eliminate money universally. It attempts to identify the narrow class of economic coordination problems in which direct, machine-mediated resource routing can outperform monetary intermediation, while preserving fiat where price discovery, preference expression, and financial stability remain superior coordination mechanisms.
            </p>
            <div className="mt-4 inline-flex items-center rounded-full border border-rose-900/50 bg-rose-950/30 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-rose-400">
              Complex-Systems Simulation / Proposed Allocation Model
            </div>
          </div>
          <a href="/" className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-white transition-colors border border-slate-800 px-4 py-2 rounded">
            Return to Physics Lab
          </a>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Main Visualizer & Comparison */}
          <div className="space-y-8">
            <section>
              <ResourceNetwork 
                offers={offers}
                needs={needs}
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
          </div>

          {/* Sidebar Tools & Explanations */}
          <div className="space-y-6">
            <ResonanceDiscovery onDiscover={handleDiscover} />
            
            {matches.length > 0 && (
              <MatchExplanation match={matches[0]} />
            )}
            
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
              <h3 className="font-mono text-xs font-bold tracking-widest text-slate-200 uppercase mb-4 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-cyan-400" />
                Epistemic Record
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Export a reproducible hash-chained Catalyst artifact of this simulation state, including all routing parameters and divergence metrics.
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
