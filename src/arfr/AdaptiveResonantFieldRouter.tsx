import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  Gauge,
  GitBranch,
  Lock,
  Network,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  Split,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  BUILT_IN_EXPERIMENTS,
  buildResonantFieldNetwork,
  createARFRPassport,
  createDefaultARFRConfig,
  createSimulation,
  queueDisturbance,
  routePosition,
  runEnergyProfileComparison,
  stepSimulation,
  summarizeExperiment,
} from './index';
import type {
  ARFRConfigOverrides,
  ARFRMode,
  ARFRState,
  BuiltInExperiment,
  EnergyComparisonRow,
  EnergyProfile,
  LockState,
  PocketShape,
  RouteDefinition,
  RouteKind,
  Vec3,
} from './index';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const MODE_OPTIONS: Array<{ id: ARFRMode; label: string; icon: React.ElementType }> = [
  { id: 'hold', label: 'HOLD', icon: Lock },
  { id: 'route', label: 'ROUTE', icon: Target },
  { id: 'conveyor', label: 'CONVEYOR', icon: Waves },
  { id: 'orbit', label: 'ORBIT', icon: RotateCw },
  { id: 'split', label: 'SPLIT', icon: Split },
  { id: 'merge', label: 'MERGE', icon: Network },
];

const ROUTE_OPTIONS: Array<{ id: RouteKind; label: string }> = [
  { id: 'LINE', label: 'LINE A → B' },
  { id: 'ARC', label: 'ARC' },
  { id: 'CIRCLE', label: 'CIRCLE' },
  { id: 'FIGURE_EIGHT', label: 'FIGURE EIGHT' },
  { id: 'HELIX', label: 'HELIX' },
  { id: 'USER_WAYPOINTS', label: 'USER WAYPOINTS' },
];

const PROFILE_OPTIONS: Array<{ id: EnergyProfile; label: string; detail: string }> = [
  { id: 'precision', label: 'PRECISION', detail: 'tight positional lock' },
  { id: 'balanced', label: 'BALANCED', detail: 'accuracy × effort' },
  { id: 'low_energy', label: 'LOW ENERGY', detail: 'accepts more error' },
  { id: 'max_confinement', label: 'MAX CONFINEMENT', detail: 'occupancy first' },
];

const SHAPE_OPTIONS: PocketShape[] = ['sphere', 'ellipsoid', 'ring', 'two_lobe'];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function formatValue(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)
    ? value.toExponential(2)
    : value.toFixed(digits);
}

function routeForKind(kind: RouteKind): Partial<RouteDefinition> {
  if (kind === 'ARC') {
    return { kind, center: { x: 0, y: 0, z: 0 }, radius: 0.92, startAngle: Math.PI, endAngle: 0 };
  }
  if (kind === 'CIRCLE') {
    return { kind, center: { x: 0, y: 0, z: 0 }, radius: 0.82, startAngle: 0, turns: 1 };
  }
  if (kind === 'FIGURE_EIGHT') {
    return { kind, center: { x: 0, y: 0, z: 0 }, radius: 1.0, startAngle: 0, turns: 1 };
  }
  if (kind === 'HELIX') {
    return { kind, center: { x: 0, y: 0, z: 0 }, radius: 0.82, start: { x: 0, y: 0, z: -0.55 }, end: { x: 0, y: 0, z: 0.55 }, turns: 1.5 };
  }
  if (kind === 'USER_WAYPOINTS') {
    return {
      kind,
      waypoints: [
        { x: -1.05, y: -0.55, z: -0.25 },
        { x: -0.25, y: 0.55, z: 0.15 },
        { x: 0.45, y: -0.35, z: 0.4 },
        { x: 1.05, y: 0.2, z: 0 },
      ],
    };
  }
  return { kind: 'LINE', start: { x: -1.05, y: 0, z: 0 }, end: { x: 1.05, y: 0, z: 0 } };
}

