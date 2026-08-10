import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  Split,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { epistemic } from '@/lib/epistemics';
import {
  computeDivergenceField,
  computeDivergenceMap,
  sampleTrajectory,
  simulateRealitySplit,
  type RealitySplitParams,
  type SplitMode,
} from '@/lib/realitySplit';
import type { Platform } from '@/lib/platforms';
import { platformPracticalFloor } from '@/lib/platforms';

const W = 1100;
const H = 676;
const PLOT_X0 = 84;
const PLOT_X1 = 1060;
const PLOT_W = PLOT_X1 - PLOT_X0;

const BAND_STD = { top: 44, height: 132 };
const BAND_DIV = { top: 188, height: 232 };
const BAND_MOD = { top: 432, height: 132 };
const BAND_FIELD = { top: 576, height: 74 };

const SITE_A_NORM = -0.55;
const SITE_B_NORM = 0.55;
const FIELD_RANGE = 2.0;

const SIM_DURATION = 12;
const MAP_COLUMNS = 120;
const MAP_GRID = 120;

const ESTABLISHED_COLOR = epistemic('established').canvasColor;
const PROPOSED_COLOR = epistemic('proposed').canvasColor;

const toCanvasX = (normX: number) => PLOT_X0 + ((normX + 1) / 2) * PLOT_W;
const fromCanvasX = (px: number) => ((px - PLOT_X0) / PLOT_W) * 2 - 1;

interface RealitySplitStageProps {
  mode: SplitMode;
  params: RealitySplitParams;
  onParamsChange: (next: Partial<RealitySplitParams>) => void;
  /** Apparatus whose noise floor decides when the split becomes measurable. */
  platform: Platform;
  /** Raised whenever the user reaches a distinguishable regime. */
  onDistinguishable?: (traceDistance: number) => void;
}

type SplitState = 'aligned' | 'diverging' | 'distinguishable';

