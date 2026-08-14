import React, { useEffect, useState, useRef } from 'react';
import { MatchResult, ResourceOffer, ResourceNeed } from './engine';
import { Activity, Zap, Cpu, Code, Database, Hammer, Battery, ArrowRightLeft, RadioReceiver } from 'lucide-react';

export interface RelayNode {
  id: string;
  type: 'battery' | 'broker' | 'hub';
  name: string;
  capacity: number;
}

interface ResourceNetworkProps {
  offers: ResourceOffer[];
  needs: ResourceNeed[];
  relays: RelayNode[];
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
  'battery': Battery,
  'broker': ArrowRightLeft,
  'hub': RadioReceiver,
  'default': Activity
};

const COLORS: Record<string, string> = {
  'solar': 'text-amber-400',
  'gpu': 'text-emerald-400',
  'code': 'text-indigo-400',
  'storage': 'text-cyan-400',
  'labor': 'text-rose-400',
  'battery': 'text-fuchsia-400',
  'broker': 'text-violet-400',
  'hub': 'text-blue-400',
  'default': 'text-slate-400'
};

const BG_COLORS: Record<string, string> = {
  'solar': 'bg-amber-400/20 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]',
  'gpu': 'bg-emerald-400/20 border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]',
  'code': 'bg-indigo-400/20 border-indigo-400/50 shadow-[0_0_15px_rgba(129,140,248,0.3)]',
  'storage': 'bg-cyan-400/20 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]',
  'labor': 'bg-rose-400/20 border-rose-400/50 shadow-[0_0_15px_rgba(251,113,133,0.3)]',
  'battery': 'bg-fuchsia-400/20 border-fuchsia-400/50 shadow-[0_0_15px_rgba(232,121,249,0.3)]',
  'broker': 'bg-violet-400/20 border-violet-400/50 shadow-[0_0_15px_rgba(167,139,250,0.3)]',
  'hub': 'bg-blue-400/20 border-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.3)]',
  'default': 'bg-slate-400/20 border-slate-400/50 shadow-[0_0_15px_rgba(148,163,184,0.3)]'
};

const STROKE_COLORS: Record<string, string> = {
  'solar': '#fbbf24',
  'gpu': '#34d399',
  'code': '#818cf8',
  'storage': '#22d3ee',
  'labor': '#fb7185',
  'battery': '#e879f9',
  'broker': '#a78bfa',
  'hub': '#60a5fa',
  'default': '#94a3b8'
};

