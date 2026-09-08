import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Crosshair,
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
import { toast } from 'sonner';
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
  onMouseMove?: (point: { x: number; y: number } | null) => void;
  hoverPoint?: { x: number; y: number } | null;
}

const ARFRCanvas: React.FC<ARFRCanvasProps> = ({ state, onMouseMove, hoverPoint }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Support HDPI / Retina screens crisp rendering
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== CANVAS_WIDTH * dpr || canvas.height !== CANVAS_HEIGHT * dpr) {
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Deep dark scientific backdrop with radial core glow
    const background = ctx.createRadialGradient(
      CANVAS_WIDTH * 0.5,
      CANVAS_HEIGHT * 0.5,
      50,
      CANVAS_WIDTH * 0.5,
      CANVAS_HEIGHT * 0.5,
      CANVAS_WIDTH * 0.75
    );
    background.addColorStop(0, '#0a1622');
    background.addColorStop(0.5, '#07111a');
    background.addColorStop(1, '#04090e');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Dynamic grid & bounding perspective frame
    ctx.save();
    ctx.strokeStyle = 'rgba(122, 171, 191, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 40; x < CANVAS_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, CANVAS_HEIGHT - 40);
      ctx.stroke();
    }
    for (let y = 60; y < CANVAS_HEIGHT - 40; y += 52) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(CANVAS_WIDTH - 40, y);
      ctx.stroke();
    }

    // Outer frame crosshairs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(39.5, 59.5, CANVAS_WIDTH - 79, CANVAS_HEIGHT - 99);

    // Frame corner ticks
    const corners = [
      { x: 40, y: 60 },
      { x: CANVAS_WIDTH - 40, y: 60 },
      { x: 40, y: CANVAS_HEIGHT - 40 },
      { x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT - 40 },
    ];
    corners.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, TAU_CANVAS);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    });
    ctx.restore();

    // Projected isopotential volume
    const { resolution, potential, vectors } = state.field;
    for (let z = 0; z < resolution.z; z += 1) {
      for (let y = 0; y < resolution.y; y += 1) {
        for (let x = 0; x < resolution.x; x += 1) {
          const index = x + resolution.x * (y + resolution.y * z);
          const value = potential[index];
          if (value < state.config.threshold * 0.25) continue;
          const point = {
            x: state.field.bounds.min.x + (state.field.bounds.max.x - state.field.bounds.min.x) * (x / Math.max(1, resolution.x - 1)),
            y: state.field.bounds.min.y + (state.field.bounds.max.y - state.field.bounds.min.y) * (y / Math.max(1, resolution.y - 1)),
            z: state.field.bounds.min.z + (state.field.bounds.max.z - state.field.bounds.min.z) * (z / Math.max(1, resolution.z - 1)),
          };
          const screen = projectPoint(point, state);
          const alpha = 0.05 + clamp01(value) * 0.28;
          const size = 12 + value * 18;

          // Glowing voxel cell
          ctx.save();
          if (value > state.config.threshold) {
            ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = `rgba(34, 211, 238, ${alpha.toFixed(3)})`;
          } else {
            ctx.fillStyle = `rgba(16, 185, 129, ${(alpha * 0.7).toFixed(3)})`;
          }
          ctx.fillRect(screen.x - size / 2, screen.y - size / 2, size, size);

          if (value > state.config.threshold) {
            ctx.strokeStyle = `rgba(165, 243, 252, ${(0.15 + value * 0.35).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(screen.x - size / 2, screen.y - size / 2, size, size);
          }
          ctx.restore();

          if (z === Math.floor(resolution.z / 2) && (x + y) % 3 === 0 && value > state.config.threshold * 0.4) {
            const vector = {
              x: vectors[index * 3],
              y: vectors[index * 3 + 1],
              z: vectors[index * 3 + 2],
            };
            const destination = projectPoint(addVecForCanvas(point, vector, 0.14), state);
            drawArrow(ctx, screen, destination, 'rgba(56, 189, 248, 0.55)', 1.2);
          }
        }
      }
    }

    // Planned route line and trajectory path
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
    ctx.beginPath();
    for (let index = 0; index <= 60; index += 1) {
      const point = routePosition(state.config.route, (index / 60) * state.config.duration);
      const screen = projectPoint(point, state);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.pocketPath.length > 1) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2dd4bf';
      ctx.shadowColor = 'rgba(45, 212, 191, 0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      state.pocketPath.forEach((point, index) => {
        const screen = projectPoint(point, state);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.stroke();
    }
    ctx.restore();

    // Energy coupling vectors from fixed sources to current target
    const targetScreen = projectPoint(state.primaryPocket?.centroid ?? state.desiredTarget, state);
    state.sources.forEach((source) => {
      const sourceScreen = projectPoint(source.position, state);
      drawArrow(ctx, sourceScreen, targetScreen, 'rgba(251, 191, 36, 0.35)', 1);
    });

    // Particle ensemble trails & active particles with halos
    state.particleTrails.forEach((trail, trailIndex) => {
      if (trail.length < 2) return;
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(186, 230, 253, ${(0.18 + trailIndex * 0.015).toFixed(3)})`;
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
      const isConfined = potentialValue >= state.config.threshold * 0.55;

      ctx.save();
      if (isConfined) {
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      }
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, isConfined ? 3.5 : 2, 0, TAU_CANVAS);
      ctx.fill();
      ctx.restore();
    }

    // Emergent pockets
    state.pockets.forEach((pocket, index) => {
      const screen = projectPoint(pocket.centroid, state);
      const radius = Math.max(14, pocket.radius * 88);
      ctx.save();
      ctx.strokeStyle = index === 0 ? '#22d3ee' : '#c084fc';
      ctx.fillStyle = index === 0 ? 'rgba(34, 211, 238, 0.12)' : 'rgba(192, 132, 252, 0.12)';
      ctx.lineWidth = index === 0 ? 2.5 : 1.5;
      ctx.shadowColor = index === 0 ? 'rgba(34, 211, 238, 0.4)' : 'rgba(192, 132, 252, 0.4)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, radius * (pocket.shape === 'ellipsoid' ? 1.45 : 1), radius * 0.78, 0, 0, TAU_CANVAS);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Desired Target marker crosshair
    const desiredScreen = projectPoint(state.desiredTarget, state);
    ctx.save();
    ctx.strokeStyle = '#f472b6';
    ctx.fillStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(244, 114, 182, 0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(desiredScreen.x - 14, desiredScreen.y);
    ctx.lineTo(desiredScreen.x + 14, desiredScreen.y);
    ctx.moveTo(desiredScreen.x, desiredScreen.y - 14);
    ctx.lineTo(desiredScreen.x, desiredScreen.y + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(desiredScreen.x, desiredScreen.y, 6, 0, TAU_CANVAS);
    ctx.stroke();
    ctx.restore();

    // Fixed hardware source array nodes
    state.initialSourcePositions.forEach((position, index) => {
      const source = state.sources[index];
      const screen = projectPoint(position, state);
      const orientation = source?.orientation ?? { x: 0, y: 0, z: 1 };
      const end = projectPoint(addVecForCanvas(position, orientation, 0.32), state);
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 10);
      ctx.lineTo(screen.x + 10, screen.y);
      ctx.lineTo(screen.x, screen.y + 10);
      ctx.lineTo(screen.x - 10, screen.y);
      ctx.closePath();
      ctx.fill();
      drawArrow(ctx, screen, end, '#fef08a', 1.8);
      ctx.font = '700 12px JetBrains Mono, monospace';
      ctx.fillText(`S${index + 1}`, screen.x + 14, screen.y - 10);
      ctx.restore();
    });

    // Hover inspector crosshair overlay
    if (hoverPoint) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverPoint.x, 60);
      ctx.lineTo(hoverPoint.x, CANVAS_HEIGHT - 40);
      ctx.moveTo(40, hoverPoint.y);
      ctx.lineTo(CANVAS_WIDTH - 40, hoverPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hoverPoint.x, hoverPoint.y, 4, 0, TAU_CANVAS);
      ctx.fill();
      ctx.restore();
    }

    // Legend and telemetry header text overlays inside canvas
    ctx.save();
    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('HARDWARE / SOURCE GEOMETRY — FIXED POSITIONS', 48, 38);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('EMERGENT RESONANCE GEOMETRY — SAMPLED FIELD', 48, 52);

    ctx.fillStyle = '#f472b6';
    ctx.fillText(`TARGET  [${formatValue(state.desiredTarget.x, 2)}, ${formatValue(state.desiredTarget.y, 2)}, ${formatValue(state.desiredTarget.z, 2)}]`, CANVAS_WIDTH - 380, 38);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`t = ${state.time.toFixed(2)} s  ·  step ${state.step}`, CANVAS_WIDTH - 250, CANVAS_HEIGHT - 22);
    ctx.restore();

    ctx.restore();
  }, [state, hoverPoint]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onMouseMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    onMouseMove({ x, y });
  };

  const handlePointerLeave = () => {
    if (onMouseMove) onMouseMove(null);
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="Projected three-dimensional Adaptive Resonant Field Router field volume"
      className="block h-auto w-full cursor-crosshair touch-none"
    />
  );
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
  <div className="border border-[#1e293b] bg-[#050c14] p-3 transition hover:border-[#38bdf8]/40 hover:bg-[#08131f]">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#94a3b8]">{label}</span>
      <span className={`h-2 w-2 rounded-full shadow-sm ${tone === 'pink' ? 'bg-[#f472b6] shadow-[#f472b6]/50' : tone === 'amber' ? 'bg-[#fbbf24] shadow-[#fbbf24]/50' : tone === 'violet' ? 'bg-[#c084fc] shadow-[#c084fc]/50' : 'bg-[#38bdf8] shadow-[#38bdf8]/50'}`} />
    </div>
    <p className="mt-2 font-mono text-lg font-bold text-[#f8fafc] tracking-tight">{value}</p>
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
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
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
    toast.warning('Medium disturbed — velocity impulse queued', {
      description: 'Magnitude: 0.72 a.u. Controller attempting field recovery.',
    });
  }, []);

  const reset = useCallback(() => {
    restart();
    toast.info('ARFR Simulation reset to initial state');
  }, [restart]);

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
    toast.success(`Preset loaded: ${experiment.replace('_', ' ').toUpperCase()}`);
  }, [disturb, restart]);

  const runBenchmark = useCallback(() => {
    setIsBenchmarking(true);
    toast.info('Running energy profile comparison benchmark...');
    window.setTimeout(() => {
      const rows = runEnergyProfileComparison(stateRef.current.config.seed, 120);
      setBenchmarkRows(rows);
      setIsBenchmarking(false);
      toast.success('Profile benchmark complete', {
        description: `Evaluated ${rows.length} energy configurations across 120 ticks.`,
      });
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
      toast.success('ARFR Passport JSON exported successfully', {
        description: `Identity hash: ${passport.integrity.identityHash.slice(0, 16)}...`,
      });
    } catch {
      toast.error('Failed to generate experiment passport');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const network = useMemo(() => buildResonantFieldNetwork(state.pockets), [state.pockets]);
  const averageFrequency = state.sources.reduce((sum, source) => sum + source.frequency, 0) / Math.max(1, state.sources.length);
  const rotationRate = Math.abs(state.sources[0]?.angularVelocity ?? 0);
  const totalEnergy = state.energy.fieldInput + state.energy.controlInput + state.energy.estimatedDissipation;

  return (
    <main className="min-h-screen bg-[#071019] text-[#f8fafc]">
      <section className="mx-auto max-w-[1800px] px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#38bdf8]/20 pb-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#38bdf8]">Vers3Dynamics · numerical research instrument</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-extrabold uppercase leading-[0.92] tracking-[-0.04em] text-[#f8fafc] sm:text-6xl">
              Adaptive Resonant<br />
              <span className="text-[#38bdf8] drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]">Field Router</span>
            </h1>
            <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-[#94a3b8]">
              A bounded simulation of field-defined transport. The sources remain spatially fixed while phase, frequency, amplitude, and rotation are retuned in a closed loop.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
            <Badge className="rounded-none border border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fef08a]">SIMULATION ONLY</Badge>
            <Badge className="rounded-none border border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fef08a]">SOURCES LOCKED</Badge>
            <Badge className="rounded-none border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#7dd3fc]">FIELD SYNTHESIS ACTIVE</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden border border-[#1e293b] bg-[#0b1621] shadow-[0_0_45px_rgba(34,211,238,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] bg-[#050c14] px-4 py-3">
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="h-2 w-2 animate-pulse bg-[#38bdf8]" />
                <span className="font-bold uppercase tracking-[0.18em] text-[#38bdf8]">ARFR field workspace</span>
                <span className="text-[#64748b]">·</span>
                <span className="text-[#94a3b8]">{state.config.sourceArrangement} / {state.config.fieldResolution.x}×{state.config.fieldResolution.y}×{state.config.fieldResolution.z} volume</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#64748b]">lock</span>
                <span className={`font-mono text-xs font-bold ${lockColor(state.controller.lockState)}`}>{state.controller.lockState}</span>
              </div>
            </div>
            <ARFRCanvas state={state} onMouseMove={setHoverPoint} hoverPoint={hoverPoint} />
          </section>

          <aside className="space-y-4">
            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={Activity} eyebrow="Control state" title="Target lock" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MetricReadout label="position error" value={formatValue(state.metrics.positionError)} tone="pink" />
                <MetricReadout label="lock quality" value={`${(state.controller.lockQuality * 100).toFixed(1)}%`} />
                <MetricReadout label="coherence" value={`${(state.controller.coherence * 100).toFixed(1)}%`} />
                <MetricReadout label="occupancy" value={`${(state.metrics.occupancy * 100).toFixed(1)}%`} tone="violet" />
              </div>
              <div className="mt-3 h-1.5 bg-[#0f172a]"><div className="h-full bg-[#38bdf8] transition-all" style={{ width: `${state.controller.lockQuality * 100}%` }} /></div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#64748b]">Target = geometry + trajectory + resonance state. Controller effort is penalized by the selected energy profile.</p>
            </section>

            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={Waves} eyebrow="Stationary source array" title="Relative field parameters" />
              <div className="mt-4 space-y-4">
                <ParameterSlider label="frequency" value={averageFrequency} min={0.4} max={2.4} step={0.01} onChange={(value) => adjustSourceParameter('frequency', value)} suffix="ω" />
                <ParameterSlider label="amplitude" value={state.sources[0]?.amplitude ?? 1} min={0.2} max={1.8} step={0.01} onChange={(value) => adjustSourceParameter('amplitude', value)} suffix="a.u." />
                <ParameterSlider label="counter-rotation rate" value={rotationRate} min={0} max={2} step={0.01} onChange={(value) => adjustSourceParameter('rotationRate', value)} suffix="rad/s" />
                <ParameterSlider label="polarization angle" value={state.sources[0]?.polarization ?? 0} min={-1.57} max={1.57} step={0.01} onChange={(value) => adjustSourceParameter('polarization', value)} suffix="rad" />
                <ParameterSlider label="resonance threshold" value={threshold} min={0.12} max={0.62} step={0.01} onChange={adjustThreshold} suffix="R" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] text-[#94a3b8]">
                <div className="border border-[#fbbf24]/20 bg-[#fbbf24]/[0.05] p-2"><span className="text-[#fbbf24]">4</span> sources</div>
                <div className="border border-[#fbbf24]/20 bg-[#fbbf24]/[0.05] p-2"><span className="text-[#fbbf24]">0</span> position updates</div>
              </div>
            </section>

            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={Target} eyebrow="Target trajectory" title="Route geometry" />
              <select value={routeKind} onChange={(event) => selectRoute(event.target.value as RouteKind)} className="mt-4 w-full border border-[#1e293b] bg-[#050c14] px-3 py-2 font-mono text-[11px] uppercase text-[#e2e8f0] outline-none focus:border-[#38bdf8]">
                {ROUTE_OPTIONS.map((option) => <option key={option.id} value={option.id} className="bg-[#0b1621] text-[#e2e8f0]">{option.label}</option>)}
              </select>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748b]">field shape
                  <select value={shape} onChange={(event) => selectShape(event.target.value as PocketShape)} className="mt-1 w-full border border-[#1e293b] bg-[#050c14] px-2 py-2 text-[10px] uppercase text-[#e2e8f0] outline-none focus:border-[#38bdf8]">
                    {SHAPE_OPTIONS.map((option) => <option key={option} value={option} className="bg-[#0b1621] text-[#e2e8f0]">{option.replace('_', ' ')}</option>)}
                  </select>
                </label>
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748b]">energy profile
                  <select value={energyProfile} onChange={(event) => selectProfile(event.target.value as EnergyProfile)} className="mt-1 w-full border border-[#1e293b] bg-[#050c14] px-2 py-2 text-[10px] uppercase text-[#e2e8f0] outline-none focus:border-[#38bdf8]">
                    {PROFILE_OPTIONS.map((option) => <option key={option.id} value={option.id} className="bg-[#0b1621] text-[#e2e8f0]">{option.label}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={Gauge} eyebrow="Accounting" title="Energy ledger" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MetricReadout label="field input" value={formatValue(state.energy.fieldInput)} tone="amber" />
                <MetricReadout label="control input" value={formatValue(state.energy.controlInput)} tone="amber" />
                <MetricReadout label="particle kinetic" value={formatValue(state.energy.particleKinetic)} />
                <MetricReadout label="dissipation" value={formatValue(state.energy.estimatedDissipation)} tone="violet" />
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-[#64748b]">Normalized simulation energy units. No SI joules are implied.</p>
            </section>
          </aside>
        </div>

        <section className="mt-4 border border-[#1e293b] bg-[#0b1621] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={`Select operating mode ${option.label}`}
                    aria-pressed={mode === option.id}
                    onClick={() => selectMode(option.id)}
                    className={`flex items-center gap-1.5 border px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019] ${
                      mode === option.id
                        ? 'border-[#38bdf8] bg-[#38bdf8]/20 text-[#7dd3fc] shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                        : 'border-[#1e293b] bg-[#050c14] text-[#94a3b8] hover:border-[#334155] hover:text-[#e2e8f0]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                aria-label={running ? 'Pause simulation execution' : 'Resume simulation execution'}
                onClick={() => setRunning((value) => !value)}
                className="gap-1.5 rounded-none border-[#1e293b] bg-[#050c14] font-mono text-[10px] uppercase tracking-widest text-[#e2e8f0] hover:bg-[#0f172a] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019]"
              >
                {running ? <Pause className="h-3.5 w-3.5 text-[#fbbf24]" /> : <Play className="h-3.5 w-3.5 text-[#38bdf8]" />}
                {running ? 'pause' : 'resume'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label="Disturb medium with velocity impulse"
                onClick={disturb}
                className="gap-1.5 rounded-none border-[#f472b6]/50 bg-[#f472b6]/10 font-mono text-[10px] uppercase tracking-widest text-[#f472b6] hover:bg-[#f472b6]/20 focus-visible:ring-2 focus-visible:ring-[#f472b6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019]"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-[#f472b6]" />
                disturb medium
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label="Reset simulation"
                onClick={reset}
                className="gap-1.5 rounded-none border-[#1e293b] bg-[#050c14] font-mono text-[10px] uppercase tracking-widest text-[#e2e8f0] hover:bg-[#0f172a] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019]"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#94a3b8]" />
                reset
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
          <div className="space-y-4">
            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelHeading icon={Zap} eyebrow="Experiment passport" title="Reproducible ARFR runs" />
                <Button size="sm" onClick={exportPassport} disabled={isExporting} aria-label="Export ARFR Experiment Passport as JSON" className="gap-1.5 rounded-none bg-[#38bdf8] font-mono text-[10px] font-bold uppercase tracking-widest text-[#071019] hover:bg-[#7dd3fc] focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019]"><Download className="h-3.5 w-3.5" />{isExporting ? 'hashing…' : 'export passport'}</Button>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {BUILT_IN_EXPERIMENTS.map((experiment) => (
                  <button
                    key={experiment.id}
                    type="button"
                    aria-label={`Load preset experiment ${experiment.label}`}
                    onClick={() => selectExperiment(experiment.id)}
                    className="border border-[#1e293b] bg-[#050c14] p-3 text-left transition hover:border-[#38bdf8]/70 hover:bg-[#38bdf8]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019]"
                  >
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#38bdf8]">{experiment.label}</p>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-[#94a3b8]">{experiment.detail}</p>
                  </button>
                ))}
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-[#64748b]">Passport records seed, source geometry, medium, controller, route, energy profile, results, and canonical identity hash through the existing passport canonicalization layer.</p>
            </section>

            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelHeading icon={Gauge} eyebrow="Profile comparison" title="Energy-aware routing benchmark" />
                <Button size="sm" variant="outline" onClick={runBenchmark} disabled={isBenchmarking} className="gap-1.5 rounded-none border-[#1e293b] bg-[#050c14] font-mono text-[10px] uppercase tracking-widest text-[#e2e8f0] hover:bg-[#0f172a]"><Activity className="h-3.5 w-3.5" />{isBenchmarking ? 'running…' : 'benchmark profiles'}</Button>
              </div>
              {benchmarkRows.length === 0 ? <p className="mt-4 border border-dashed border-[#1e293b] p-4 font-mono text-[10px] leading-relaxed text-[#64748b]">Run the same deterministic translation under PRECISION, BALANCED, LOW ENERGY, and MAX CONFINEMENT. The tradeoff is intentional: lower energy may accept larger positional error.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse font-mono text-[10px]"><thead><tr className="border-b border-[#1e293b] text-left uppercase tracking-widest text-[#94a3b8]"><th className="p-2">profile</th><th className="p-2">error</th><th className="p-2">energy</th><th className="p-2">energy / meter</th><th className="p-2">retained</th><th className="p-2">stable s</th></tr></thead><tbody>{benchmarkRows.map((row) => <tr key={row.profile} className="border-b border-[#0f172a] text-[#e2e8f0]"><td className="p-2 font-bold text-[#38bdf8]">{row.profile}</td><td className="p-2">{formatValue(row.finalPositionError)}</td><td className="p-2">{formatValue(row.totalEnergy)}</td><td className="p-2">{formatValue(row.energyPerSimulatedMeter)}</td><td className="p-2">{(row.particleRetention * 100).toFixed(1)}%</td><td className="p-2">{row.stableConfinementTime.toFixed(2)}</td></tr>)}</tbody></table></div>}
            </section>
          </div>

          <div className="space-y-4">
            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={GitBranch} eyebrow="Field-defined network" title="Pockets → channels" />
              <div className="mt-4 flex items-center justify-between border-b border-[#1e293b] pb-3 font-mono text-[10px] uppercase tracking-widest text-[#64748b]"><span>{network.nodes.length} active node(s)</span><span>{network.edges.length} channel edge(s)</span></div>
              <div className="mt-3 space-y-2">{state.pockets.length === 0 ? <p className="font-mono text-[10px] text-[#64748b]">No contiguous region currently clears R threshold.</p> : state.pockets.map((pocket, index) => <div key={pocket.id} className="flex items-center justify-between border border-[#1e293b] bg-[#050c14] p-2 font-mono text-[10px]"><span className={index === 0 ? 'text-[#38bdf8]' : 'text-[#c084fc]'}>{pocket.id} · {pocket.shape}</span><span className="text-[#94a3b8]">C {(pocket.coherence * 100).toFixed(0)}% · {(pocket.particleOccupancy * 100).toFixed(0)}%</span></div>)}</div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-[#64748b]">Edges are calculated only between currently detected stable pockets. No rigid transport pipe is modeled.</p>
            </section>

            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={Sparkles} eyebrow="Live observables" title="Routing and response" />
              <div className="mt-4 grid grid-cols-2 gap-2"><MetricReadout label="route progress" value={`${(state.metrics.routeProgress * 100).toFixed(1)}%`} /><MetricReadout label="pocket volume" value={formatValue(state.primaryPocket?.volume ?? 0)} /><MetricReadout label="field gradient" value={formatValue(state.primaryPocket?.fieldGradient ?? 0)} tone="violet" /><MetricReadout label="routed distance" value={formatValue(state.energy.routedDistance)} tone="pink" /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]"><div className="border border-[#1e293b] bg-[#050c14] p-2 text-[#94a3b8]">orbit ω <span className="float-right font-bold text-[#38bdf8]">{formatValue(state.metrics.angularVelocity)}</span></div><div className="border border-[#1e293b] bg-[#050c14] p-2 text-[#94a3b8]">radial σ <span className="float-right font-bold text-[#38bdf8]">{formatValue(state.metrics.radialDispersion)}</span></div><div className="border border-[#1e293b] bg-[#050c14] p-2 text-[#94a3b8]">escape <span className="float-right font-bold text-[#f472b6]">{(state.metrics.escapeRate * 100).toFixed(1)}%</span></div><div className="border border-[#1e293b] bg-[#050c14] p-2 text-[#94a3b8]">total energy <span className="float-right font-bold text-[#fbbf24]">{formatValue(totalEnergy)}</span></div></div>
            </section>

            <section className="border border-[#1e293b] bg-[#0b1621] p-4">
              <PanelHeading icon={Activity} eyebrow="Event stream" title="Controller telemetry" />
              <ol className="mt-3 max-h-36 space-y-1.5 overflow-auto pr-1">{state.events.slice(-8).reverse().map((event, index) => <li key={`${event}-${index}`} className="border-l-2 border-[#38bdf8]/50 pl-2 font-mono text-[10px] leading-relaxed text-[#94a3b8]">{event}</li>)}</ol>
            </section>
          </div>
        </section>

        <footer className="mt-5 border-t border-[#1e293b] pt-4 font-mono text-[10px] leading-relaxed text-[#64748b]">
          ARFR is a computational research prototype. It implements normalized field superposition, a resonance-selective coupling metric, a finite charged-particle ensemble, and a deterministic adaptive controller. It does not control transmitters, coils, plasma hardware, or any external device.
        </footer>
      </section>
    </main>
  );
};

function lockColor(lockState: LockState): string {
  if (lockState === 'LOCKED') return 'text-[#34d399]';
  if (lockState === 'RECOVERING') return 'text-[#fbbf24]';
  if (lockState === 'LOST') return 'text-[#f87171]';
  return 'text-[#38bdf8]';
}

interface PanelHeadingProps {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
}

const PanelHeading: React.FC<PanelHeadingProps> = ({ icon: Icon, eyebrow, title }) => (
  <div className="flex items-center gap-3">
    <div className="grid h-8 w-8 place-items-center border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.15)]"><Icon className="h-4 w-4" /></div>
    <div><p className="font-mono text-[9px] uppercase tracking-[0.22em] font-semibold text-[#38bdf8]">{eyebrow}</p><h2 className="mt-0.5 font-display text-sm font-bold uppercase tracking-wide text-[#f8fafc]">{title}</h2></div>
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
  <div><div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider"><span className="text-[#94a3b8]">{label}</span><span className="font-bold text-[#38bdf8]">{formatValue(value)} {suffix}</span></div><Slider aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} /></div>
);
