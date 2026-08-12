import React, { useEffect, useState, useMemo } from 'react';
import { MatchResult, ResourceOffer, ResourceNeed } from './engine';
import { Activity, Zap, Cpu, Code, Database, Hammer } from 'lucide-react';

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

// Colors for different resource types
const COLORS: Record<string, string> = {
  'solar': 'text-amber-400',
  'gpu': 'text-emerald-400',
  'code': 'text-indigo-400',
  'storage': 'text-cyan-400',
  'labor': 'text-rose-400',
  'default': 'text-slate-400'
};

const BG_COLORS: Record<string, string> = {
  'solar': 'bg-amber-400/20 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]',
  'gpu': 'bg-emerald-400/20 border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]',
  'code': 'bg-indigo-400/20 border-indigo-400/50 shadow-[0_0_15px_rgba(129,140,248,0.3)]',
  'storage': 'bg-cyan-400/20 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]',
  'labor': 'bg-rose-400/20 border-rose-400/50 shadow-[0_0_15px_rgba(251,113,133,0.3)]',
  'default': 'bg-slate-400/20 border-slate-400/50 shadow-[0_0_15px_rgba(148,163,184,0.3)]'
};

const STROKE_COLORS: Record<string, string> = {
  'solar': '#fbbf24',
  'gpu': '#34d399',
  'code': '#818cf8',
  'storage': '#22d3ee',
  'labor': '#fb7185',
  'default': '#94a3b8'
};