function projectPoint(point: Vec3, state: ARFRState): { x: number; y: number; depth: number } {
  const { min, max } = state.config.bounds;
  const nx = (point.x - min.x) / Math.max(max.x - min.x, 0.01) - 0.5;
  const ny = (point.y - min.y) / Math.max(max.y - min.y, 0.01) - 0.5;
  const nz = (point.z - min.z) / Math.max(max.z - min.z, 0.01) - 0.5;
  return {
    x: CANVAS_WIDTH * 0.5 + nx * CANVAS_WIDTH * 0.82 + nz * 82,
    y: CANVAS_HEIGHT * 0.56 - ny * CANVAS_HEIGHT * 0.78 - nz * 56,
    depth: nz,
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width = 1): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(angle - 0.45) * 7, to.y - Math.sin(angle - 0.45) * 7);
  ctx.lineTo(to.x - Math.cos(angle + 0.45) * 7, to.y - Math.sin(angle + 0.45) * 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

interface ARFRCanvasProps {
  state: ARFRState;
}

const ARFRCanvas: React.FC<ARFRCanvasProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const background = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    background.addColorStop(0, '#081018');
    background.addColorStop(0.48, '#0a1823');
    background.addColorStop(1, '#10131c');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Instrument grid, rendered in the same projected frame as the field volume.
    ctx.save();
    ctx.strokeStyle = 'rgba(122, 171, 191, 0.11)';
    ctx.lineWidth = 1;
    for (let x = 50; x < CANVAS_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 84);
      ctx.lineTo(x, CANVAS_HEIGHT - 52);
      ctx.stroke();
    }
    for (let y = 92; y < CANVAS_HEIGHT - 40; y += 52) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(CANVAS_WIDTH - 24, y);
      ctx.stroke();
    }
    ctx.restore();

    // Projected isopotential volume. The voxels are the sampled field, not a
    // decorative glow: high-potential cells are visibly rendered as a volume.
    const { resolution, potential, vectors } = state.field;
    for (let z = 0; z < resolution.z; z += 1) {
      for (let y = 0; y < resolution.y; y += 1) {
        for (let x = 0; x < resolution.x; x += 1) {
          const index = x + resolution.x * (y + resolution.y * z);
          const value = potential[index];
          if (value < state.config.threshold * 0.28) continue;
          const point = {
            x: state.field.bounds.min.x + (state.field.bounds.max.x - state.field.bounds.min.x) * (x / Math.max(1, resolution.x - 1)),
            y: state.field.bounds.min.y + (state.field.bounds.max.y - state.field.bounds.min.y) * (y / Math.max(1, resolution.y - 1)),
            z: state.field.bounds.min.z + (state.field.bounds.max.z - state.field.bounds.min.z) * (z / Math.max(1, resolution.z - 1)),
          };
          const screen = projectPoint(point, state);
          const alpha = 0.04 + clamp01(value) * 0.22;
          const size = 14 + value * 16;
          ctx.fillStyle = `rgba(27, 214, 223, ${alpha.toFixed(3)})`;
          ctx.fillRect(screen.x - size / 2, screen.y - size / 2, size, size);
          if (value > state.config.threshold) {
            ctx.strokeStyle = `rgba(97, 245, 239, ${(0.08 + value * 0.2).toFixed(3)})`;
            ctx.strokeRect(screen.x - size / 2, screen.y - size / 2, size, size);
          }
          if (z === Math.floor(resolution.z / 2) && (x + y) % 3 === 0 && value > state.config.threshold * 0.45) {
            const vector = {
              x: vectors[index * 3],
              y: vectors[index * 3 + 1],
              z: vectors[index * 3 + 2],
            };
            const destination = projectPoint(addVecForCanvas(point, vector, 0.12), state);
            drawArrow(ctx, screen, destination, 'rgba(113, 236, 244, 0.42)', 1);
          }
        }
      }
    }

    // Planned route and measured pocket trajectory are intentionally separate.
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(251, 113, 202, 0.72)';
    ctx.beginPath();
    for (let index = 0; index <= 52; index += 1) {
      const point = routePosition(state.config.route, (index / 52) * state.config.duration);
      const screen = projectPoint(point, state);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (state.pocketPath.length > 1) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#35e5d1';
      ctx.beginPath();
      state.pocketPath.forEach((point, index) => {
        const screen = projectPoint(point, state);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.stroke();
    }
    ctx.restore();

    // Energy flow is derived from source-to-pocket relationships; source
    // geometry itself is drawn below in amber and never follows the target.
    const targetScreen = projectPoint(state.primaryPocket?.centroid ?? state.desiredTarget, state);
    state.sources.forEach((source) => {
      const sourceScreen = projectPoint(source.position, state);
      drawArrow(ctx, sourceScreen, targetScreen, 'rgba(255, 190, 92, 0.25)', 1);
    });

    // Particle trails are generated by the particle integrator.
    state.particleTrails.forEach((trail, trailIndex) => {
      if (trail.length < 2) return;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(191, 219, 254, ${(0.14 + trailIndex * 0.01).toFixed(3)})`;
      ctx.beginPath();
      trail.forEach((point, index) => {
        const screen = projectPoint(point, state);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.stroke();
      ctx.restore();
    });
    for (let index = 0; index < state.particles.count; index += 1) {
      if (state.particles.alive[index] === 0) continue;
      const offset = index * 3;
      const point = { x: state.particles.position[offset], y: state.particles.position[offset + 1], z: state.particles.position[offset + 2] };
      const screen = projectPoint(point, state);
      const potentialValue = state.particles.localPotential[index];
      ctx.fillStyle = potentialValue >= state.config.threshold * 0.55 ? '#d6fff9' : 'rgba(148, 163, 184, 0.48)';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, potentialValue >= state.config.threshold * 0.55 ? 3 : 2, 0, TAU_CANVAS);
      ctx.fill();
    }

    // Emergent pocket boundaries.
    state.pockets.forEach((pocket, index) => {
      const screen = projectPoint(pocket.centroid, state);
      const radius = Math.max(12, pocket.radius * 86);
      ctx.save();
      ctx.strokeStyle = index === 0 ? '#35e5d1' : '#d18cff';
      ctx.fillStyle = index === 0 ? 'rgba(53, 229, 209, 0.08)' : 'rgba(209, 140, 255, 0.08)';
      ctx.lineWidth = index === 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, radius * (pocket.shape === 'ellipsoid' ? 1.45 : 1), radius * 0.78, 0, 0, TAU_CANVAS);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Target marker.
    const desiredScreen = projectPoint(state.desiredTarget, state);
    ctx.save();
    ctx.strokeStyle = '#fb71ca';
    ctx.fillStyle = '#fb71ca';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(desiredScreen.x - 12, desiredScreen.y);
    ctx.lineTo(desiredScreen.x + 12, desiredScreen.y);
    ctx.moveTo(desiredScreen.x, desiredScreen.y - 12);
    ctx.lineTo(desiredScreen.x, desiredScreen.y + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(desiredScreen.x, desiredScreen.y, 5, 0, TAU_CANVAS);
    ctx.stroke();
    ctx.restore();

    // Fixed source geometry.
    state.initialSourcePositions.forEach((position, index) => {
      const source = state.sources[index];
      const screen = projectPoint(position, state);
      const orientation = source?.orientation ?? { x: 0, y: 0, z: 1 };
      const end = projectPoint(addVecForCanvas(position, orientation, 0.28), state);
      ctx.save();
      ctx.fillStyle = '#ffbe5c';
      ctx.strokeStyle = '#ffbe5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 9);
      ctx.lineTo(screen.x + 9, screen.y);
      ctx.lineTo(screen.x, screen.y + 9);
      ctx.lineTo(screen.x - 9, screen.y);
      ctx.closePath();
      ctx.fill();
      drawArrow(ctx, screen, end, '#ffe6ad', 1.5);
      ctx.font = '700 12px JetBrains Mono, monospace';
      ctx.fillText(`S${index + 1}`, screen.x + 12, screen.y - 10);
      ctx.restore();
    });

    // Instrument labels make the source/emergence distinction explicit.
    ctx.save();
    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = '#ffbe5c';
    ctx.fillText('HARDWARE / SOURCE GEOMETRY — FIXED POSITIONS', 26, 32);
    ctx.fillStyle = '#35e5d1';
    ctx.fillText('EMERGENT RESONANCE GEOMETRY — SAMPLED FIELD', 26, 53);
    ctx.fillStyle = '#fb71ca';
    ctx.fillText(`TARGET  ${formatValue(state.desiredTarget.x, 2)}  ${formatValue(state.desiredTarget.y, 2)}  ${formatValue(state.desiredTarget.z, 2)}`, CANVAS_WIDTH - 350, 32);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`t = ${state.time.toFixed(2)} s  ·  step ${state.step}`, CANVAS_WIDTH - 270, CANVAS_HEIGHT - 20);
    ctx.restore();
  }, [state]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label="Projected three-dimensional Adaptive Resonant Field Router field volume" className="block h-auto w-full" />;
};

function addVecForCanvas(point: Vec3, direction: Vec3, scale: number): Vec3 {
  return { x: point.x + direction.x * scale, y: point.y + direction.y * scale, z: point.z + direction.z * scale };
}

const TAU_CANVAS = Math.PI * 2;

interface MetricProps {
  label: string;
  value: string;
  tone?: 'cyan' | 'pink' | 'amber' | 'violet';
}

const MetricReadout: React.FC<MetricProps> = ({ label, value, tone = 'cyan' }) => (
  <div className="border border-slate-800 bg-slate-950/75 p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={`h-1.5 w-1.5 ${tone === 'pink' ? 'bg-pink-400' : tone === 'amber' ? 'bg-amber-300' : tone === 'violet' ? 'bg-violet-300' : 'bg-cyan-300'}`} />
    </div>
    <p className="mt-2 font-mono text-lg font-bold text-slate-100">{value}</p>
  </div>
);

export const AdaptiveResonantFieldRouter: React.FC = () => {
  const [mode, setMode] = useState<ARFRMode>('route');
  const [routeKind, setRouteKind] = useState<RouteKind>('LINE');
  const [shape, setShape] = useState<PocketShape>('sphere');
  const [energyProfile, setEnergyProfile] = useState<EnergyProfile>('balanced');
  const [threshold, setThreshold] = useState(0.31);
  const [running, setRunning] = useState(true);
  const [benchmarkRows, setBenchmarkRows] = useState<EnergyComparisonRow[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const initialState = useMemo(() => createSimulation(createDefaultARFRConfig()), []);
  const stateRef = useRef<ARFRState>(initialState);
  const [state, setState] = useState<ARFRState>(initialState);

  const makeConfig = useCallback(
    (overrides: ARFRConfigOverrides = {}) =>
      createDefaultARFRConfig({
        mode,
        shape,
        energyProfile,
        threshold,
        route: routeForKind(routeKind),
        ...overrides,
      }),
    [energyProfile, mode, routeKind, shape, threshold]
  );

  const restart = useCallback(
    (overrides: ARFRConfigOverrides = {}) => {
      const next = createSimulation(makeConfig(overrides));
      stateRef.current = next;
      setState(next);
      setBenchmarkRows([]);
    },
    [makeConfig]
  );

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const next = stepSimulation(stateRef.current);
      stateRef.current = next;
      setState(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const updateLiveState = useCallback((update: (current: ARFRState) => ARFRState) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const selectMode = useCallback((nextMode: ARFRMode) => {
    setMode(nextMode);
    if (nextMode === 'orbit') {
      setRouteKind('CIRCLE');
      restart({ mode: nextMode, route: routeForKind('CIRCLE') });
    } else {
      restart({ mode: nextMode });
    }
  }, [restart]);

  const selectRoute = useCallback((nextRoute: RouteKind) => {
    setRouteKind(nextRoute);
    restart({ route: routeForKind(nextRoute) });
  }, [restart]);

  const selectShape = useCallback((nextShape: PocketShape) => {
    setShape(nextShape);
    restart({ shape: nextShape });
  }, [restart]);

  const selectProfile = useCallback((nextProfile: EnergyProfile) => {
    setEnergyProfile(nextProfile);
    restart({ energyProfile: nextProfile });
  }, [restart]);

  const disturb = useCallback(() => {
    const next = queueDisturbance(stateRef.current, {
      kind: 'velocity_impulse',
      magnitude: 0.72,
      direction: { x: 1, y: 0.35, z: 0 },
    });
    stateRef.current = next;
    setState(next);
  }, []);

  const reset = useCallback(() => restart(), [restart]);

  const adjustThreshold = useCallback((value: number) => {
    setThreshold(value);
    updateLiveState((current) => ({ ...current, config: { ...current.config, threshold: value } }));
  }, [updateLiveState]);

  const adjustSourceParameter = useCallback((key: 'amplitude' | 'frequency' | 'rotationRate' | 'polarization', value: number) => {
    updateLiveState((current) => {
      const sources = current.sources.map((source, index) => {
        if (key === 'amplitude') return { ...source, amplitude: value };
        if (key === 'frequency') return { ...source, frequency: value };
        if (key === 'polarization') return { ...source, polarization: value };
        return { ...source, angularVelocity: (index % 2 === 0 ? 1 : -1) * value };
      });
      return { ...current, sources, config: { ...current.config, sources: sources.map((source) => ({ ...source })) } };
    });
  }, [updateLiveState]);

  const selectExperiment = useCallback((experiment: BuiltInExperiment) => {
    const mapping: Record<BuiltInExperiment, { mode: ARFRMode; shape: PocketShape; route: RouteKind }> = {
      static_pocket: { mode: 'hold', shape: 'sphere', route: 'LINE' },
      translation: { mode: 'route', shape: 'sphere', route: 'LINE' },
      circular_routing: { mode: 'orbit', shape: 'sphere', route: 'CIRCLE' },
      disturbance_recovery: { mode: 'hold', shape: 'sphere', route: 'LINE' },
      energy_optimization: { mode: 'route', shape: 'sphere', route: 'LINE' },
      split: { mode: 'split', shape: 'two_lobe', route: 'LINE' },
      merge: { mode: 'merge', shape: 'two_lobe', route: 'LINE' },
    };
    const selection = mapping[experiment];
    setMode(selection.mode);
    setShape(selection.shape);
    setRouteKind(selection.route);
    restart({ mode: selection.mode, shape: selection.shape, route: routeForKind(selection.route) });
    if (experiment === 'disturbance_recovery') {
      window.setTimeout(() => disturb(), 700);
    }
  }, [disturb, restart]);

  const runBenchmark = useCallback(() => {
    setIsBenchmarking(true);
    window.setTimeout(() => {
      const rows = runEnergyProfileComparison(stateRef.current.config.seed, 120);
      setBenchmarkRows(rows);
      setIsBenchmarking(false);
    }, 20);
  }, []);

  const exportPassport = useCallback(async () => {
    setIsExporting(true);
    try {
      const summary = summarizeExperiment(
        stateRef.current,
        stateRef.current.metrics.positionError,
        stateRef.current.controller.lockQuality
      );
      const passport = await createARFRPassport({ experiment: 'interactive_session', state: stateRef.current, summary });
      const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `arfr-passport-${passport.integrity.identityHash.slice(0, 12)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const network = useMemo(() => buildResonantFieldNetwork(state.pockets), [state.pockets]);
  const averageFrequency = state.sources.reduce((sum, source) => sum + source.frequency, 0) / Math.max(1, state.sources.length);
  const rotationRate = Math.abs(state.sources[0]?.angularVelocity ?? 0);
  const totalEnergy = state.energy.fieldInput + state.energy.controlInput + state.energy.estimatedDissipation;

  return (
    <main className="min-h-screen bg-[#071019] text-slate-100">
      <section className="mx-auto max-w-[1800px] px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-cyan-300/20 pb-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">Vers3Dynamics · numerical research instrument</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-extrabold uppercase leading-[0.92] tracking-[-0.04em] text-white sm:text-6xl">
              Adaptive Resonant<br /><span className="text-cyan-300">Field Router</span>
            </h1>
            <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-slate-400">
              A bounded simulation of field-defined transport. The sources remain spatially fixed while phase, frequency, amplitude, and rotation are retuned in a closed loop.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
            <Badge className="rounded-none border border-amber-300/40 bg-amber-300/10 text-amber-200">SIMULATION ONLY</Badge>
            <Badge className="rounded-none border border-amber-300/40 bg-amber-300/10 text-amber-200">SOURCES LOCKED</Badge>
            <Badge className="rounded-none border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">FIELD SYNTHESIS ACTIVE</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden border border-slate-700 bg-[#0b1621] shadow-[0_0_45px_rgba(34,211,238,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950/60 px-4 py-3">
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="h-2 w-2 animate-pulse bg-cyan-300" />
                <span className="font-bold uppercase tracking-[0.18em] text-cyan-200">ARFR field workspace</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{state.config.sourceArrangement} / {state.config.fieldResolution.x}×{state.config.fieldResolution.y}×{state.config.fieldResolution.z} volume</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">lock</span>
                <span className={`font-mono text-xs font-bold ${lockColor(state.controller.lockState)}`}>{state.controller.lockState}</span>
              </div>
            </div>
            <ARFRCanvas state={state} />
          </section>

          <aside className="space-y-4">
            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={Activity} eyebrow="Control state" title="Target lock" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MetricReadout label="position error" value={formatValue(state.metrics.positionError)} tone="pink" />
                <MetricReadout label="lock quality" value={`${(state.controller.lockQuality * 100).toFixed(1)}%`} />
                <MetricReadout label="coherence" value={`${(state.controller.coherence * 100).toFixed(1)}%`} />
                <MetricReadout label="occupancy" value={`${(state.metrics.occupancy * 100).toFixed(1)}%`} tone="violet" />
              </div>
              <div className="mt-3 h-1.5 bg-slate-800"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${state.controller.lockQuality * 100}%` }} /></div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-500">Target = geometry + trajectory + resonance state. Controller effort is penalized by the selected energy profile.</p>
            </section>

            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={Waves} eyebrow="Stationary source array" title="Relative field parameters" />
              <div className="mt-4 space-y-4">
                <ParameterSlider label="frequency" value={averageFrequency} min={0.4} max={2.4} step={0.01} onChange={(value) => adjustSourceParameter('frequency', value)} suffix="ω" />
                <ParameterSlider label="amplitude" value={state.sources[0]?.amplitude ?? 1} min={0.2} max={1.8} step={0.01} onChange={(value) => adjustSourceParameter('amplitude', value)} suffix="a.u." />
                <ParameterSlider label="counter-rotation rate" value={rotationRate} min={0} max={2} step={0.01} onChange={(value) => adjustSourceParameter('rotationRate', value)} suffix="rad/s" />
                <ParameterSlider label="polarization angle" value={state.sources[0]?.polarization ?? 0} min={-1.57} max={1.57} step={0.01} onChange={(value) => adjustSourceParameter('polarization', value)} suffix="rad" />
                <ParameterSlider label="resonance threshold" value={threshold} min={0.12} max={0.62} step={0.01} onChange={adjustThreshold} suffix="R" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] text-slate-400">
                <div className="border border-amber-300/20 bg-amber-300/[0.05] p-2"><span className="text-amber-200">4</span> sources</div>
                <div className="border border-amber-300/20 bg-amber-300/[0.05] p-2"><span className="text-amber-200">0</span> position updates</div>
              </div>
            </section>

            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={Target} eyebrow="Target trajectory" title="Route geometry" />
              <select value={routeKind} onChange={(event) => selectRoute(event.target.value as RouteKind)} className="mt-4 w-full border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-[11px] uppercase text-slate-200 outline-none focus:border-cyan-300">
                {ROUTE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">field shape
                  <select value={shape} onChange={(event) => selectShape(event.target.value as PocketShape)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] uppercase text-slate-200 outline-none focus:border-cyan-300">
                    {SHAPE_OPTIONS.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
                  </select>
                </label>
                <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500">energy profile
                  <select value={energyProfile} onChange={(event) => selectProfile(event.target.value as EnergyProfile)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] uppercase text-slate-200 outline-none focus:border-cyan-300">
                    {PROFILE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={Gauge} eyebrow="Accounting" title="Energy ledger" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MetricReadout label="field input" value={formatValue(state.energy.fieldInput)} tone="amber" />
                <MetricReadout label="control input" value={formatValue(state.energy.controlInput)} tone="amber" />
                <MetricReadout label="particle kinetic" value={formatValue(state.energy.particleKinetic)} />
                <MetricReadout label="dissipation" value={formatValue(state.energy.estimatedDissipation)} tone="violet" />
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-500">Normalized simulation energy units. No SI joules are implied.</p>
            </section>
          </aside>
        </div>

        <section className="mt-4 border border-slate-700 bg-[#0b1621] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return <button key={option.id} type="button" aria-pressed={mode === option.id} onClick={() => selectMode(option.id)} className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition ${mode === option.id ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-slate-700 bg-slate-950/50 text-slate-500 hover:border-slate-500 hover:text-slate-200'}`}><Icon className="h-3.5 w-3.5" />{option.label}</button>;
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setRunning((value) => !value)} className="gap-1.5 rounded-none border-slate-600 bg-slate-950 font-mono text-[10px] uppercase tracking-widest text-slate-200 hover:bg-slate-800">{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{running ? 'pause' : 'resume'}</Button>
              <Button size="sm" variant="outline" onClick={disturb} className="gap-1.5 rounded-none border-pink-300/40 bg-pink-300/10 font-mono text-[10px] uppercase tracking-widest text-pink-100 hover:bg-pink-300/20"><AlertTriangle className="h-3.5 w-3.5" />disturb medium</Button>
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5 rounded-none border-slate-600 bg-slate-950 font-mono text-[10px] uppercase tracking-widest text-slate-200 hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" />reset</Button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
          <div className="space-y-4">
            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelHeading icon={Zap} eyebrow="Experiment passport" title="Reproducible ARFR runs" />
                <Button size="sm" onClick={exportPassport} disabled={isExporting} className="gap-1.5 rounded-none bg-cyan-300 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-950 hover:bg-cyan-200"><Download className="h-3.5 w-3.5" />{isExporting ? 'hashing…' : 'export passport'}</Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {BUILT_IN_EXPERIMENTS.map((experiment) => <button key={experiment.id} type="button" onClick={() => selectExperiment(experiment.id)} className="border border-slate-700 bg-slate-950/50 p-3 text-left transition hover:border-cyan-300/60 hover:bg-cyan-300/[0.06]"><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200">{experiment.label}</p><p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">{experiment.detail}</p></button>)}
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-500">Passport records seed, source geometry, medium, controller, route, energy profile, results, and canonical identity hash through the existing passport canonicalization layer.</p>
            </section>

            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelHeading icon={Gauge} eyebrow="Profile comparison" title="Energy-aware routing benchmark" />
                <Button size="sm" variant="outline" onClick={runBenchmark} disabled={isBenchmarking} className="gap-1.5 rounded-none border-slate-600 bg-slate-950 font-mono text-[10px] uppercase tracking-widest text-slate-200 hover:bg-slate-800"><Activity className="h-3.5 w-3.5" />{isBenchmarking ? 'running…' : 'benchmark profiles'}</Button>
              </div>
              {benchmarkRows.length === 0 ? <p className="mt-4 border border-dashed border-slate-700 p-4 font-mono text-[10px] leading-relaxed text-slate-500">Run the same deterministic translation under PRECISION, BALANCED, LOW ENERGY, and MAX CONFINEMENT. The tradeoff is intentional: lower energy may accept larger positional error.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse font-mono text-[10px]"><thead><tr className="border-b border-slate-700 text-left uppercase tracking-widest text-slate-500"><th className="p-2">profile</th><th className="p-2">error</th><th className="p-2">energy</th><th className="p-2">energy / meter</th><th className="p-2">retained</th><th className="p-2">stable s</th></tr></thead><tbody>{benchmarkRows.map((row) => <tr key={row.profile} className="border-b border-slate-800 text-slate-300"><td className="p-2 font-bold text-cyan-200">{row.profile}</td><td className="p-2">{formatValue(row.finalPositionError)}</td><td className="p-2">{formatValue(row.totalEnergy)}</td><td className="p-2">{formatValue(row.energyPerSimulatedMeter)}</td><td className="p-2">{(row.particleRetention * 100).toFixed(1)}%</td><td className="p-2">{row.stableConfinementTime.toFixed(2)}</td></tr>)}</tbody></table></div>}
            </section>
          </div>

          <div className="space-y-4">
            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={GitBranch} eyebrow="Field-defined network" title="Pockets → channels" />
              <div className="mt-4 flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-[10px] uppercase tracking-widest text-slate-500"><span>{network.nodes.length} active node(s)</span><span>{network.edges.length} channel edge(s)</span></div>
              <div className="mt-3 space-y-2">{state.pockets.length === 0 ? <p className="font-mono text-[10px] text-slate-500">No contiguous region currently clears R threshold.</p> : state.pockets.map((pocket, index) => <div key={pocket.id} className="flex items-center justify-between border border-slate-800 bg-slate-950/50 p-2 font-mono text-[10px]"><span className={index === 0 ? 'text-cyan-200' : 'text-violet-200'}>{pocket.id} · {pocket.shape}</span><span className="text-slate-400">C {(pocket.coherence * 100).toFixed(0)}% · {(pocket.particleOccupancy * 100).toFixed(0)}%</span></div>)}</div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-500">Edges are calculated only between currently detected stable pockets. No rigid transport pipe is modeled.</p>
            </section>

            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={Sparkles} eyebrow="Live observables" title="Routing and response" />
              <div className="mt-4 grid grid-cols-2 gap-2"><MetricReadout label="route progress" value={`${(state.metrics.routeProgress * 100).toFixed(1)}%`} /><MetricReadout label="pocket volume" value={formatValue(state.primaryPocket?.volume ?? 0)} /><MetricReadout label="field gradient" value={formatValue(state.primaryPocket?.fieldGradient ?? 0)} tone="violet" /><MetricReadout label="routed distance" value={formatValue(state.energy.routedDistance)} tone="pink" /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]"><div className="border border-slate-800 p-2 text-slate-500">orbit ω <span className="float-right text-cyan-200">{formatValue(state.metrics.angularVelocity)}</span></div><div className="border border-slate-800 p-2 text-slate-500">radial σ <span className="float-right text-cyan-200">{formatValue(state.metrics.radialDispersion)}</span></div><div className="border border-slate-800 p-2 text-slate-500">escape <span className="float-right text-pink-200">{(state.metrics.escapeRate * 100).toFixed(1)}%</span></div><div className="border border-slate-800 p-2 text-slate-500">total energy <span className="float-right text-amber-200">{formatValue(totalEnergy)}</span></div></div>
            </section>

            <section className="border border-slate-700 bg-[#0b1621] p-4">
              <PanelHeading icon={Activity} eyebrow="Event stream" title="Controller telemetry" />
              <ol className="mt-3 max-h-36 space-y-1.5 overflow-auto">{state.events.slice(-8).reverse().map((event, index) => <li key={`${event}-${index}`} className="border-l border-cyan-300/40 pl-2 font-mono text-[10px] leading-relaxed text-slate-400">{event}</li>)}</ol>
            </section>
          </div>
        </section>

        <footer className="mt-5 border-t border-slate-800 pt-4 font-mono text-[10px] leading-relaxed text-slate-600">
          ARFR is a computational research prototype. It implements normalized field superposition, a resonance-selective coupling metric, a finite charged-particle ensemble, and a deterministic adaptive controller. It does not control transmitters, coils, plasma hardware, or any external device.
        </footer>
      </section>
    </main>
  );
};

function lockColor(lockState: LockState): string {
  if (lockState === 'LOCKED') return 'text-emerald-300';
  if (lockState === 'RECOVERING') return 'text-amber-200';
  if (lockState === 'LOST') return 'text-rose-300';
  return 'text-cyan-200';
}

interface PanelHeadingProps {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
}

const PanelHeading: React.FC<PanelHeadingProps> = ({ icon: Icon, eyebrow, title }) => (
  <div className="flex items-center gap-3">
    <div className="grid h-8 w-8 place-items-center border border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-200"><Icon className="h-4 w-4" /></div>
    <div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p><h2 className="mt-1 font-display text-sm font-bold uppercase tracking-wide text-slate-100">{title}</h2></div>
  </div>
);

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}

const ParameterSlider: React.FC<ParameterSliderProps> = ({ label, value, min, max, step, suffix, onChange }) => (
  <div><div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider"><span className="text-slate-400">{label}</span><span className="text-cyan-200">{formatValue(value)} {suffix}</span></div><Slider aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} /></div>
);
