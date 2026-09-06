import React, { useState } from 'react';
import { SimulationParams, OverheadSensitivityReport, runOverheadSensitivity } from './engine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, SlidersHorizontal, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

interface Props {
  params: SimulationParams;
  onChange: (patch: Partial<SimulationParams>) => void;
}

const ASSUMPTIONS: { key: keyof SimulationParams; label: string; note: string; max: number }[] = [
  { key: 'marketOverhead', label: 'Market coordination cost', note: 'Clearing, brokerage and settlement friction.', max: 0.4 },
  { key: 'hybridOverhead', label: 'Hybrid coordination cost', note: 'Prices plus an optimizer reading telemetry.', max: 0.4 },
  { key: 'genesisOverhead', label: 'Genesis coordination cost', note: 'Direct routing: solving and dispatch.', max: 0.4 },
  { key: 'telemetryVerificationCost', label: 'Telemetry verification cost', note: 'Cost of checking self-reported physical state.', max: 0.5 },
  { key: 'deadlinePressure', label: 'Deadline pressure', note: 'How much value a missed delivery window destroys.', max: 1 },
  { key: 'storageBridgeEfficiency', label: 'Storage bridge efficiency', note: 'Fraction preserved when a battery time-shifts energy.', max: 1 },
];

export const AssumptionSensitivity: React.FC<Props> = ({ params, onChange }) => {
  const [report, setReport] = useState<OverheadSensitivityReport | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 50));
    setReport(runOverheadSensitivity(params));
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
      <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-slate-200 sm:text-sm">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-cyan-400" />
        Assumptions &amp; sensitivity
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        These constants are modelling choices, not measurements. They can decide who wins, so they are editable and the
        claim is re-tested across a band around them.
      </p>

      <div className="mt-4 space-y-4">
        {ASSUMPTIONS.map((a) => {
          const value = (params[a.key] as number) ?? 0;
          return (
            <div key={a.key as string}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-medium text-slate-200">{a.label}</span>
                <span className="font-mono text-[11px] text-cyan-300">{value.toFixed(2)}</span>
              </div>
              <Slider
                className="mt-2"
                value={[value]}
                min={0}
                max={a.max}
                step={0.01}
                onValueChange={([v]) => onChange({ [a.key]: v } as Partial<SimulationParams>)}
              />
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{a.note}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          Ground truth is physical: solar surplus expires inside its window, jobs carry deadlines, flexible workloads can
          shift, and batteries bridge the gap at a loss. Prices see only a coarse delivery block; routing sees noisy
          telemetry; only the oracle sees the latent outcome.
        </p>
      </div>

      <Button
        onClick={run}
        disabled={busy}
        variant="outline"
        className="mt-4 h-11 w-full border-cyan-900/50 font-mono text-[11px] uppercase tracking-wider text-cyan-400 hover:bg-cyan-950/30"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sweeping cost assumptions…
          </>
        ) : (
          'Run cost sensitivity sweep'
        )}
      </Button>

      {report && (
        <div
          className={`mt-4 rounded-lg border p-3 ${
            report.robust ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-amber-500/40 bg-amber-950/10'
          }`}
        >
          <div className="flex items-start gap-2">
            {report.robust ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <p className="text-[11px] leading-relaxed text-slate-300">{report.summary}</p>
          </div>

          <table className="mt-3 w-full font-mono text-[10px]">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 text-left font-normal">cost</th>
                <th className="py-1 text-right font-normal">Δ vs market</th>
                <th className="py-1 text-right font-normal">Δ vs hybrid</th>
              </tr>
            </thead>
            <tbody>
              {report.points.map((point) => (
                <tr key={point.multiplier} className="border-t border-slate-800">
                  <td className="py-1 text-slate-400">
                    {point.label} · {point.genesisOverhead.toFixed(2)}
                  </td>
                  <td className={`py-1 text-right ${point.deltaVsMarket > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {point.deltaVsMarket >= 0 ? '+' : ''}
                    {point.deltaVsMarket.toFixed(2)}
                  </td>
                  <td className={`py-1 text-right ${point.deltaVsHybrid > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {point.deltaVsHybrid >= 0 ? '+' : ''}
                    {point.deltaVsHybrid.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