export const ResourceNetwork: React.FC<ResourceNetworkProps> = ({ offers, needs, matches, onRoute, isRouting }) => {
  const [animatedMatches, setAnimatedMatches] = useState<MatchResult[]>([]);
  const [particles, setParticles] = useState<{ id: string, match: MatchResult, progress: number }[]>([]);

  useEffect(() => {
    if (matches.length > 0 && !isRouting) {
      let delay = 0;
      setAnimatedMatches([]);
      
      matches.forEach((match, i) => {
        setTimeout(() => {
          setAnimatedMatches(prev => [...prev, match]);
          // Spawn particles
          for (let p = 0; p < 3; p++) {
            setTimeout(() => {
              const pId = `p-${i}-${p}-${Date.now()}`;
              setParticles(prev => [...prev, { id: pId, match, progress: 0 }]);
            }, p * 300);
          }
        }, delay);
        delay += 800;
      });
    } else if (matches.length === 0) {
      setAnimatedMatches([]);
      setParticles([]);
    }
  }, [matches, isRouting]);

  // Particle animation loop
  useEffect(() => {
    if (particles.length === 0) return;
    let animationFrameId: number;

    const animate = () => {
      setParticles(prev => 
        prev.map(p => ({ ...p, progress: p.progress + 0.015 }))
            .filter(p => p.progress < 1)
      );
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [particles]);

  // Helpers to calculate SVG paths
  const getOfferY = (index: number) => 15 + index * 35; // percentage
  const getNeedY = (index: number) => 15 + index * 35; // percentage

  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/50 p-6 overflow-hidden min-h-[500px] flex flex-col shadow-2xl backdrop-blur-md group">
      
      {/* 3D-ish Background Grid & Gradients */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [transform:perspective(500px)_rotateX(60deg)_translateY(-100px)_scale(2.5)] origin-top z-0" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.15)_0%,_transparent_70%)] z-0" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/80 z-0" />

      <div className="relative z-20 flex items-center justify-between mb-10">
        <h3 className="font-mono text-sm font-bold tracking-[0.2em] text-white uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          The Genesis Protocol Engine
        </h3>
        <button
          onClick={onRoute}
          disabled={isRouting}
          className="relative overflow-hidden bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 text-white font-mono text-[11px] uppercase tracking-wider px-6 py-3 rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] group-hover:border-cyan-500/50"
        >
          {isRouting ? (
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 animate-spin text-cyan-400" /> Calculating Multidimensional Tensors...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Route Native Capacity <Zap className="w-3 h-3 text-cyan-400" />
            </span>
          )}
          {/* Button shine effect */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex justify-between items-stretch gap-4">
        
        {/* SVG Layer for connections */}
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
            
            // Path from Offer (left, roughly 20% X) to Center (50% X) to Need (right, roughly 80% X)
            const pathD = `M 20 ${oY} C 40 ${oY}, 40 50, 50 50 C 60 50, 60 ${nY}, 80 ${nY}`;
            
            const strokeColor = STROKE_COLORS[offers[offerIndex]?.type] || '#fff';

            return (
              <g key={`match-path-${i}`}>
                {/* Background dashed line */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={strokeColor} 
                  strokeWidth="1.5" 
                  strokeOpacity="0.15" 
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
                
                {/* Glowing animated line */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={strokeColor} 
                  strokeWidth="2" 
                  strokeOpacity="0.8"
                  filter="url(#glow)"
                  className="animate-[dash_3s_linear_infinite]"
                  strokeDasharray="100"
                  strokeDashoffset="100"
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDirection: 'reverse' }}
                />
              </g>
            );
          })}

          {/* Render Particles */}
          {particles.map(p => {
            const offerIndex = offers.findIndex(o => o.id === p.match.offerId);
            const needIndex = needs.findIndex(n => n.id === p.match.needId);
            const oY = getOfferY(offerIndex);
            const nY = getNeedY(needIndex);
            const strokeColor = STROKE_COLORS[offers[offerIndex]?.type] || '#fff';

            // Custom cubic bezier interpolation for particle position
            // Matches the SVG path: M 20 oY C 40 oY, 40 50, 50 50 C 60 50, 60 nY, 80 nY
            const t = p.progress;
            let x, y;
            if (t < 0.5) {
              // First half (0 to 0.5 maps to t=0 to 1 for first segment)
              const t1 = t * 2;
              x = Math.pow(1-t1, 3)*20 + 3*Math.pow(1-t1, 2)*t1*40 + 3*(1-t1)*Math.pow(t1, 2)*40 + Math.pow(t1, 3)*50;
              y = Math.pow(1-t1, 3)*oY + 3*Math.pow(1-t1, 2)*t1*oY + 3*(1-t1)*Math.pow(t1, 2)*50 + Math.pow(t1, 3)*50;
            } else {
              // Second half (0.5 to 1 maps to t=0 to 1 for second segment)
              const t2 = (t - 0.5) * 2;
              x = Math.pow(1-t2, 3)*50 + 3*Math.pow(1-t2, 2)*t2*60 + 3*(1-t2)*Math.pow(t2, 2)*60 + Math.pow(t2, 3)*80;
              y = Math.pow(1-t2, 3)*50 + 3*Math.pow(1-t2, 2)*t2*50 + 3*(1-t2)*Math.pow(t2, 2)*nY + Math.pow(t2, 3)*nY;
            }

            return (
              <circle 
                key={p.id}
                cx={`${x}%`}
                cy={`${y}%`}
                r="3"
                fill={strokeColor}
                filter="url(#glow)"
                opacity={Math.sin(p.progress * Math.PI)} // Fade in and out
              />
            );
          })}
        </svg>

        {/* Left column: Offers */}
        <div className="flex flex-col justify-between w-1/4 h-[80%] my-auto z-20 relative">
          {offers.map((offer, index) => {
            const Icon = ICONS[offer.type] || ICONS['default'];
            const isMatched = animatedMatches.some(m => m.offerId === offer.id);
            const styleClass = isMatched ? BG_COLORS[offer.type] : 'bg-white/5 border-white/10';
            const textClass = isMatched ? COLORS[offer.type] : 'text-slate-500';
            
            return (
              <div 
                key={offer.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-700 transform ${isMatched ? 'scale-105 z-10' : 'scale-100'} backdrop-blur-md`}
                style={{ top: `${getOfferY(index)}%`, position: 'absolute', width: '100%', transform: `translateY(-50%) ${isMatched ? 'scale(1.05)' : ''}` }}
              >
                <div className={`p-2.5 rounded-lg border ${isMatched ? 'border-current shadow-lg' : 'border-transparent bg-black/40'}`}>
                  <Icon className={`w-5 h-5 ${textClass} ${isMatched ? 'animate-pulse' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase font-mono tracking-widest text-slate-500 truncate mb-0.5">Capacity Offer</p>
                  <p className={`text-sm font-bold truncate ${isMatched ? 'text-white' : 'text-slate-300'}`}>{offer.amount} {offer.type.toUpperCase()}</p>
                </div>
                {/* Connection point dot */}
                <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${isMatched ? BG_COLORS[offer.type] : 'bg-slate-800'}`} />
              </div>
            );
          })}
        </div>

        {/* Center: Routing Engine / Visual connections */}
        <div className="flex-1 flex flex-col justify-center items-center relative z-20">
          <div className="relative group perspective-1000">
            {/* 3D Rotating Rings */}
            <div className={`absolute inset-0 rounded-full border-b-2 border-r-2 border-cyan-500/50 w-24 h-24 -ml-4 -mt-4 transition-all duration-1000 ${isRouting ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_8s_linear_infinite]'}`} style={{ transform: 'rotateX(60deg) rotateY(20deg)' }} />
            <div className={`absolute inset-0 rounded-full border-t-2 border-l-2 border-violet-500/50 w-24 h-24 -ml-4 -mt-4 transition-all duration-1000 ${isRouting ? 'animate-[spin_1.5s_linear_infinite_reverse]' : 'animate-[spin_10s_linear_infinite_reverse]'}`} style={{ transform: 'rotateX(40deg) rotateY(-20deg)' }} />
            
            <div className={`w-16 h-16 rounded-full flex items-center justify-center relative bg-black/80 border border-white/20 backdrop-blur-xl transition-all duration-500 ${isRouting ? 'shadow-[0_0_50px_rgba(6,182,212,0.8)] scale-110' : 'shadow-[0_0_20px_rgba(6,182,212,0.2)]'}`}>
              <Activity className={`w-8 h-8 transition-all duration-500 ${isRouting ? 'text-cyan-300 animate-pulse' : 'text-cyan-600'}`} />
            </div>
          </div>
          <div className="mt-8 font-mono text-[11px] text-cyan-400/90 tracking-[0.3em] uppercase drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">
            Tensor Matcher
          </div>
          <div className="text-[9px] text-slate-500 font-mono tracking-widest mt-1">
            N-Dimensional Routing
          </div>
        </div>

        {/* Right column: Needs */}
        <div className="flex flex-col justify-between w-1/4 h-[80%] my-auto z-20 relative">
          {needs.map((need, index) => {
            const Icon = ICONS[need.type] || ICONS['default'];
            const isMatched = animatedMatches.some(m => m.needId === need.id);
            const styleClass = isMatched ? BG_COLORS[need.type] : 'bg-white/5 border-white/10';
            const textClass = isMatched ? COLORS[need.type] : 'text-slate-500';
            
            return (
              <div 
                key={need.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-700 transform ${isMatched ? 'scale-105 z-10' : 'scale-100'} backdrop-blur-md`}
                style={{ top: `${getNeedY(index)}%`, position: 'absolute', width: '100%', transform: `translateY(-50%) ${isMatched ? 'scale(1.05)' : ''}` }}
              >
                {/* Connection point dot */}
                <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${isMatched ? BG_COLORS[need.type] : 'bg-slate-800'}`} />
                
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[9px] uppercase font-mono tracking-widest text-slate-500 truncate mb-0.5">{need.requesterId}</p>
                  <p className={`text-sm font-bold truncate ${isMatched ? 'text-white' : 'text-slate-300'}`}>{need.amount} {need.type.toUpperCase()}</p>
                </div>
                <div className={`p-2.5 rounded-lg border ${isMatched ? 'border-current shadow-lg' : 'border-transparent bg-black/40'}`}>
                  <Icon className={`w-5 h-5 ${textClass} ${isMatched ? 'animate-pulse' : ''}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Add global styles for the dash animation if not present in tailwind config
// In a real app this would go in index.css, but we'll inline it here for the artifact
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes dash {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes shimmer {
      100% {
        transform: translateX(100%);
      }
    }
  `;
  document.head.appendChild(style);
}
