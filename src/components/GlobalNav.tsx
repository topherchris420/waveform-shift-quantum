import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Activity, Network } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';

export const GlobalNav = () => {
  const location = useLocation();
  const isResonance = location.pathname === '/resonance';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex min-h-14 max-w-screen-2xl flex-col items-stretch gap-2 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 group">
            {isResonance ? (
              <Network className="h-5 w-5 shrink-0 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            ) : (
              <Shield className="h-5 w-5 shrink-0 text-primary group-hover:text-primary/80 transition-colors" />
            )}
            <span className="truncate font-mono text-xs font-bold tracking-wider sm:text-sm">
              {isResonance ? 'THE GENESIS PROTOCOL' : 'QUANTUM LABORATORY'}
            </span>
          </Link>
          
          <nav aria-label="Primary navigation" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium sm:gap-x-6 sm:text-sm">
            <Link 
              to="/" 
              className={`shrink-0 transition-colors hover:text-foreground/80 ${!isResonance ? 'text-foreground' : 'text-foreground/60'}`}
            >
              Physics Lab
            </Link>
            <Link 
              to="/resonance" 
              className={`shrink-0 transition-colors hover:text-cyan-400 ${isResonance ? 'text-cyan-400' : 'text-foreground/60'}`}
            >
              Economics Engine
            </Link>
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="text-muted-foreground tracking-widest">SYSTEM ONLINE</span>
          </div>
          {isResonance ? (
             <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 border border-cyan-900/50 bg-cyan-950/30 px-3 py-1 rounded">
               Multi-Hop Triangulation
             </div>
          ) : (
             <Button
               variant="outline"
               size="sm"
               aria-label="Initialize Quantum Laboratory System"
               onClick={() => {
                 document.getElementById('reality-split')?.scrollIntoView({ behavior: 'smooth' });
                 toast.success('System initialization sequence active.');
               }}
               className="hidden sm:flex font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
             >
               INITIALIZE SYSTEM
             </Button>
          )}
        </div>
      </div>
    </header>
  );
};
