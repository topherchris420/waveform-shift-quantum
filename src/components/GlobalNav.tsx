import { Activity, ArrowUpRight, Atom, Network } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const GlobalNav = () => {
  const location = useLocation();
  const isResonance = location.pathname === '/resonance';

  return (
    <header className="topline-nav sticky top-0 z-50 border-x-0 border-t-0 shadow-none">
      <div className="mx-auto flex min-h-16 max-w-[1700px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Waveform Quantum home"
          className="group flex shrink-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden bg-foreground text-background">
            <Atom className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" />
            <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-50 bg-primary transition-transform group-hover:scale-x-100" />
          </span>
          <span className="hidden sm:block">
            <span className="block font-display text-sm font-extrabold uppercase leading-none tracking-[-0.02em]">Waveform</span>
            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.25em] text-muted-foreground">Quantum systems lab</span>
          </span>
        </Link>

        <span className="hidden h-6 w-px bg-foreground/20 sm:block" aria-hidden="true" />

        <nav aria-label="Primary navigation" className="flex min-w-0 flex-1 items-center gap-1">
          <Link
            to="/"
            aria-current={!isResonance ? 'page' : undefined}
            className={`nav-tab ${!isResonance ? 'nav-tab--active' : ''}`}
          >
            Physics lab
          </Link>
          <Link
            to="/resonance"
            aria-current={isResonance ? 'page' : undefined}
            className={`nav-tab ${isResonance ? 'nav-tab--active' : ''}`}
          >
            <Network className="hidden h-3 w-3 sm:block" />
            Resonance
          </Link>
        </nav>

        <div className="hidden items-center gap-2 border-l border-foreground/20 pl-4 md:flex">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping bg-primary opacity-40" />
            <span className="relative inline-flex h-2 w-2 bg-primary" />
          </span>
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live simulation</span>
        </div>

        {!isResonance && (
          <a href="#reality-split" className="nav-launch">
            <span className="hidden sm:inline">Open workspace</span>
            <span className="sm:hidden">Open</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </header>
  );
};