export const RealitySplitStage: React.FC<RealitySplitStageProps> = ({
  mode,
  params,
  onParamsChange,
  platform,
  onDistinguishable,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>();
  const timeRef = useRef(0);
  const uiTimeRef = useRef(0);
  const lastFrameRef = useRef<number>(0);
  const dragTargetRef = useRef<'phiA' | 'phiB' | null>(null);

  const [isRunning, setIsRunning] = useState(true);
  const [time, setTime] = useState(0);
  const [hoverHandle, setHoverHandle] = useState<'phiA' | 'phiB' | null>(null);

  const noiseFloor = useMemo(() => platformPracticalFloor(platform), [platform]);

  // Both branches propagate from the same |ψ(0)> = |A>. Recomputed only when the
  // physics changes, so scrubbing and playback are free.
  const trajectory = useMemo(
    () => simulateRealitySplit(params, { duration: SIM_DURATION, dt: 0.02, noiseFloor }),
    [params, noiseFloor]
  );

  const divergenceMap = useMemo(
    () => computeDivergenceMap(mode, params, trajectory, MAP_COLUMNS, MAP_GRID),
    [mode, params, trajectory]
  );

  // Rasterize the (x, t) divergence field once per physics change, then blit it
  // each animation frame instead of redrawing ~14k cells at 60 Hz.
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = MAP_GRID;
    off.height = MAP_COLUMNS;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const image = ctx.createImageData(MAP_GRID, MAP_COLUMNS);
    const scale = divergenceMap.maxAbs > 0 ? divergenceMap.maxAbs : 1;

    for (let row = 0; row < MAP_COLUMNS; row += 1) {
      const column = divergenceMap.columns[row];
      for (let col = 0; col < MAP_GRID; col += 1) {
        const value = column[col] / scale;
        const magnitude = Math.min(1, Math.abs(value));
        // Mild perceptual boost: enough that a genuinely small split is still
        // visible, gentle enough that the time structure is not flattened away.
        const weight = Math.pow(magnitude, 0.72);
        const idx = (row * MAP_GRID + col) * 4;

        if (value >= 0) {
          // Excess probability under the PROPOSED MODEL — amber, matching its label.
          image.data[idx] = 245;
          image.data[idx + 1] = 158 - weight * 40;
          image.data[idx + 2] = 11;
        } else {
          // Excess probability under ESTABLISHED PHYSICS — sky, matching its label.
          image.data[idx] = 56;
          image.data[idx + 1] = 189;
          image.data[idx + 2] = 248;
        }
        image.data[idx + 3] = Math.round(weight * 235);
      }
    }

    ctx.putImageData(image, 0, 0);
    heatmapRef.current = off;
  }, [divergenceMap]);

  const currentFrame = useMemo(() => sampleTrajectory(trajectory, time), [trajectory, time]);

  const currentField = useMemo(
    () => computeDivergenceField(mode, params, currentFrame, 220),
    [mode, params, currentFrame]
  );

  const splitState: SplitState = useMemo(() => {
    if (currentFrame.traceDistance <= 1e-9) return 'aligned';
    return currentFrame.traceDistance > noiseFloor ? 'distinguishable' : 'diverging';
  }, [currentFrame.traceDistance, noiseFloor]);

  // Fire only on the transition into a distinguishable regime. Reporting every
  // frame would drive a parent re-render at 60 Hz for no new information.
  const traceDistanceRef = useRef(0);
  traceDistanceRef.current = currentFrame.traceDistance;
  const lastSplitState = useRef<SplitState>('aligned');

  useEffect(() => {
    if (splitState === lastSplitState.current) return;
    lastSplitState.current = splitState;
    if (splitState === 'distinguishable') onDistinguishable?.(traceDistanceRef.current);
  }, [splitState, onDistinguishable]);

  // ---------------------------------------------------------------- rendering

  const drawBandDensity = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      band: { top: number; height: number },
      density: number[],
      ghost: number[],
      color: string,
      peak: number
    ) => {
      const baseline = band.top + band.height;
      const n = density.length;
      const scale = peak > 0 ? (band.height - 14) / peak : 0;

      // Filled primary curve.
      ctx.beginPath();
      ctx.moveTo(PLOT_X0, baseline);
      for (let i = 0; i < n; i += 1) {
        const x = PLOT_X0 + (i / (n - 1)) * PLOT_W;
        ctx.lineTo(x, baseline - density[i] * scale);
      }
      ctx.lineTo(PLOT_X1, baseline);
      ctx.closePath();

      const fill = ctx.createLinearGradient(0, band.top, 0, baseline);
      fill.addColorStop(0, `${color}66`);
      fill.addColorStop(1, `${color}0d`);
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const x = PLOT_X0 + (i / (n - 1)) * PLOT_W;
        const y = baseline - density[i] * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dashed ghost of the competing model, so the split is visible inside
      // each band and not only in the field between them.
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const x = PLOT_X0 + (i / (n - 1)) * PLOT_W;
        const y = baseline - ghost[i] * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.32)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PLOT_X0, baseline);
      ctx.lineTo(PLOT_X1, baseline);
      ctx.stroke();
    },
    []
  );

  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const frame = sampleTrajectory(trajectory, t);
      const field = computeDivergenceField(mode, params, frame, 220);
      const peak = Math.max(
        ...field.rhoStandard,
        ...field.rhoModel,
        Number.EPSILON
      );

      // Backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#04070f');
      bg.addColorStop(0.5, '#060d18');
      bg.addColorStop(1, '#04070f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Shared spatial gridlines tie all three bands to one x-axis.
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i += 1) {
        const x = PLOT_X0 + (i / 8) * PLOT_W;
        ctx.beginPath();
        ctx.moveTo(x, BAND_STD.top - 6);
        ctx.lineTo(x, BAND_FIELD.top + BAND_FIELD.height);
        ctx.stroke();
      }

      // ---- Band 1: ESTABLISHED PHYSICS
      drawBandDensity(ctx, BAND_STD, field.rhoStandard, field.rhoModel, ESTABLISHED_COLOR, peak);

      // ---- Band 2: the divergence field itself
      const heat = heatmapRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.rect(PLOT_X0, BAND_DIV.top, PLOT_W, BAND_DIV.height);
      ctx.clip();
      ctx.fillStyle = 'rgba(2, 6, 14, 0.9)';
      ctx.fillRect(PLOT_X0, BAND_DIV.top, PLOT_W, BAND_DIV.height);
      if (heat) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(heat, PLOT_X0, BAND_DIV.top, PLOT_W, BAND_DIV.height);
      }

      // "NOW" line: scrubbing slides this through the precomputed history.
      const nowY =
        BAND_DIV.top + (Math.min(t, trajectory.duration) / trajectory.duration) * BAND_DIV.height;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(PLOT_X0, nowY);
      ctx.lineTo(PLOT_X1, nowY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(PLOT_X0, BAND_DIV.top, PLOT_W, BAND_DIV.height);

      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.font = '600 10px ui-monospace, JetBrains Mono, monospace';
      ctx.fillText('NOW', PLOT_X1 - 34, nowY - 5);

      // Live signed profile of the divergence, drawn as a perturbation of the
      // NOW line itself rather than at a fixed height — so it reads as "the
      // current shape of the disagreement" instead of a second time marker.
      const sliceScale =
        divergenceMap.maxAbs > 0 ? (BAND_DIV.height / 5) / divergenceMap.maxAbs : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(PLOT_X0, BAND_DIV.top, PLOT_W, BAND_DIV.height);
      ctx.clip();
      ctx.beginPath();
      for (let i = 0; i < field.divergence.length; i += 1) {
        const x = PLOT_X0 + (i / (field.divergence.length - 1)) * PLOT_W;
        const y = nowY - field.divergence[i] * sliceScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // ---- Band 3: PROPOSED MODEL
      drawBandDensity(ctx, BAND_MOD, field.rhoModel, field.rhoStandard, PROPOSED_COLOR, peak);

      // ---- Band 4: the scalar field, directly manipulable
      const fieldBase = BAND_FIELD.top + BAND_FIELD.height / 2;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(PLOT_X0, fieldBase);
      ctx.lineTo(PLOT_X1, fieldBase);
      ctx.stroke();
      ctx.setLineDash([]);

      const fieldY = (phi: number) =>
        fieldBase - (phi / FIELD_RANGE) * (BAND_FIELD.height / 2 - 8);
      const handleAX = toCanvasX(SITE_A_NORM);
      const handleBX = toCanvasX(SITE_B_NORM);
      const yA = fieldY(params.phiA);
      const yB = fieldY(params.phiB);

      ctx.beginPath();
      ctx.moveTo(PLOT_X0, yA);
      ctx.lineTo(handleAX, yA);
      ctx.lineTo(handleBX, yB);
      ctx.lineTo(PLOT_X1, yB);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const drawHandle = (x: number, y: number, key: 'phiA' | 'phiB', label: string) => {
        const active = dragTargetRef.current === key || hoverHandle === key;
        ctx.beginPath();
        ctx.arc(x, y, active ? 11 : 8, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#c4b5fd' : '#a78bfa';
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = active ? 18 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
        ctx.font = '600 10px ui-monospace, JetBrains Mono, monospace';
        ctx.fillText(label, x - 16, y - 16);
      };
      drawHandle(handleAX, yA, 'phiA', `φA ${params.phiA.toFixed(2)}`);
      drawHandle(handleBX, yB, 'phiB', `φB ${params.phiB.toFixed(2)}`);

      // ---- Axis furniture
      ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.font = '500 10px ui-monospace, JetBrains Mono, monospace';
      ctx.fillText('t = 0', PLOT_X0 - 62, BAND_DIV.top + 10);
      ctx.fillText(`t = ${trajectory.duration.toFixed(0)}`, PLOT_X0 - 62, BAND_DIV.top + BAND_DIV.height);
      ctx.fillText('ρ(x)', PLOT_X0 - 62, BAND_STD.top + 14);
      ctx.fillText('ρ(x)', PLOT_X0 - 62, BAND_MOD.top + 14);
      ctx.fillText('φ(x)', PLOT_X0 - 62, BAND_FIELD.top + 16);
      ctx.fillText('drag ↕', PLOT_X0 - 62, BAND_FIELD.top + 30);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.fillText('SITE A', handleAX - 20, BAND_FIELD.top + BAND_FIELD.height + 18);
      ctx.fillText('SITE B', handleBX - 20, BAND_FIELD.top + BAND_FIELD.height + 18);

      // Alignment banner: the moment before the split.
      if (frame.traceDistance <= 1e-9) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.5)';
        ctx.font = '700 13px ui-monospace, JetBrains Mono, monospace';
        ctx.fillText(
          'PREDICTIONS IDENTICAL — RAISE THE COUPLING g TO SPLIT REALITY',
          PLOT_X0 + PLOT_W / 2 - 220,
          BAND_DIV.top + BAND_DIV.height / 2
        );
      }
    },
    [divergenceMap.maxAbs, drawBandDensity, hoverHandle, mode, params, trajectory]
  );

  useEffect(() => {
    const tick = (timestamp: number) => {
      const last = lastFrameRef.current || timestamp;
      const deltaSeconds = Math.min((timestamp - last) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      if (isRunning) {
        timeRef.current += deltaSeconds;
        if (timeRef.current > trajectory.duration) timeRef.current = 0;
        // The canvas follows timeRef at full frame rate; React state is updated
        // ~12 Hz so the DOM readouts stay live without re-rendering every frame.
        if (Math.abs(timeRef.current - uiTimeRef.current) > 0.08) {
          uiTimeRef.current = timeRef.current;
          setTime(timeRef.current);
        }
      }
      draw(timeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
  }, [draw, isRunning, trajectory.duration]);

  // ------------------------------------------------------------- interaction

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const hitTestHandle = (x: number, y: number): 'phiA' | 'phiB' | null => {
    if (y < BAND_FIELD.top - 18 || y > BAND_FIELD.top + BAND_FIELD.height + 18) return null;
    const fieldBase = BAND_FIELD.top + BAND_FIELD.height / 2;
    const yFor = (phi: number) => fieldBase - (phi / FIELD_RANGE) * (BAND_FIELD.height / 2 - 8);
    const dA = Math.hypot(x - toCanvasX(SITE_A_NORM), y - yFor(params.phiA));
    const dB = Math.hypot(x - toCanvasX(SITE_B_NORM), y - yFor(params.phiB));
    if (dA < 26 && dA <= dB) return 'phiA';
    if (dB < 26) return 'phiB';
    return null;
  };

  const phiFromY = (y: number) => {
    const fieldBase = BAND_FIELD.top + BAND_FIELD.height / 2;
    const raw = ((fieldBase - y) / (BAND_FIELD.height / 2 - 8)) * FIELD_RANGE;
    return Math.max(-FIELD_RANGE, Math.min(FIELD_RANGE, Number(raw.toFixed(2))));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasPoint(event);
    const hit = hitTestHandle(x, y);
    if (hit) {
      dragTargetRef.current = hit;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    // Clicking inside the divergence field scrubs straight to that instant.
    if (y >= BAND_DIV.top && y <= BAND_DIV.top + BAND_DIV.height && x >= PLOT_X0 && x <= PLOT_X1) {
      const fraction = (y - BAND_DIV.top) / BAND_DIV.height;
      const target = fraction * trajectory.duration;
      timeRef.current = target;
      setTime(target);
      setIsRunning(false);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasPoint(event);
    if (!dragTargetRef.current) {
      setHoverHandle(hitTestHandle(x, y));
      return;
    }
    onParamsChange({ [dragTargetRef.current]: phiFromY(y) } as Partial<RealitySplitParams>);
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragTargetRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragTargetRef.current = null;
  };

  const scrubTo = (value: number) => {
    timeRef.current = value;
    uiTimeRef.current = value;
    setTime(value);
  };

  const alignRealities = () => {
    onParamsChange({ g: 0 });
    scrubTo(0);
    setIsRunning(true);
  };

  // ------------------------------------------------------------------- chrome

  const stateStyles: Record<SplitState, { label: string; className: string; detail: string }> = {
    aligned: {
      label: 'REALITIES ALIGNED',
      className: 'border-slate-600/60 bg-slate-800/60 text-slate-300',
      detail: 'Both models predict the same thing. Nothing here can distinguish them.',
    },
    diverging: {
      label: 'DIVERGING — BELOW NOISE FLOOR',
      className: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
      detail: `The models disagree, but by less than ${platform.label} can resolve (${noiseFloor.toExponential(1)}).`,
    },
    distinguishable: {
      label: 'EXPERIMENTALLY DISTINGUISHABLE',
      className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
      detail: `The separation exceeds the ${platform.label} noise floor — this regime can be tested.`,
    },
  };
  const state = stateStyles[splitState];
  const significance = noiseFloor > 0 ? currentFrame.traceDistance / noiseFloor : 0;

  return (
    <section
      id="reality-split"
      className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/95 shadow-2xl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            <Split className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-[0.16em] text-slate-100">
              Reality Split
            </h2>
            <p className="text-xs text-slate-400">
              Both models evolve from the same |ψ(0)⟩ = |A⟩. Every difference below is caused by the
              coupling g alone.
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold ${state.className}`}
        >
          <Crosshair className="h-3.5 w-3.5" />
          {state.label}
        </div>
      </div>

      {/* Stage */}
      <div className="relative bg-[#04070f]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          aria-label="Reality Split: established physics and the proposed model evolving side by side, with their live divergence field between them"
          className={`block h-auto w-full touch-none select-none ${
            hoverHandle ? 'cursor-grab' : 'cursor-crosshair'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(event) => {
            setHoverHandle(null);
            endDrag(event);
          }}
        />

        {/* Band labels — real epistemic tags, positioned over the canvas bands. */}
        <div
          className="pointer-events-none absolute left-[7.6%] flex items-center gap-2"
          style={{ top: `${(BAND_STD.top / H) * 100 - 4.6}%` }}
        >
          <EpistemicTag kind="established" />
          <span className="font-mono text-[10px] text-slate-400">
            Standard QM · P_B = {currentFrame.standard.PB.toFixed(4)}
          </span>
        </div>

        <div
          className="pointer-events-none absolute left-[7.6%] flex items-center gap-2"
          style={{ top: `${(BAND_DIV.top / H) * 100 - 3.4}%` }}
        >
          <EpistemicTag kind="prediction" />
          <span className="font-mono text-[10px] text-slate-400">
            Divergence field ρ_model(x,t) − ρ_standard(x,t) · ∫|Δρ|dx ={' '}
            {currentField.l1.toExponential(2)}
          </span>
        </div>

        <div
          className="pointer-events-none absolute left-[7.6%] flex items-center gap-2"
          style={{ top: `${(BAND_MOD.top / H) * 100 - 4.6}%` }}
        >
          <EpistemicTag kind="proposed" />
          <span className="font-mono text-[10px] text-slate-400">
            Woodyard (2026) · P_B = {currentFrame.model.PB.toFixed(4)}
          </span>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <div className="rounded-md border border-slate-700 bg-slate-950/90 px-2.5 py-1 font-mono text-[10px] text-slate-300 backdrop-blur">
            <span className="text-slate-500">D(t) = ½Σ|p−q|</span>{' '}
            <span className="font-bold text-white">{currentFrame.traceDistance.toExponential(3)}</span>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-950/90 px-2.5 py-1 font-mono text-[10px] text-slate-300 backdrop-blur">
            <span className="text-slate-500">vs {platform.label} floor</span>{' '}
            <span
              className={`font-bold ${significance >= 1 ? 'text-emerald-300' : 'text-amber-300'}`}
            >
              {significance.toFixed(2)}×
            </span>
          </div>
        </div>

        {/* Centred so it sits between the SITE A / SITE B labels rather than over them. */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 font-mono text-[10px] text-violet-200 backdrop-blur">
          <Hand className="h-3 w-3" />
          Drag φA / φB handles · click the field to scrub
        </div>
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 bg-slate-900/50 px-4 py-3 sm:px-5">
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700 bg-slate-800/80 font-mono text-xs text-slate-200 hover:bg-slate-700"
          onClick={() => setIsRunning((value) => !value)}
        >
          {isRunning ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
          {isRunning ? 'PAUSE' : 'PLAY'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700 bg-slate-800/80 font-mono text-xs text-slate-200 hover:bg-slate-700"
          onClick={() => scrubTo(0)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          t = 0
        </Button>

        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Scrub</span>
          <Slider
            aria-label="Scrub simulation time"
            value={[time]}
            onValueChange={([value]) => {
              setIsRunning(false);
              scrubTo(value);
            }}
            min={0}
            max={trajectory.duration}
            step={0.01}
          />
          <span className="w-14 shrink-0 text-right font-mono text-xs text-cyan-300">
            {time.toFixed(2)}
          </span>
        </div>

        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
            <Zap className="h-3 w-3" /> Coupling g
          </span>
          <Slider
            aria-label="Matter-scalar coupling g"
            value={[params.g]}
            onValueChange={([value]) => onParamsChange({ g: value })}
            min={0}
            max={3}
            step={0.01}
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-amber-300">
            {params.g.toFixed(2)}
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="border-slate-600 bg-slate-800/80 font-mono text-xs text-slate-200 hover:bg-slate-700"
          onClick={alignRealities}
          title="Set g = 0 so both models predict identically, then raise g to watch them split"
        >
          <Ruler className="mr-1.5 h-3.5 w-3.5" />
          ALIGN (g = 0)
        </Button>
      </div>

      {/* Readout strip */}
      <div className="grid gap-px border-t border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
        <ReadoutCell
          label="Peak divergence over window"
          value={trajectory.maxDivergence.toExponential(3)}
          sub={`at t = ${trajectory.maxDivergenceTime.toFixed(2)}`}
          kind="prediction"
        />
        <ReadoutCell
          label="Time-averaged divergence"
          value={trajectory.meanDivergence.toExponential(3)}
          sub="target for integrated measurements"
          kind="prediction"
        />
        <ReadoutCell
          label={`First resolvable by ${platform.label}`}
          value={
            trajectory.firstDetectableTime === null
              ? 'never in window'
              : `t = ${trajectory.firstDetectableTime.toFixed(2)}`
          }
          sub={`floor ${noiseFloor.toExponential(1)}`}
          kind="prediction"
        />
        <ReadoutCell
          label="Norm check (both branches)"
          value={`${currentFrame.standard.norm.toFixed(6)} / ${currentFrame.model.norm.toFixed(6)}`}
          sub="unitarity preserved, not enforced"
          kind="established"
        />
      </div>

      <p className="border-t border-slate-800 bg-slate-950 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500 sm:px-5">
        {state.detail} The amber regions of the field are where the proposed model puts more
        probability than standard quantum mechanics; the sky regions are where it puts less. The
        field integrates to zero everywhere — probability is redistributed, never created.
      </p>
    </section>
  );
};

interface ReadoutCellProps {
  label: string;
  value: string;
  sub: string;
  kind: 'established' | 'prediction';
}

const ReadoutCell: React.FC<ReadoutCellProps> = ({ label, value, sub, kind }) => (
  <div className="bg-slate-950 px-4 py-3">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      <EpistemicTag kind={kind} short hideIcon />
    </div>
    <p className="mt-1 font-mono text-sm font-bold text-slate-100">{value}</p>
    <p className="font-mono text-[10px] text-slate-500">{sub}</p>
  </div>
);
