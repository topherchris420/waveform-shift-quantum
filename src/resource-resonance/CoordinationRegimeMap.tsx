import React, { useEffect, useState } from 'react';
import { buildCoordinationRegimeMap, RegimePoint, SimulationParams } from './engine';

const colors: Record<string, string> = {
  'MARKET SUPERIOR': 'bg-amber-500',
  'STABILIZED MARKET SUPERIOR': 'bg-emerald-500',
  'HYBRID SUPERIOR': 'bg-indigo-500',
  'GENESIS SUPERIOR IN THIS REGIME': 'bg-cyan-500',
  'NO SIGNIFICANT DIFFERENCE': 'bg-slate-600',
  'INSUFFICIENT EVIDENCE': 'bg-rose-500',
};

export const CoordinationRegimeMap = ({ params }: { params: SimulationParams }) => {
  const [points, setPoints] = useState<RegimePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer regime map computation to an asynchronous microtask/timer turn so initial page mount is instant
    const timer = setTimeout(() => {
      if (cancelled) return;
      const res = buildCoordinationRegimeMap(params);
      if (!cancelled) setPoints(res);
    }, 10);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [params]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-200">
        Coordination Regime Map
      </h3>
      <p className="mt-2 text-[11px] text-slate-500">
        Scenario grid: financial stress → (x), routing-data reliability ↑ (y). Each cell reports the strongest
        modeled net outcome; uncertainty can produce no winner.
      </p>
      <div className="mt-4 grid grid-cols-5 gap-1 min-h-[140px]">
        {points
          ? points.map((p, i) => (
              <div
                key={i}
                title={`${p.winner}\nMarket ${p.utilities.market.toFixed(1)} · Stabilized ${p.utilities.stabilizedMarket.toFixed(1)} · Hybrid ${p.utilities.hybrid.toFixed(1)} · Genesis ${p.utilities.genesis.toFixed(1)}`}
                className={`aspect-square rounded-sm ${colors[p.winner] || 'bg-slate-700'} opacity-80 hover:opacity-100 transition-opacity`}
              />
            ))
          : Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-sm bg-slate-800/60 animate-pulse" />
            ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
        {Object.entries(colors).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5 font-mono text-[8px] uppercase text-slate-500">
            <i className={`h-2 w-2 ${c}`} />
            {k}
          </span>
        ))}
      </div>
    </section>
  );
};
