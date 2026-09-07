import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Compass,
  Download,
  Gauge,
  Layers,
  Lock,
  Play,
  RotateCw,
  Send,
  ShieldAlert,
  Sparkles,
  Split,
  Target,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ARFR3DCanvas } from './ARFR3DCanvas';
import { ARFREngine, ARFRSimState } from '@/lib/arfr/arfrEngine';
import { ControlMode, OperatingProfile, RouteType } from '@/lib/arfr/types';
import { generateARFRPassportRecord } from '@/lib/arfr/passport';

export const ARFRWorkspace: React.FC = () => {
  const engineRef = useRef<ARFREngine | null>(null);
  const [simState, setSimState] = useState<ARFRSimState | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('B');

  // Initialize ARFR engine
  useEffect(() => {
    const engine = new ARFREngine('ROUTE', 'LINE', 'BALANCED');
    engineRef.current = engine;
    setSimState(engine.getState());

    const interval = setInterval(() => {
      if (engineRef.current && isRunning) {
        const nextState = engineRef.current.step(0.05);
        setSimState({ ...nextState });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isRunning]);

  if (!simState) return null;

  const handleModeChange = (mode: ControlMode) => {
    if (!engineRef.current) return;
    engineRef.current.setMode(mode);
    setSimState({ ...engineRef.current.getState() });
  };

  const handleProfileChange = (profile: OperatingProfile) => {
    if (!engineRef.current) return;
    engineRef.current.setProfile(profile);
    setSimState({ ...engineRef.current.getState() });
  };

  const handleRouteTypeChange = (routeType: RouteType) => {
    if (!engineRef.current) return;
    engineRef.current.setRoute(routeType);
    setSimState({ ...engineRef.current.getState() });
  };

  const handleAddPerturbation = (type: 'velocity_impulse' | 'field_noise') => {
    if (!engineRef.current) return;
    engineRef.current.addPerturbation(type, 1.5, { x: 1, y: 0, z: 0 });
    setSimState({ ...engineRef.current.getState() });
  };

  const runBuiltInExperiment = (expKey: string) => {
    if (!engineRef.current) return;
    setSelectedExperiment(expKey);

    switch (expKey) {
      case 'A': // Static Pocket
        engineRef.current.setMode('HOLD');
        break;
      case 'B': // Translation (A -> B without moving hardware)
        engineRef.current.setMode('ROUTE');
        engineRef.current.setRoute('LINE');
        break;
      case 'C': // Circular Routing
        engineRef.current.setMode('ROUTE');
        engineRef.current.setRoute('CIRCLE');
        break;
      case 'D': // Disturbance Recovery
        engineRef.current.setMode('HOLD');
        engineRef.current.addPerturbation('velocity_impulse', 2.0, { x: 1, y: 1, z: 0 });
        break;
      case 'E': // Energy Optimization
        engineRef.current.setProfile('LOW_ENERGY');
        engineRef.current.setMode('ROUTE');
        engineRef.current.setRoute('FIGURE_EIGHT');
        break;
      case 'F': // Split
        engineRef.current.setMode('SPLIT');
        break;
      case 'G': // Merge
        engineRef.current.setMode('MERGE');
        break;
    }
    setSimState({ ...engineRef.current.getState() });
  };

  const handleExportPassport = async () => {
    if (!simState) return;
    const record = await generateARFRPassportRecord(
      {
        id: `exp_arfr_${Date.now()}`,
        name: `ARFR Experiment ${selectedExperiment}`,
        description: 'Adaptive Resonant Field Router simulation run',
        mode: simState.mode,
        profile: simState.profile,
        routeType: simState.route.type,
        sources: simState.sources,
        seed: 137,
      },
      simState.controllerState,
      simState.energyLedger,
      simState.retainedParticleCount / Math.max(simState.particles.length, 1),
      simState.time
    );

    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARFR-Passport-${record.results.reproducibilityHash.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lockBadgeStyle = {
    SEARCHING: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
    ACQUIRING: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
    LOCKED: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    RECOVERING: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
    LOST: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
  }[simState.controllerState.lockState];

  return (
    <div className="space-y-6">
      {/* Masthead */}
      <div className="rounded-xl border border-cyan-900/40 bg-slate-900/80 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-cyan-500/50 font-mono text-[10px] text-cyan-400">
                EXPERIMENTAL ARFR TECHNOLOGY
              </Badge>
              <Badge variant="outline" className={lockBadgeStyle}>
                <Lock className="mr-1 h-3 w-3 inline" />
                LOCK: {simState.controllerState.lockState}
              </Badge>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Adaptive Resonant Field Router
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Field-defined container and transport channels with stationary electromagnetic hardware sources.
            </p>
          </div>
          <Button
            onClick={handleExportPassport}
            className="border border-cyan-500/50 bg-cyan-950 text-cyan-200 hover:bg-cyan-900 font-mono text-[11px]"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> EXPORT PASSPORT RECORD
          </Button>
        </div>
      </div>

      {/* Main Grid: Sources | 3D Field Workspace | Adaptive Control */}
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Left Column: Fixed Hardware Sources */}
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              FIELD SOURCES (FIXED)
            </span>
            <Badge variant="outline" className="border-slate-700 font-mono text-[10px] text-slate-400">
              {simState.sources.length} SOURCES
            </Badge>
          </div>

          <div className="space-y-3">
            {simState.sources.map((s, idx) => (
              <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between font-mono text-[11px] text-cyan-300">
                  <span>{s.id}</span>
                  <span className="text-[10px] text-slate-500">ω = {s.frequency.toFixed(1)} rad/s</span>
                </div>
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>Phase φ</span>
                      <span>{(s.phase % (2 * Math.PI)).toFixed(2)} rad</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-slate-800 rounded">
                      <div
                        className="h-full bg-cyan-400 rounded"
                        style={{ width: `${((s.phase % (2 * Math.PI)) / (2 * Math.PI)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>Angular Speed</span>
                      <span>{s.angularVelocity.toFixed(1)} rad/s</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Column: Interactive 3D Field Canvas */}
        <div>
          <ARFR3DCanvas
            simState={simState}
            isRunning={isRunning}
            onPauseToggle={() => setIsRunning(!isRunning)}
          />
        </div>

        {/* Right Column: Controller & Metrics */}
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              ADAPTIVE CONTROL
            </span>
            <span className="font-mono text-[10px] text-emerald-400">
              {(simState.controllerState.lockQuality * 100).toFixed(0)}% QUALITY
            </span>
          </div>

          {/* Operating Profile Selection */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase text-slate-400">
              Operating Profile
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['PRECISION', 'BALANCED', 'LOW_ENERGY', 'MAX_CONFINEMENT'] as OperatingProfile[]).map(
                (prof) => (
                  <button
                    key={prof}
                    type="button"
                    onClick={() => handleProfileChange(prof)}
                    className={`rounded border px-2 py-1.5 font-mono text-[10px] transition ${
                      simState.profile === prof
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {prof}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Error & Energy Readout */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-slate-400">Positional Error</span>
              <span className="font-bold text-rose-400">
                {simState.controllerState.positionError.toFixed(3)} m
              </span>
            </div>
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-slate-400">Joules / Meter</span>
              <span className="text-cyan-300">
                {simState.energyLedger.joulesPerMeter.toFixed(2)} J/m
              </span>
            </div>
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-slate-400">Retained Particles</span>
              <span className="text-emerald-400">
                {simState.retainedParticleCount} / {simState.particles.length}
              </span>
            </div>
          </div>

          {/* Disturbances Injection */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase text-slate-400">
              Inject Disturbance
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddPerturbation('velocity_impulse')}
                className="w-full border-slate-700 bg-slate-950 text-[10px] text-rose-300 hover:bg-slate-800"
              >
                <ShieldAlert className="mr-1 h-3 w-3" /> IMPULSE
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddPerturbation('field_noise')}
                className="w-full border-slate-700 bg-slate-950 text-[10px] text-yellow-300 hover:bg-slate-800"
              >
                <Activity className="mr-1 h-3 w-3" /> NOISE
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Built-In Experiments Launcher */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <h3 className="mb-3 font-mono text-[12px] font-semibold text-slate-200 uppercase tracking-wider">
          BUILT-IN EXPERIMENTS (A–G)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { key: 'A', name: 'A: Static Pocket' },
            { key: 'B', name: 'B: Translation' },
            { key: 'C', name: 'C: Circular' },
            { key: 'D', name: 'D: Disturbance' },
            { key: 'E', name: 'E: Low Energy' },
            { key: 'F', name: 'F: Pocket Split' },
            { key: 'G', name: 'G: Pocket Merge' },
          ].map((exp) => (
            <button
              key={exp.key}
              type="button"
              onClick={() => runBuiltInExperiment(exp.key)}
              className={`rounded-lg border p-2.5 text-center font-mono text-[11px] font-semibold transition ${
                selectedExperiment === exp.key
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              {exp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
