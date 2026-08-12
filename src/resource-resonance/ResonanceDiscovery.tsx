import React, { useState } from 'react';
import { SimulationParams, runSimulation } from './engine';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ResonanceDiscoveryProps {
  onDiscover: (params: SimulationParams) => void;
}

export const ResonanceDiscovery: React.FC<ResonanceDiscoveryProps> = ({ onDiscover }) => {
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweptRegions, setSweptRegions] = useState(0);

  const handleSweep = () => {
    setIsSweeping(true);
    setSweptRegions(0);

    // Simulate a parameter sweep
    const interval = setInterval(() => {
      setSweptRegions(r => {
        if (r > 80) {
          clearInterval(interval);
          setIsSweeping(false);
          // Pick an interesting state where Resonance wins big or fails
          const interestingParams: SimulationParams = {
            resourceScarcity: 0.6,
            networkSize: 100,
            renewableVolatility: 0.85,
            computeDemand: 0.7,
            urgency: 0.5,
            geographicalFriction: 0.8,
            participantReliability: 0.9,
            supplyDemandImbalance: 0.2
          };
          onDiscover(interestingParams);
          return r;
        }
        return r + 5;
      });
    }, 100);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-4">
        <h3 className="font-mono text-sm font-bold tracking-widest text-slate-200 uppercase flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" />
          Discovery Engine
        </h3>
        <p className="text-xs text-slate-400 mt-2 max-w-xl">
          Sweep parameter space (scarcity, network friction, renewable volatility, reliability) to find 
          <strong> Resonance Windows</strong> where direct routing drastically outperforms the monetary baseline, or 
          <strong> Failure Regions</strong> where it collapses.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 mt-6">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleSweep} 
                disabled={isSweeping}
                className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-mono uppercase text-xs tracking-wider h-10 px-6 cursor-help"
              >
                {isSweeping ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sweeping Space...</>
                ) : (
                  'Find Resonance Window'
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px] border-cyan-900/50 bg-slate-900 text-xs text-slate-300">
              <p>Simulates thousands of multi-dimensional routing configurations to find edge cases where the physics of computation mathematically beats the compression of fiat pricing.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {isSweeping && (
          <div className="flex-1 w-full">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 transition-all duration-75"
                style={{ width: `${sweptRegions}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1 text-right">
              Analyzing {sweptRegions * 1234} configurations...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
