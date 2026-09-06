import React, { useState } from 'react';
import { SimulationParams, OverheadSensitivityReport, runOverheadSensitivity } from './engine';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

interface Props {
  params: SimulationParams;
  onChange: (patch: Partial<SimulationParams>) => void;
}

const TIMING: { key: 'deadlinePressure' | 'storageBridgeEfficiency'; label: string; note: string }[] = [
  { key: 'deadlinePressure', label: 'Deadline pressure', note: 'How much value a missed delivery window destroys.' },
  { key: 'storageBridgeEfficiency', label: 'Storage bridge efficiency', note: 'Fraction preserved when a battery time-shifts energy.' },
];

export const AssumptionSensitivity: React.FC<Props> = ({ params, onChange }) => {
  const [report, setReport] = useState<OverheadSensitivityReport | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    setReport(runOverheadSensitivity(params));
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h3 className="font-mono text-xs font-bold uppercase tracking-widest sm:text-sm">Physical timing &amp; sensitivity</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Ground truth is physical: surplus solar expires inside its window, jobs carry deadlines, flexible workloads can
        shift, and batteries bridge the gap at a loss. Prices see only a coarse delivery block; routing sees noisy
        telemetry; only the oracle sees the latent outcome.
      </p>

      <div className="mt-4 space-y-4">
        {TIMING.map((assumption) => {
          const value = params[assumption.key] ?? 0;
          return (
            <label key={assumption.key} className="block">
              <span className="flex items-baseline justify-between font-mono text-[10px]">
                <span className="text-muted-foreground">{assumption.label}</span>
                <span>{(value * 100).toFixed(0)}%</span>
              </span>
              <input
                className="mt-1 h-1.5 w-full accent-primary"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={value}
                onChange={(event) => onChange({ [assumption.key]: Number(event.target.value) } as Partial<SimulationParams>)}
              />
              <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground/80">{assumption.note}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Coordination costs above are assumptions, not measurements — sweep them to see whether the direction of the
          result survives halving and doubling the Genesis cost constant.
        </p>
      </div>

      <Button onClick={run} disabled={busy} variant="outline" className="mt-4 h-11 w-full font-mono text-[11px] uppercase tracking-wider">
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
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            {report.robust ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <p className="text-[11px] leading-relaxed">{report.summary}</p>
          </div>

          <table className="mt-3 w-full font-mono text-[10px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">cost</th>
                <th className="py-1 text-right font-normal">Δ vs market</th>
                <th className="py-1 text-right font-normal">Δ vs hybrid</th>
              </tr>
            </thead>
            <tbody>
              {report.points.map((point) => (
                <tr key={point.multiplier} className="border-t border-border">
                  <td className="py-1 text-muted-foreground">
                    {point.label} · {point.genesisOverhead.toFixed(2)}
                  </td>
                  <td className={`py-1 text-right ${point.deltaVsMarket > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {point.deltaVsMarket >= 0 ? '+' : ''}
                    {point.deltaVsMarket.toFixed(2)}
                  </td>
                  <td className={`py-1 text-right ${point.deltaVsHybrid > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
