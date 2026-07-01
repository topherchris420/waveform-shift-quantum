import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Atom,
  BarChart3,
  Beaker,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

type ExperimentMode = 'teleportation' | 'interference' | 'tunneling' | 'superposition';

interface QuantumObject {
  id: string;
  x: number;
  y: number;
  frequency: number;
  phase: number;
  amplitude: number;
  isEntangled: boolean;
  entangledWith?: string;
  isTeleporting: boolean;
}

interface ResonanceNode {
  x: number;
  y: number;
  intensity: number;
  phase: number;
}

interface Measurement {
  id: number;
  timestamp: number;
  value: number;
  type: ExperimentMode;
}

interface ExperimentDefinition {
  label: string;
  eyebrow: string;
  icon: React.ElementType;
  premise: string;
  instruction: string;
  readoutLabel: string;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;

const experiments: Record<ExperimentMode, ExperimentDefinition> = {
  teleportation: {
    label: 'Teleportation',
    eyebrow: 'Entangled state transfer',
    icon: Zap,
    premise: 'Location behaves like a resonance state. Two linked objects exchange pattern information without treating space as a container.',
    instruction: 'Tap empty space to add an object. Select an object to inspect it. Run the experiment to swap the first entangled pair.',
    readoutLabel: 'Transfer fidelity',
  },
  interference: {
    label: 'Interference',
    eyebrow: 'Double-slit field',
    icon: Waves,
    premise: 'Probability behaves like a wave. The field builds bright and dark bands where paths reinforce or cancel each other.',
    instruction: 'Raise field intensity to sharpen the bands. Toggle traces to compare individual events with the wave pattern.',
    readoutLabel: 'Fringe contrast',
  },
  tunneling: {
    label: 'Tunneling',
    eyebrow: 'Barrier crossing',
    icon: Target,
    premise: 'A quantum state can leak through a barrier. Higher barriers reduce, but do not simply delete, the crossing probability.',
    instruction: 'Move the barrier slider and watch the transmitted glow shrink or recover in real time.',
    readoutLabel: 'Tunnel chance',
  },
  superposition: {
    label: 'Superposition',
    eyebrow: 'Many possible states',
    icon: Atom,
    premise: 'Before measurement, the object is represented as multiple compatible possibilities rather than one settled point.',
    instruction: 'Run the experiment to emphasize the coherent center, then enable measurement to sample the field.',
    readoutLabel: 'Coherence index',
  },
};

const modeOrder: ExperimentMode[] = ['teleportation', 'interference', 'tunneling', 'superposition'];

const initialObjects: QuantumObject[] = [
  { id: 'alpha', x: 200, y: 220, frequency: 2, phase: 0, amplitude: 54, isEntangled: true, entangledWith: 'beta', isTeleporting: false },
  { id: 'beta', x: 700, y: 390, frequency: 2, phase: Math.PI, amplitude: 54, isEntangled: true, entangledWith: 'alpha', isTeleporting: false },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const formatPercent = (value: number) => `${Math.round(clamp(value) * 100)}%`;

export const QuantumLab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const lastUiTick = useRef(0);
  const measurementIdRef = useRef(0);

  const [isRunning, setIsRunning] = useState(true);
  const [selectedObject, setSelectedObject] = useState<string | null>('alpha');
  const [objects, setObjects] = useState<QuantumObject[]>(initialObjects);
  const [resonanceNodes, setResonanceNodes] = useState<ResonanceNode[]>([]);
  const [fieldIntensity, setFieldIntensity] = useState([0.58]);
  const [waveSpeed, setWaveSpeed] = useState([1]);
  const [particleCount, setParticleCount] = useState([26]);
  const [barrierHeight, setBarrierHeight] = useState([48]);
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('teleportation');
  const [showTraces, setShowTraces] = useState(true);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [statusMessage, setStatusMessage] = useState('System initialized. Entangled pair alpha/beta is phase-locked.');
  const [time, setTime] = useState(0);

  const activeExperiment = experiments[experimentMode];
  const selectedObj = objects.find((object) => object.id === selectedObject) ?? objects[0];

  useEffect(() => {
    const nodes: ResonanceNode[] = [];
    for (let x = 0; x <= CANVAS_WIDTH; x += 48) {
      for (let y = 0; y <= CANVAS_HEIGHT; y += 48) {
        nodes.push({ x, y, intensity: 0.16 + Math.random() * 0.24, phase: Math.random() * Math.PI * 2 });
      }
    }
    setResonanceNodes(nodes);
  }, []);



  const entangledCount = useMemo(() => objects.filter((object) => object.isEntangled).length, [objects]);
  const tunnelChance = useMemo(() => Math.exp(-barrierHeight[0] * 0.052), [barrierHeight]);
  const coherence = useMemo(() => {
    const crowdingPenalty = objects.length * 0.028;
    const barrierPenalty = experimentMode === 'tunneling' ? barrierHeight[0] / 420 : 0;
    return clamp(0.94 - crowdingPenalty - barrierPenalty + Math.cos(time * 0.65) * 0.035);
  }, [barrierHeight, experimentMode, objects.length, time]);
  const activeReadout = useMemo(() => {
    if (experimentMode === 'tunneling') return tunnelChance;
    if (experimentMode === 'superposition') return coherence;
    if (experimentMode === 'interference') return clamp(fieldIntensity[0] * 0.82 + particleCount[0] / 250);
    return clamp(0.5 + entangledCount * 0.11 + Math.sin(time * 1.2) * 0.08);
  }, [coherence, entangledCount, experimentMode, fieldIntensity, particleCount, time, tunnelChance]);
  const phaseDelta = useMemo(() => {
    if (objects.length < 2) return 0;
    return Math.round(((Math.abs(objects[0].phase - objects[1].phase) % (Math.PI * 2)) * 180) / Math.PI);
  }, [objects]);

  const recordMeasurement = useCallback((type: ExperimentMode, value = activeReadout) => {
    setMeasurements((current) => [
      ...current.slice(-11),
      { id: measurementIdRef.current += 1, timestamp: timeRef.current, value: clamp(value), type },
    ]);
  }, [activeReadout]);

  const drawQuantumField = useCallback((ctx: CanvasRenderingContext2D, currentTime: number) => {
    const background = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    background.addColorStop(0, '#030712');
    background.addColorStop(0.52, '#07111d');
    background.addColorStop(1, '#101326');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Scanning grid effect
    ctx.strokeStyle = 'rgba(148, 214, 255, 0.045)';
    ctx.lineWidth = 1;
    const scanY = (currentTime * 50) % CANVAS_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(CANVAS_WIDTH, scanY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(78, 234, 255, 0.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    resonanceNodes.forEach((node) => {
      const intensity = node.intensity * fieldIntensity[0] * (1 + 0.35 * Math.sin(currentTime * 1.6 + node.phase));
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 46);
      gradient.addColorStop(0, `rgba(112, 232, 255, ${intensity * 0.16})`);
      gradient.addColorStop(1, 'rgba(112, 232, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(node.x - 46, node.y - 46, 92, 92);
    });

    if (!showTraces) return;
    for (let i = 0; i < particleCount[0]; i += 1) {
      const x = Math.sin(currentTime * 0.9 + i * 0.74) * 230 + 480 + Math.cos(currentTime * 0.52 + i) * 120;
      const y = Math.cos(currentTime * 1.1 + i * 0.43) * 170 + 320 + Math.sin(currentTime * 0.4 + i * 1.8) * 86;
      const alpha = 0.25 + Math.sin(currentTime + i) * 0.12;
      ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + Math.sin(currentTime * 2 + i) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [fieldIntensity, particleCount, resonanceNodes, showTraces]);

  const drawInterferencePattern = useCallback((ctx: CanvasRenderingContext2D, currentTime: number) => {
    if (experimentMode !== 'interference') return;
    const barrierX = 360;
    const slits = [220, 420];
    const slitWidth = 28;

    ctx.fillStyle = 'rgba(219, 198, 151, 0.18)';
    ctx.fillRect(barrierX - 6, 0, 12, slits[0] - slitWidth);
    ctx.fillRect(barrierX - 6, slits[0] + slitWidth, 12, slits[1] - slits[0] - slitWidth * 2);
    ctx.fillRect(barrierX - 6, slits[1] + slitWidth, 12, CANVAS_HEIGHT - slits[1] - slitWidth);
    ctx.fillStyle = 'rgba(126, 213, 203, 0.9)';
    slits.forEach((y) => ctx.fillRect(barrierX - 10, y - slitWidth, 20, slitWidth * 2));

    const screenX = 760;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(screenX, 60, 4, CANVAS_HEIGHT - 120);
    for (let y = 72; y < CANVAS_HEIGHT - 72; y += 3) {
      const d1 = Math.hypot(screenX - barrierX, y - slits[0]);
      const d2 = Math.hypot(screenX - barrierX, y - slits[1]);
      const phase = (d1 - d2) * 0.027 * fieldIntensity[0] + currentTime * 0.8;
      const intensity = Math.cos(phase) ** 2;
      ctx.fillStyle = `rgba(125, 221, 255, ${intensity * 0.48})`;
      ctx.fillRect(screenX + 10, y, 42 * intensity + 2, 3);
    }
  }, [experimentMode, fieldIntensity]);

  const drawTunnelingBarrier = useCallback((ctx: CanvasRenderingContext2D) => {
    if (experimentMode !== 'tunneling') return;
    const barrierX = 420;
    const barrierWidth = 128;
    const height = barrierHeight[0] * 4.6;
    const top = CANVAS_HEIGHT / 2 - height / 2;
    const barrier = ctx.createLinearGradient(barrierX, top, barrierX + barrierWidth, top + height);
    barrier.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
    barrier.addColorStop(0.5, 'rgba(245, 158, 11, 0.5)');
    barrier.addColorStop(1, 'rgba(245, 158, 11, 0.08)');
    ctx.fillStyle = barrier;
    ctx.fillRect(barrierX, top, barrierWidth, height);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.74)';
    ctx.strokeRect(barrierX, top, barrierWidth, height);
    ctx.fillStyle = `rgba(163, 230, 53, ${clamp(tunnelChance * 1.8, 0.08, 0.8)})`;
    ctx.fillRect(barrierX + barrierWidth + 28, CANVAS_HEIGHT / 2 - 44, 18, 88);
  }, [barrierHeight, experimentMode, tunnelChance]);

  const drawSuperpositionStates = useCallback((ctx: CanvasRenderingContext2D, currentTime: number) => {
    if (experimentMode !== 'superposition') return;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const colors = ['rgba(126, 213, 203, 0.34)', 'rgba(179, 216, 95, 0.32)', 'rgba(229, 151, 83, 0.32)', 'rgba(185, 160, 242, 0.26)'];

    colors.forEach((color, index) => {
      const angle = index * Math.PI / 2 + currentTime * 0.55;
      const radius = 118 + Math.sin(currentTime + index) * 20;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 70);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 70, y - 70, 140, 140);
    });

    const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 70);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    core.addColorStop(0.4, 'rgba(126, 213, 203, 0.32)');
    core.addColorStop(1, 'rgba(126, 213, 203, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(centerX - 70, centerY - 70, 140, 140);
  }, [experimentMode]);

  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, object: QuantumObject, currentTime: number) => {
    const selected = selectedObject === object.id;
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.globalAlpha = object.isTeleporting ? 0.32 : 0.9;
    ctx.strokeStyle = object.isEntangled ? '#b9a0f2' : '#7ed5cb';
    ctx.lineWidth = selected ? 3 : 2;

    ctx.beginPath();
    for (let i = -object.amplitude; i <= object.amplitude; i += 2) {
      const waveY = i * Math.sin(object.frequency * currentTime + object.phase) * Math.cos(i * 0.1);
      if (i === -object.amplitude) ctx.moveTo(waveY, i);
      else ctx.lineTo(waveY, i);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = -object.amplitude; i <= object.amplitude; i += 2) {
      const waveX = i * Math.sin(object.frequency * currentTime + object.phase + Math.PI / 2) * Math.cos(i * 0.1);
      if (i === -object.amplitude) ctx.moveTo(i, waveX);
      else ctx.lineTo(i, waveX);
    }
    ctx.stroke();

    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, selected ? 32 : 24);
    core.addColorStop(0, object.isEntangled ? '#b9a0f2' : '#7ed5cb');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.fillRect(-34, -34, 68, 68);

    if (selected) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.88)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, object.amplitude + 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(242, 235, 219, 0.84)';
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillText(object.id.toUpperCase(), object.x + 18, object.y - 18);
  }, [selectedObject]);

  const drawEntanglementLink = useCallback((ctx: CanvasRenderingContext2D, first: QuantumObject, second: QuantumObject, currentTime: number) => {
    if (!first.isEntangled || !second.isEntangled) return;
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(8, Math.floor(distance / 18));

    ctx.save();
    ctx.strokeStyle = 'rgba(185, 160, 242, 0.58)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -currentTime * 20;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = first.x + dx * t;
      const y = first.y + dy * t + Math.sin(t * Math.PI * 4 + currentTime * 2) * 22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(second.x, second.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  const drawScene = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawQuantumField(ctx, currentTime);
    drawInterferencePattern(ctx, currentTime);
    drawTunnelingBarrier(ctx);
    drawSuperpositionStates(ctx, currentTime);

    objects.forEach((object) => {
      const partner = objects.find((candidate) => candidate.id === object.entangledWith);
      if (partner && object.id < partner.id) drawEntanglementLink(ctx, object, partner, currentTime);
    });
    objects.forEach((object) => drawWaveform(ctx, object, currentTime));
  }, [drawEntanglementLink, drawInterferencePattern, drawQuantumField, drawSuperpositionStates, drawTunnelingBarrier, drawWaveform, objects]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (isRunning) timeRef.current += 0.016 * waveSpeed[0];
      drawScene(timeRef.current);

      if (timestamp - lastUiTick.current > 140) {
        lastUiTick.current = timestamp;
        setTime(timeRef.current);
        if (measurementMode && isRunning) recordMeasurement(experimentMode);
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [drawScene, experimentMode, isRunning, measurementMode, recordMeasurement, waveSpeed]);

  const addQuantumObject = useCallback((x?: number, y?: number) => {
    const nextIndex = objects.length + 1;
    const object: QuantumObject = {
      id: `q${nextIndex}`,
      x: x ?? 180 + Math.random() * 560,
      y: y ?? 140 + Math.random() * 360,
      frequency: 1.4 + Math.random() * 2.6,
      phase: Math.random() * Math.PI * 2,
      amplitude: 42 + Math.random() * 24,
      isEntangled: false,
      isTeleporting: false,
    };
    setObjects((current) => [...current, object]);
    setSelectedObject(object.id);
    setStatusMessage(`${object.id.toUpperCase()} added to the resonance field.`);
  }, [objects.length]);

  const resetExperiment = useCallback(() => {
    setObjects(initialObjects);
    setSelectedObject('alpha');
    setMeasurements([]);
    setStatusMessage('System reset. Alpha and beta are entangled and ready.');
    timeRef.current = 0;
    setTime(0);
  }, []);

  const runExperiment = useCallback(() => {
    if (experimentMode === 'teleportation') {
      if (objects.length < 2) {
        setStatusMessage('Add at least two quantum objects before transferring state.');
        return;
      }
      setObjects((current) => current.map((object, index) => index < 2 ? { ...object, isTeleporting: true } : object));
      window.setTimeout(() => {
        setObjects((current) => {
          const next = [...current];
          const first = { ...next[0] };
          const second = { ...next[1] };
          [first.x, second.x] = [second.x, first.x];
          [first.y, second.y] = [second.y, first.y];
          first.isTeleporting = false;
          second.isTeleporting = false;
          next[0] = first;
          next[1] = second;
          return next;
        });
        setStatusMessage('State transfer complete. The pattern moved, not the matter.');
        recordMeasurement('teleportation', 0.86 + Math.random() * 0.08);
      }, 620);
      return;
    }

    if (experimentMode === 'interference') {
      setShowTraces(true);
      setStatusMessage('Interference screen activated. Bright bands mark constructive paths.');
      recordMeasurement('interference', activeReadout);
      return;
    }

    if (experimentMode === 'tunneling') {
      setStatusMessage(`Barrier sampled. Estimated tunnel chance is ${formatPercent(tunnelChance)}.`);
      recordMeasurement('tunneling', tunnelChance);
      return;
    }

    setStatusMessage('Superposition emphasized. Measurement will sample one branch of the field.');
    recordMeasurement('superposition', coherence);
  }, [activeReadout, coherence, experimentMode, objects.length, recordMeasurement, tunnelChance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsRunning((current) => !current);
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        runExperiment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runExperiment]);

  const toggleEntanglement = useCallback((objectId: string) => {
    setObjects((current) => current.map((object) => {
      if (object.id !== objectId) return object;
      return {
        ...object,
        isEntangled: !object.isEntangled,
        entangledWith: object.isEntangled ? undefined : current.find((candidate) => candidate.id !== object.id)?.id,
      };
    }));
  }, []);

  const updateFrequency = useCallback((value: number[]) => {
    if (!selectedObject) return;
    setObjects((current) => current.map((object) => object.id === selectedObject ? { ...object, frequency: value[0] } : object));
  }, [selectedObject]);

  const handleCanvasPointer = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (event.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
    const nearest = objects.find((object) => Math.hypot(object.x - x, object.y - y) < object.amplitude + 18);

    if (nearest) {
      setSelectedObject(nearest.id);
      setStatusMessage(`${nearest.id.toUpperCase()} selected. Frequency ${nearest.frequency.toFixed(1)} Hz.`);
      return;
    }
    if (experimentMode === 'teleportation') addQuantumObject(x, y);
    else setStatusMessage('Canvas creation is available in teleportation mode. Switch modes to add new objects.');
  }, [addQuantumObject, experimentMode, objects]);


  return (
    <main className="experience-background min-h-screen overflow-hidden text-foreground">
      <section className="relative min-h-screen px-4 py-4 sm:px-6 lg:px-8">
        <nav className="topline-nav mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Waveform Shift Quantum</p>
              <p className="section-eyebrow mt-1">Vers3Dynamics resonance lab</p>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#scene" className="transition hover:text-foreground">Scene</a>
            <a href="#protocols" className="transition hover:text-foreground">Protocols</a>
            <a href="#controls" className="transition hover:text-foreground">Controls</a>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExperiment}>
            <Beaker className="h-4 w-4" />
            Run
          </Button>
        </nav>

        <div className="mx-auto grid min-h-[calc(100vh-92px)] max-w-[1700px] gap-8 py-6 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] lg:items-center xl:gap-12">
          <div className="hero-copy max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="instrument-mark">Interactive theory lab</span>
              <Badge variant="outline" className="border-white/15 bg-white/[0.03] text-muted-foreground">{activeExperiment.eyebrow}</Badge>
            </div>
            <h1 className="hero-title mt-6">Location is a waveform, not a place.</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              A cinematic phase-space instrument for testing how resonance, measurement, and entanglement shape apparent position.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button className="h-12 bg-primary px-5 text-primary-foreground hover:bg-primary/90" onClick={runExperiment}>
                <Beaker className="h-4 w-4" />
                Run {activeExperiment.label}
              </Button>
              <Button variant="outline" className="h-12 border-white/15 bg-white/[0.04] px-5 text-foreground hover:bg-white/[0.08] hover:text-foreground" onClick={() => addQuantumObject()}>
                <Plus className="h-4 w-4" />
                Add object
              </Button>
            </div>
            <div className="hero-stat-strip mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Coherence" value={formatPercent(coherence)} icon={Activity} tone="primary" />
              <Metric label="Entangled" value={String(entangledCount)} icon={Radio} tone="violet" />
              <Metric label={activeExperiment.readoutLabel} value={formatPercent(activeReadout)} icon={Gauge} tone="lime" />
              <Metric label="Phase delta" value={`${phaseDelta} deg`} icon={Waves} tone="copper" />
            </div>
          </div>

          <section id="scene" className="scene-showcase min-w-0 overflow-hidden">
            <div className="scene-topbar flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="section-eyebrow">Live resonance scene</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{activeExperiment.label} field</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground" onClick={() => setIsRunning((current) => !current)}>
                  {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isRunning ? 'Pause' : 'Resume'}
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExperiment}>
                  <Beaker className="h-4 w-4" />
                  Run
                </Button>
              </div>
            </div>

            <div className="scene-canvas relative min-h-[540px] overflow-hidden bg-quantum-field">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                aria-label="Interactive quantum field simulation canvas"
                className="absolute inset-0 h-full w-full cursor-crosshair"
                onClick={handleCanvasPointer}
              />

              {selectedObj && (
                <div
                  className="absolute z-10 max-w-[16rem] rounded-md border border-primary/25 bg-background/85 p-3 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-200"
                  style={{
                    left: `${(selectedObj.x / CANVAS_WIDTH) * 100}%`,
                    top: `${(selectedObj.y / CANVAS_HEIGHT) * 100}%`,
                    transform: 'translate(-50%, -120%)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-[0.7rem] font-bold">
                      {selectedObj.id.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="section-eyebrow">Frequency</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Slider className="w-28" value={[selectedObj.frequency]} onValueChange={updateFrequency} min={0.5} max={5} step={0.1} />
                        <span className="font-mono text-xs text-primary">{selectedObj.frequency.toFixed(1)}Hz</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute left-3 top-3 z-10 space-y-2">
                <ReadoutPill label="Mode" value={activeExperiment.label} />
                <ReadoutPill label="Time" value={`${time.toFixed(2)}s`} />
              </div>
              <div className="pointer-events-none absolute right-3 top-3 z-10 space-y-2 text-right">
                <ReadoutPill label="Objects" value={String(objects.length)} />
                <ReadoutPill label="Field" value={fieldIntensity[0].toFixed(1)} />
              </div>
              {measurementMode && (
                <div className="absolute bottom-3 left-3 z-10 rounded-md border border-lime/35 bg-lime/[0.12] px-3 py-2 text-xs font-medium text-lime-foreground shadow-lg shadow-black/30 backdrop-blur-md">
                  Measurement active
                </div>
              )}
              <div className="absolute bottom-3 right-3 z-10 lg:hidden">
                <Button className="h-11 rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90" onClick={() => setControlsOpen(true)}>
                  <ChevronRight className="h-4 w-4" />
                  Controls
                </Button>
              </div>
            </div>

            <div className="grid gap-4 border-t border-white/10 bg-white/[0.025] p-4 md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <p className="section-eyebrow">Observation log</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{statusMessage}</p>
              </div>
              <MeasurementSparkline measurements={measurements} />
            </div>
          </section>
        </div>
      </section>

      <section id="protocols" className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1700px]">
          <div className="section-intro">
            <p className="section-eyebrow">Experiment catalogue</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-foreground sm:text-5xl">Four ways to bend the location variable.</h2>
          </div>
          <div className="mode-gallery mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {modeOrder.map((mode) => {
              const definition = experiments[mode];
              return (
                <ModeButton
                  key={mode}
                  definition={definition}
                  active={experimentMode === mode}
                  onSelect={() => {
                    setExperimentMode(mode);
                    setStatusMessage(`${definition.label} protocol loaded. ${definition.premise}`);
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section id="controls" className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="control-studio mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)_minmax(320px,0.55fr)]">
          <section className="instrument-panel p-5">
            <PanelHeader eyebrow="Briefing" title={activeExperiment.label} icon={activeExperiment.icon} />
            <p className="mt-5 text-sm leading-7 text-muted-foreground">{activeExperiment.premise}</p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{activeExperiment.instruction}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <DetailRow label="Readout" value={formatPercent(activeReadout)} />
              <DetailRow label="Coherence" value={formatPercent(coherence)} />
              <DetailRow label="Objects" value={String(objects.length)} />
              <DetailRow label="Phase" value={`${phaseDelta} deg`} />
            </div>
          </section>

          <section className="instrument-panel p-5">
            <div className="flex items-center justify-between gap-2">
              <PanelHeader eyebrow="Tuning" title="Field controls" icon={Waves} />
              <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground" onClick={resetExperiment}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
            <div className="mt-6 space-y-5">
              <LabSlider icon={Waves} label="Field intensity" value={fieldIntensity} onValueChange={setFieldIntensity} min={0.1} max={1} step={0.1} display={fieldIntensity[0].toFixed(1)} />
              <LabSlider icon={Zap} label="Wave speed" value={waveSpeed} onValueChange={setWaveSpeed} min={0.1} max={3} step={0.1} display={`${waveSpeed[0].toFixed(1)}x`} />
              <LabSlider icon={Atom} label="Particle traces" value={particleCount} onValueChange={setParticleCount} min={5} max={60} step={5} display={String(particleCount[0])} />
              {experimentMode === 'tunneling' && (
                <LabSlider icon={Target} label="Barrier height" value={barrierHeight} onValueChange={setBarrierHeight} min={10} max={100} step={5} display={String(barrierHeight[0])} />
              )}
              {selectedObj && (
                <LabSlider icon={Radio} label={`${selectedObj.id.toUpperCase()} frequency`} value={[selectedObj.frequency]} onValueChange={updateFrequency} min={0.5} max={5} step={0.1} display={`${selectedObj.frequency.toFixed(1)} Hz`} />
              )}
            </div>
          </section>

          <section className="instrument-panel p-5">
            <PanelHeader eyebrow="Operations" title="Objects and runs" icon={Activity} />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExperiment}>
                <Beaker className="h-4 w-4" />
                Run
              </Button>
              <Button variant="outline" className="border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground" onClick={() => addQuantumObject()}>
                <Plus className="h-4 w-4" />
                Add object
              </Button>
              <Button variant={showTraces ? 'default' : 'outline'} className={showTraces ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground'} onClick={() => setShowTraces((current) => !current)}>
                {showTraces ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Traces
              </Button>
              <Button variant={measurementMode ? 'default' : 'outline'} className={measurementMode ? 'bg-lime text-accent-foreground hover:bg-lime/90' : 'border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground'} onClick={() => setMeasurementMode((current) => !current)}>
                <BarChart3 className="h-4 w-4" />
                Measure
              </Button>
            </div>
            <div className="mt-6 space-y-2">
              {objects.map((object, index) => (
                <ObjectRow key={object.id} object={object} index={index} selected={selectedObject === object.id} onSelect={() => setSelectedObject(object.id)} onToggle={() => toggleEntanglement(object.id)} />
              ))}
            </div>
          </section>
        </div>
      </section>

      {controlsOpen && (
        <button type="button" aria-label="Close controls panel" className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setControlsOpen(false)} />
      )}

      <aside
        role={controlsOpen ? 'dialog' : undefined}
        aria-modal={controlsOpen ? true : undefined}
        aria-hidden={!controlsOpen}
        aria-label="Experiment controls"
        className={`instrument-panel fixed inset-y-0 right-0 z-40 flex w-full max-w-[430px] flex-col overflow-y-auto p-4 shadow-2xl shadow-black/60 transition-transform lg:hidden ${controlsOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <PanelHeader eyebrow="Controls" title="Instrument rack" icon={Gauge} />
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setControlsOpen(false)}>
            <ChevronRight className="h-4 w-4 rotate-180" />
            Close
          </Button>
        </div>
        <div className="space-y-6">
          <section>
            <PanelHeader eyebrow="Protocol" title="Experiment set" icon={Beaker} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {modeOrder.map((mode) => {
                const definition = experiments[mode];
                return (
                  <ModeButton key={mode} definition={definition} active={experimentMode === mode} compact onSelect={() => {
                    setExperimentMode(mode);
                    setStatusMessage(`${definition.label} protocol loaded. ${definition.premise}`);
                  }} />
                );
              })}
            </div>
          </section>
          <section className="border-t border-white/10 pt-5">
            <PanelHeader eyebrow="Tuning" title="Field controls" icon={Waves} />
            <div className="mt-5 space-y-5">
              <LabSlider icon={Waves} label="Field intensity" value={fieldIntensity} onValueChange={setFieldIntensity} min={0.1} max={1} step={0.1} display={fieldIntensity[0].toFixed(1)} />
              <LabSlider icon={Zap} label="Wave speed" value={waveSpeed} onValueChange={setWaveSpeed} min={0.1} max={3} step={0.1} display={`${waveSpeed[0].toFixed(1)}x`} />
              <LabSlider icon={Atom} label="Particle traces" value={particleCount} onValueChange={setParticleCount} min={5} max={60} step={5} display={String(particleCount[0])} />
            </div>
          </section>
          <section className="border-t border-white/10 pt-5">
            <PanelHeader eyebrow="Operations" title="Run controls" icon={Activity} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExperiment}><Beaker className="h-4 w-4" />Run</Button>
              <Button variant="outline" className="border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground" onClick={() => addQuantumObject()}><Plus className="h-4 w-4" />Add object</Button>
              <Button variant={showTraces ? 'default' : 'outline'} className={showTraces ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground'} onClick={() => setShowTraces((current) => !current)}>{showTraces ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}Traces</Button>
              <Button variant={measurementMode ? 'default' : 'outline'} className={measurementMode ? 'bg-lime text-accent-foreground hover:bg-lime/90' : 'border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:text-foreground'} onClick={() => setMeasurementMode((current) => !current)}><BarChart3 className="h-4 w-4" />Measure</Button>
            </div>
          </section>
        </div>
      </aside>
    </main>
  );
};
const BrandMark: React.FC = () => (
  <div className="brand-mark" aria-hidden="true">
    <span className="brand-mark__ring" />
    <span className="brand-mark__axis brand-mark__axis--x" />
    <span className="brand-mark__axis brand-mark__axis--y" />
    <span className="brand-mark__text">WQ</span>
  </div>
);
interface MetricProps {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: 'primary' | 'copper' | 'lime' | 'violet';
}

const metricToneStyles: Record<NonNullable<MetricProps['tone']>, string> = {
  primary: 'border-primary/25 bg-primary/[0.08] text-primary',
  copper: 'border-copper/30 bg-copper/[0.10] text-copper-foreground',
  lime: 'border-lime/25 bg-lime/[0.09] text-lime-foreground',
  violet: 'border-violet/25 bg-violet/[0.10] text-violet-foreground',
};

const Metric: React.FC<MetricProps> = ({ label, value, icon: Icon, tone = 'primary' }) => (
  <div className={`rounded-md border p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)] backdrop-blur ${metricToneStyles[tone]}`}>
    <div className="flex items-center justify-between gap-2 text-muted-foreground">
      <span className="section-eyebrow">{label}</span>
      <Icon className="h-4 w-4" />
    </div>
    <p className="mt-2 font-mono text-lg text-foreground">{value}</p>
  </div>
);

interface PanelHeaderProps {
  eyebrow: string;
  title: string;
  icon: React.ElementType;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ eyebrow, title, icon: Icon }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="section-eyebrow">{eyebrow}</p>
      <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{title}</h3>
    </div>
  </div>
);

interface ModeButtonProps {
  definition: ExperimentDefinition;
  active: boolean;
  compact?: boolean;
  onSelect: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ definition, active, compact = false, onSelect }) => {
  const Icon = definition.icon;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`w-full rounded-md border p-3 text-left transition ${active ? 'border-primary/50 bg-primary/[0.12] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]' : 'border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:bg-white/[0.04]'}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{definition.label}</p>
          {!compact && <p className="mt-1 text-xs leading-5 text-muted-foreground">{definition.eyebrow}</p>}
        </div>
      </div>
    </button>
  );
};

interface ObjectRowProps {
  object: QuantumObject;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

const ObjectRow: React.FC<ObjectRowProps> = ({ object, index, selected, onSelect, onToggle }) => (
  <div className={`rounded-md border p-3 transition ${selected ? 'border-copper/50 bg-copper/[0.10]' : 'border-white/10 bg-black/20'}`}>
    <button type="button" onClick={onSelect} className="w-full text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">Object {index + 1}: {object.id.toUpperCase()}</p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{object.frequency.toFixed(1)} Hz | ({Math.round(object.x)}, {Math.round(object.y)})</p>
        </div>
        <Badge className={object.isEntangled ? 'bg-violet/[0.14] text-violet-foreground hover:bg-violet/[0.14]' : 'bg-white/[0.06] text-muted-foreground hover:bg-white/[0.06]'}>
          {object.isEntangled ? 'Linked' : 'Free'}
        </Badge>
      </div>
    </button>
    <div className="mt-3 flex justify-end">
      <Button size="sm" variant="outline" className="h-8 border-white/15 bg-white/[0.04] text-xs text-foreground hover:bg-white/[0.08] hover:text-foreground" onClick={onToggle}>
        {object.isEntangled ? 'Unlink' : 'Entangle'}
      </Button>
    </div>
  </div>
);

interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <div className="rounded-md border border-white/10 bg-black/20 p-3">
    <p className="section-eyebrow">{label}</p>
    <p className="mt-2 font-mono text-sm text-foreground">{value}</p>
  </div>
);

interface MeasurementSparklineProps {
  measurements: Measurement[];
}

const MeasurementSparkline: React.FC<MeasurementSparklineProps> = ({ measurements }) => {
  const recent = measurements.slice(-20);
  const points = recent
    .map((measurement, index) => `${(index / Math.max(1, recent.length - 1)) * 100},${44 - measurement.value * 40}`)
    .join(' ');
  const latest = recent[recent.length - 1];

  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-eyebrow">Readout Trace</p>
        <span className="font-mono text-xs text-primary">{latest ? formatPercent(latest.value) : '--'}</span>
      </div>
      <svg className="mt-3 h-12 w-full text-primary" viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="Recent measurement readouts">
        <line x1="0" y1="22" x2="100" y2="22" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />
        {recent.length > 1 ? (
          <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
        ) : (
          <line x1="0" y1="36" x2="100" y2="36" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
        )}
      </svg>
    </div>
  );
};

interface ReadoutPillProps {
  label: string;
  value: string;
}

const ReadoutPill: React.FC<ReadoutPillProps> = ({ label, value }) => (
  <div className="rounded-md border border-white/10 bg-background/70 px-3 py-2 text-xs shadow-lg shadow-black/30 backdrop-blur-md">
    <span className="text-muted-foreground">{label}</span>
    <span className="ml-2 font-mono text-primary">{value}</span>
  </div>
);

interface LabSliderProps {
  icon: React.ElementType;
  label: string;
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}

const LabSlider: React.FC<LabSliderProps> = ({ icon: Icon, label, value, onValueChange, min, max, step, display }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3">
      <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{label}</span>
      </label>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{display}</span>
    </div>
    <Slider aria-label={label} value={value} onValueChange={onValueChange} min={min} max={max} step={step} />
  </div>
);
