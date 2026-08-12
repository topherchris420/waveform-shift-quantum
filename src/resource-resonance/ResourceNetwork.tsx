import React, { useEffect, useState } from 'react';
import { MatchResult, ResourceOffer, ResourceNeed } from './engine';
import { Activity, Zap, Cpu, Code, Database, Hammer, ArrowRight } from 'lucide-react';

interface ResourceNetworkProps {
  offers: ResourceOffer[];
  needs: ResourceNeed[];
  matches: MatchResult[];
  onRoute: () => void;
  isRouting: boolean;
}

const ICONS: Record<string, React.ElementType> = {
  'solar': Zap,
  'gpu': Cpu,
  'code': Code,
  'storage': Database,
  'labor': Hammer,
  'default': Activity
};

export const ResourceNetwork: React.FC<ResourceNetworkProps> = ({ offers, needs, matches, onRoute, isRouting }) => {
  const [animatedMatches, setAnimatedMatches] = useState<MatchResult[]>([]);

  useEffect(() => {
    if (matches.length > 0 && !isRouting) {
      let delay = 0;
      setAnimatedMatches([]);
      matches.forEach((match, i) => {
        setTimeout(() => {
          setAnimatedMatches(prev => [...prev, match]);
        }, delay);
        delay += 600; // stagger the matching animations
      });
    } else if (matches.length === 0) {
      setAnimatedMatches([]);
    }
  }, [matches, isRouting]);

  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 p-6 overflow-hidden min-h-[400px] flex flex-col">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-slate-950/20 to-slate-950/80" />
      
      <div className="relative z-10 flex items-center justify-between mb-8">
        <h3 className="font-mono text-sm font-bold tracking-widest text-slate-200 uppercase">
          Decentralized Resource Routing
        </h3>
        <button
          onClick={onRoute}
          disabled={isRouting}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded transition-all"
        >
          {isRouting ? 'Computing Vectors...' : 'Route My Resources'}
        </button>
      </div>

      <div className="relative z-10 flex-1 flex justify-between items-stretch gap-4">
        {/* Left column: Offers */}
        <div className="flex flex-col justify-around gap-4 w-1/3">
          {offers.map(offer => {
            const Icon = ICONS[offer.type] || ICONS['default'];
            const isMatched = animatedMatches.some(m => m.offerId === offer.id);
            return (
              <div 
                key={offer.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-500
                  ${isMatched ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/50'}
                  ${isRouting ? 'animate-pulse' : ''}
                `}
              >
                <div className={`p-2 rounded-md ${isMatched ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                  <Icon className={`w-4 h-4 ${isMatched ? 'text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-mono text-slate-500 truncate">{offer.providerId}</p>
                  <p className="text-xs font-semibold text-slate-200 truncate">{offer.amount} {offer.type}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center: Routing Engine / Visual connections */}
        <div className="flex-1 flex flex-col justify-center items-center relative">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 flex items-center justify-center relative">
            <div className={`absolute inset-0 rounded-full border border-cyan-400 ${isRouting ? 'animate-ping' : ''}`} />
            <Activity className={`w-6 h-6 ${isRouting ? 'text-cyan-400 animate-pulse' : 'text-cyan-600'}`} />
          </div>
          <div className="mt-4 font-mono text-[10px] text-cyan-500/70 tracking-widest uppercase">
            Resonance Core
          </div>
          
          {/* Animated match lines could go here in a more complex canvas setup. 
              For now we'll rely on highlighting the nodes and showing the match list below. */}
        </div>

        {/* Right column: Needs */}
        <div className="flex flex-col justify-around gap-4 w-1/3">
          {needs.map(need => {
            const Icon = ICONS[need.type] || ICONS['default'];
            const isMatched = animatedMatches.some(m => m.needId === need.id);
            return (
              <div 
                key={need.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-500
                  ${isMatched ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/50'}
                  ${isRouting ? 'animate-pulse' : ''}
                `}
              >
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[10px] uppercase font-mono text-slate-500 truncate">{need.requesterId}</p>
                  <p className="text-xs font-semibold text-slate-200 truncate">{need.amount} {need.type}</p>
                </div>
                <div className={`p-2 rounded-md ${isMatched ? 'bg-cyan-500/20' : 'bg-slate-800'}`}>
                  <Icon className={`w-4 h-4 ${isMatched ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match feed */}
      <div className="relative z-10 mt-8 min-h-[60px]">
        {animatedMatches.map((m, i) => (
          <div 
            key={m.offerId + m.needId + i} 
            className="flex items-center justify-center gap-3 text-xs font-mono animate-in slide-in-from-bottom-2 fade-in duration-300"
          >
            <span className="text-emerald-400">{offers.find(o => o.id === m.offerId)?.type}</span>
            <ArrowRight className="w-3 h-3 text-slate-600" />
            <span className="text-cyan-400">{needs.find(n => n.id === m.needId)?.type}</span>
            <span className="text-slate-500 ml-4">Score: {m.score.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