export const ResourceNetwork: React.FC<ResourceNetworkProps> = ({ offers, needs, relays, matches, onRoute, isRouting }) => {
  const [animatedMatches, setAnimatedMatches] = useState<MatchResult[]>([]);
  
  // Use state just to mount the particle elements, but NOT for their progress updates.
  const [particleInstances, setParticleInstances] = useState<{ id: string, match: MatchResult, pIndex: number }[]>([]);
  
  // DOM Refs to bypass React renders for the 60FPS loop
  const circleRefs = useRef<{ [id: string]: SVGCircleElement | null }>({});
  const progressRefs = useRef<{ [id: string]: number }>({});

  useEffect(() => {
    if (matches.length > 0 && !isRouting) {
      let delay = 0;
      setAnimatedMatches([]);
      setParticleInstances([]);
      progressRefs.current = {};
      
      matches.forEach((match, i) => {
        setTimeout(() => {
          setAnimatedMatches(prev => [...prev, match]);
          for (let p = 0; p < 3; p++) {
            setTimeout(() => {
              const pId = `p-${i}-${p}-${Date.now()}`;
              setParticleInstances(prev => [...prev, { id: pId, match, pIndex: p }]);
              progressRefs.current[pId] = 0;
            }, p * 300);
          }
        }, delay);
        delay += 800;
      });
    } else if (matches.length === 0) {
      setAnimatedMatches([]);
      setParticleInstances([]);
      progressRefs.current = {};
    }
  }, [matches, isRouting]);

  useEffect(() => {
    if (particleInstances.length === 0) return;
    let animationFrameId: number;

    const animate = () => {
      for (const pId in progressRefs.current) {
         let progress = progressRefs.current[pId];
         progress += 0.012;
         if (progress > 1) progress = 0; // Infinite loop for persistent flow
         progressRefs.current[pId] = progress;

         const circle = circleRefs.current[pId];
         if (circle) {
             const instance = particleInstances.find(p => p.id === pId);
             if (instance) {
                 const offerIndex = offers.findIndex(o => o.id === instance.match.offerId);
                 const needIndex = needs.findIndex(n => n.id === instance.match.needId);
                 const oY = 15 + offerIndex * 30;
                 const nY = 15 + needIndex * 30;
                 
                 const t = progress;
                 let x, y;

                 if (instance.match.routeType === 'multi-hop' && instance.match.relayNodeId) {
                    const relayIndex = relays.findIndex(r => r.id === instance.match.relayNodeId);
                    const rY = 25 + relayIndex * 30;
                    if (t < 0.5) {
                      const t1 = t * 2;
                      x = Math.pow(1-t1, 3)*20 + 3*Math.pow(1-t1, 2)*t1*35 + 3*(1-t1)*Math.pow(t1, 2)*35 + Math.pow(t1, 3)*50;
                      y = Math.pow(1-t1, 3)*oY + 3*Math.pow(1-t1, 2)*t1*oY + 3*(1-t1)*Math.pow(t1, 2)*rY + Math.pow(t1, 3)*rY;
                    } else {
                      const t2 = (t - 0.5) * 2;
                      x = Math.pow(1-t2, 3)*50 + 3*Math.pow(1-t2, 2)*t2*65 + 3*(1-t2)*Math.pow(t2, 2)*65 + Math.pow(t2, 3)*80;
                      y = Math.pow(1-t2, 3)*rY + 3*Math.pow(1-t2, 2)*t2*rY + 3*(1-t2)*Math.pow(t2, 2)*nY + Math.pow(t2, 3)*nY;
                    }
                 } else {
                    if (t < 0.5) {
                      const t1 = t * 2;
                      x = Math.pow(1-t1, 3)*20 + 3*Math.pow(1-t1, 2)*t1*40 + 3*(1-t1)*Math.pow(t1, 2)*40 + Math.pow(t1, 3)*50;
                      y = Math.pow(1-t1, 3)*oY + 3*Math.pow(1-t1, 2)*t1*oY + 3*(1-t1)*Math.pow(t1, 2)*50 + Math.pow(t1, 3)*50;
                    } else {
                      const t2 = (t - 0.5) * 2;
                      x = Math.pow(1-t2, 3)*50 + 3*Math.pow(1-t2, 2)*t2*60 + 3*(1-t2)*Math.pow(t2, 2)*60 + Math.pow(t2, 3)*80;
                      y = Math.pow(1-t2, 3)*50 + 3*Math.pow(1-t2, 2)*t2*50 + 3*(1-t2)*Math.pow(t2, 2)*nY + Math.pow(t2, 3)*nY;
                    }
                 }
                 
                 circle.setAttribute('cx', `${x}%`);
                 circle.setAttribute('cy', `${y}%`);
                 circle.setAttribute('opacity', `${Math.sin(progress * Math.PI)}`);
             }
         }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [particleInstances, offers, needs, relays]);

  const getOfferY = (index: number) => 15 + index * 30; 
  const getNeedY = (index: number) => 15 + index * 30; 
  const getRelayY = (index: number) => 25 + index * 30; // Center column

  return (
    <div className="relative flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-3 shadow-2xl backdrop-blur-md group sm:p-6">
      
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [transform:perspective(500px)_rotateX(60deg)_translateY(-100px)_scale(2.5)] origin-top z-0" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.15)_0%,_transparent_70%)] z-0" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/80 z-0" />

      <div className="relative z-20 mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="font-mono text-sm font-bold tracking-[0.2em] text-white uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Triangulation Engine
        </h3>
        <button
          onClick={onRoute}
          disabled={isRouting}
          className="relative min-h-11 overflow-hidden rounded-lg border border-white/20 bg-white/10 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] disabled:opacity-50 group-hover:border-cyan-500/50 sm:px-6 sm:text-[11px]"
        >
          {isRouting ? (
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 animate-spin text-cyan-400" /> Calculating Multi-Hop Routes...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Route Native Capacity <Zap className="w-3 h-3 text-cyan-400" />
            </span>
          )}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
        </button>
      </div>

      <div className="relative z-10 -mx-3 flex-1 overflow-x-auto px-3 pb-2 sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="relative mt-6 flex min-h-[390px] min-w-[620px] flex-1 items-stretch justify-between gap-4 sm:min-w-0">
        
        {/* SVG Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {animatedMatches.map((match, i) => {
            const offerIndex = offers.findIndex(o => o.id === match.offerId);
            const needIndex = needs.findIndex(n => n.id === match.needId);
            const oY = getOfferY(offerIndex);
            const nY = getNeedY(needIndex);
            const strokeColor = STROKE_COLORS[offers[offerIndex]?.type] || '#fff';
            
            let pathD = '';
            if (match.routeType === 'multi-hop' && match.relayNodeId) {
               const relayIndex = relays.findIndex(r => r.id === match.relayNodeId);
               const rY = getRelayY(relayIndex);
               // Multi-hop path: Offer(20) -> Relay(50) -> Need(80)
               pathD = `M 20 ${oY} C 35 ${oY}, 35 ${rY}, 50 ${rY} C 65 ${rY}, 65 ${nY}, 80 ${nY}`;
            } else {
               // Direct path: Offer(20) -> Need(80) directly across the middle
               pathD = `M 20 ${oY} C 40 ${oY}, 40 50, 50 50 C 60 50, 60 ${nY}, 80 ${nY}`;
            }

            return (
              <g key={`match-path-${i}`}>
                <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeOpacity="0.15" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeOpacity="0.8" filter="url(#glow)" className="animate-[dash_3s_linear_infinite]" strokeDasharray="100" strokeDashoffset="100" vectorEffect="non-scaling-stroke" style={{ animationDirection: 'reverse' }} />
              </g>
            );
          })}

          {particleInstances.map(p => {
            const offerIndex = offers.findIndex(o => o.id === p.match.offerId);
            const strokeColor = STROKE_COLORS[offers[offerIndex]?.type] || '#fff';

            return (
              <circle 
                key={p.id}
                ref={(el) => (circleRefs.current[p.id] = el)}
                cx="0%"
                cy="0%"
                r="3"
                fill={strokeColor}
                filter="url(#glow)"
                opacity="0"
              />
            );
          })}
        </svg>

        {/* Left column: Offers */}
        <div className="flex flex-col justify-between w-[25%] h-full my-auto z-20 relative">
          {offers.map((offer, index) => {
            const Icon = ICONS[offer.type] || ICONS['default'];
            const isMatched = animatedMatches.some(m => m.offerId === offer.id);
            
            return (
              <div 
                key={offer.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-700 transform ${isMatched ? 'scale-105 z-10' : 'scale-100'} backdrop-blur-md`}
                style={{ top: `${getOfferY(index)}%`, position: 'absolute', width: '100%', transform: `translateY(-50%) ${isMatched ? 'scale(1.05)' : ''}` }}
              >
                <div className={`p-2 rounded-lg border ${isMatched ? 'border-current shadow-lg' : 'border-transparent bg-black/40'}`}>
                  <Icon className={`w-4 h-4 ${isMatched ? COLORS[offer.type] + ' animate-pulse' : 'text-slate-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase font-mono tracking-widest text-slate-500 truncate mb-0.5">Offer</p>
                  <p className={`text-xs font-bold truncate ${isMatched ? 'text-white' : 'text-slate-300'}`}>{offer.amount} {offer.type.toUpperCase()}</p>
                </div>
                <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${isMatched ? BG_COLORS[offer.type] : 'bg-slate-800'}`} />
              </div>
            );
          })}
        </div>

        {/* Center column: Relay Nodes & Core Engine */}
        <div className="w-[20%] relative z-20 flex flex-col justify-between h-full">
           {relays.map((relay, index) => {
              const Icon = ICONS[relay.type] || ICONS['default'];
              const isMatched = animatedMatches.some(m => m.routeType === 'multi-hop' && m.relayNodeId === relay.id);
              
              return (
                <div 
                  key={relay.id} 
                  className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all duration-700 transform ${isMatched ? 'scale-105 z-10' : 'scale-100'} backdrop-blur-md bg-black/40`}
                  style={{ top: `${getRelayY(index)}%`, position: 'absolute', width: '100%', transform: `translateY(-50%) ${isMatched ? 'scale(1.05)' : ''}` }}
                >
                  <div className={`p-2 rounded-full border ${isMatched ? 'border-current shadow-[0_0_15px_currentColor]' : 'border-slate-700'} ${isMatched ? COLORS[relay.type] : 'text-slate-500'}`}>
                    <Icon className={`w-4 h-4 ${isMatched ? 'animate-bounce' : ''}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] uppercase font-mono tracking-widest text-slate-500 truncate">{relay.type} relay</p>
                    <p className={`text-[10px] font-bold truncate ${isMatched ? 'text-white' : 'text-slate-400'}`}>{relay.name}</p>
                  </div>
                </div>
              );
           })}
           
           {/* Center Engine Core if no relays are active, or just behind them */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-40">
              <div className={`w-32 h-32 rounded-full border-2 border-dashed border-cyan-900/50 flex items-center justify-center transition-all duration-1000 ${isRouting ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
           </div>
        </div>

        {/* Right column: Needs */}
        <div className="flex flex-col justify-between w-[25%] h-full my-auto z-20 relative">
          {needs.map((need, index) => {
            const Icon = ICONS[need.type] || ICONS['default'];
            const isMatched = animatedMatches.some(m => m.needId === need.id);
            
            return (
              <div 
                key={need.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-700 transform ${isMatched ? 'scale-105 z-10' : 'scale-100'} backdrop-blur-md`}
                style={{ top: `${getNeedY(index)}%`, position: 'absolute', width: '100%', transform: `translateY(-50%) ${isMatched ? 'scale(1.05)' : ''}` }}
              >
                <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${isMatched ? BG_COLORS[need.type] : 'bg-slate-800'}`} />
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[9px] uppercase font-mono tracking-widest text-slate-500 truncate mb-0.5">Need</p>
                  <p className={`text-xs font-bold truncate ${isMatched ? 'text-white' : 'text-slate-300'}`}>{need.amount} {need.type.toUpperCase()}</p>
                </div>
                <div className={`p-2 rounded-lg border ${isMatched ? 'border-current shadow-lg' : 'border-transparent bg-black/40'}`}>
                  <Icon className={`w-4 h-4 ${isMatched ? COLORS[need.type] + ' animate-pulse' : 'text-slate-500'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
};
