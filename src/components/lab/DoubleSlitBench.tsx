import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Waves, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { evaluateInstrument } from '@/lib/instruments';
import { doubleSlitIntensity } from '@/lib/physics';

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 280;
const Y_MAX_MM = 4;

function lcg(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

/** Rejection sample a photon coordinate from the Fraunhofer intensity. */
function samplePhotonY(shot: number, d: number, lambda: number, L: number) {
  let s = lcg(shot * 2654435761);
  for (let i = 0; i < 48; i++) {
    s = lcg(s);
    const y = ((s / 4294967296) * 2 - 1) * Y_MAX_MM;
    s = lcg(s);
    if (s / 4294967296 <= doubleSlitIntensity(y, d, lambda, L)) return y;
  }
  return 0;
}

/**
 * Local Fraunhofer double-slit bench. Intensity is the established
 * I/I₀ = cos²(π d sinθ / λ) calibration case, gated to interference mode.
 */
export const DoubleSlitBench: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wavelength, setWavelength] = useState([633]);
  const [slitSep, setSlitSep] = useState([100]);
  const [screenDist, setScreenDist] = useState([1000]);
  const [probeY, setProbeY] = useState([0.5]);
  const [hits, setHits] = useState<number[]>([]);
  const shotRef = useRef(0);

  const intensity = useMemo(
    () => doubleSlitIntensity(probeY[0], slitSep[0], wavelength[0], screenDist[0]),
    [probeY, slitSep, wavelength, screenDist],
  );

  const local = useMemo(
    () =>
      evaluateInstrument('double_slit_intensity', {
        y_mm: probeY[0],
        slit_separation_um: slitSep[0],
        wavelength_nm: wavelength[0],
        screen_distance_mm: screenDist[0],
      }),
    [probeY, slitSep, wavelength, screenDist],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const padL = 48;
    const padR = 16;
    const padT = 18;
    const padB = 36;
    const width = CANVAS_WIDTH - padL - padR;
    const height = CANVAS_HEIGHT - padT - padB;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + height);
    ctx.lineTo(padL + width, padT + height);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    for (let px = 0; px <= width; px++) {
      const y = ((px / width) * 2 - 1) * Y_MAX_MM;
      const I = doubleSlitIntensity(y, slitSep[0], wavelength[0], screenDist[0]);
      const x = padL + px;
      const yy = padT + height - I * height;
      if (px === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    const bins = 64;
    const counts = new Array<number>(bins).fill(0);
    hits.forEach((y) => {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((y + Y_MAX_MM) / (2 * Y_MAX_MM)) * bins)));
      counts[idx] += 1;
    });
    const maxCount = Math.max(1, ...counts);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.35)';
    counts.forEach((count, i) => {
      const x = padL + (i / bins) * width;
      const h = (count / maxCount) * height * 0.85;
      ctx.fillRect(x, padT + height - h, width / bins, h);
    });

    const probeX = padL + ((probeY[0] + Y_MAX_MM) / (2 * Y_MAX_MM)) * width;
    ctx.strokeStyle = '#fbbf24';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(probeX, padT);
    ctx.lineTo(probeX, padT + height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px ui-monospace, JetBrains Mono, monospace';
    ctx.fillText('−4 mm', padL, CANVAS_HEIGHT - 12);
    ctx.fillText('y', padL + width / 2 - 4, CANVAS_HEIGHT - 12);
    ctx.fillText('+4 mm', padL + width - 36, CANVAS_HEIGHT - 12);
    ctx.fillText('I/I₀', 8, padT + 8);
  }, [hits, probeY, slitSep, wavelength, screenDist]);

  useEffect(() => {
    draw();
  }, [draw]);

  const runShot = () => {
    const n = (shotRef.current += 1);
    const y = samplePhotonY(n, slitSep[0], wavelength[0], screenDist[0]);
    setHits((current) => [...current.slice(-511), y]);
  };

  const reset = () => {
    shotRef.current = 0;
    setHits([]);
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-300">
            <Waves className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
              Double-slit bench — Fraunhofer
            </h3>
            <p className="text-xs text-slate-400">
              Local instrument. I/I₀ = cos²(π d sinθ / λ), θ = arctan(y/L).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EpistemicTag kind="established" />
          <Button size="sm" className="bg-violet-600 font-mono text-xs font-bold text-white hover:bg-violet-500" onClick={runShot}>
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            DETECT PHOTON
          </Button>
          <Button size="sm" variant="outline" className="border-slate-700 bg-slate-800 font-mono text-xs text-slate-200" onClick={reset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            RESET
          </Button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Fraunhofer double-slit intensity"
        className="mb-4 block h-auto w-full rounded-lg border border-slate-800 bg-slate-950"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <LabeledSlider label="Wavelength λ" value={wavelength} onChange={setWavelength} min={400} max={800} step={1} display={`${wavelength[0].toFixed(0)} nm`} />
          <LabeledSlider label="Slit separation d" value={slitSep} onChange={setSlitSep} min={20} max={250} step={1} display={`${slitSep[0].toFixed(0)} µm`} />
          <LabeledSlider label="Screen distance L" value={screenDist} onChange={setScreenDist} min={200} max={2000} step={10} display={`${screenDist[0].toFixed(0)} mm`} />
          <LabeledSlider label="Probe y" value={probeY} onChange={setProbeY} min={-Y_MAX_MM} max={Y_MAX_MM} step={0.01} display={`${probeY[0].toFixed(2)} mm`} />
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800">
          <MetricCell label="I/I₀ at probe" value={intensity.toFixed(4)} note="local analytic" />
          <MetricCell label="Photons N" value={String(hits.length)} note="rejection-sampled" />
          <MetricCell label="Local readout" value={typeof local.structured.intensity === 'number' ? local.structured.intensity.toFixed(4) : '—'} note="evaluateInstrument" />
          <MetricCell label="Central max" value={doubleSlitIntensity(0, slitSep[0], wavelength[0], screenDist[0]).toFixed(4)} note="y = 0" />
        </div>
      </div>
    </section>
  );
};

const LabeledSlider: React.FC<{
  label: string;
  value: number[];
  onChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}> = ({ label, value, onChange, min, max, step, display }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="font-mono text-[11px] text-slate-300">{label}</span>
      <span className="font-mono text-[11px] font-bold text-violet-300">{display}</span>
    </div>
    <Slider aria-label={label} value={value} onValueChange={onChange} min={min} max={max} step={step} />
  </div>
);

const MetricCell: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="bg-slate-950 px-3 py-2.5">
    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-mono text-base font-bold text-slate-100">{value}</div>
    <div className="font-mono text-[10px] text-slate-500">{note}</div>
  </div>
);
