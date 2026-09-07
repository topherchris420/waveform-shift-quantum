import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ARFRSimState } from '@/lib/arfr/types';

interface ARFR3DCanvasProps {
  simState: ARFRSimState;
  onPauseToggle?: () => void;
  isRunning?: boolean;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 560;

/**
 * Interactive 3D Canvas for the Adaptive Resonant Field Router (ARFR).
 * Renders stationary field sources, emergent resonance potential, moving resonance pocket,
 * charged particles, trails, target trajectory, energy flows, and controller lock status.
 */
export const ARFR3DCanvas: React.FC<ARFR3DCanvasProps> = ({
  simState,
  onPauseToggle,
  isRunning = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotAngleRef = useRef({ yaw: 0.4, pitch: 0.35 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // 3D to 2D projection with isometric perspective
  const project3D = useCallback((x: number, y: number, z: number) => {
    const { yaw, pitch } = rotAngleRef.current;
    // Rotate around Y (yaw)
    const x1 = x * Math.cos(yaw) - x * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);

    // Rotate around X (pitch)
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);

    const scale = 110 / (1 + z2 * 0.15);
    const screenX = CANVAS_WIDTH / 2 + x1 * scale;
    const screenY = CANVAS_HEIGHT / 2 - y2 * scale;

    return { screenX, screenY, depth: z2 };
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.addColorStop(0, '#060913');
    bg.addColorStop(0.5, '#0b1120');
    bg.addColorStop(1, '#02040a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw 3D Grid Plane (Z = 0)
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.25)';
    ctx.lineWidth = 1;

    for (let g = -3.0; g <= 3.0; g += 0.5) {
      const p1 = project3D(g, -3.0, 0);
      const p2 = project3D(g, 3.0, 0);
      ctx.beginPath();
      ctx.moveTo(p1.screenX, p1.screenY);
      ctx.lineTo(p2.screenX, p2.screenY);
      ctx.stroke();

      const p3 = project3D(-3.0, g, 0);
      const p4 = project3D(3.0, g, 0);
      ctx.beginPath();
      ctx.moveTo(p3.screenX, p3.screenY);
      ctx.lineTo(p4.screenX, p4.screenY);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Draw Target Trajectory
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const routeWaypoints = simState.route.waypoints;
    if (routeWaypoints.length > 0) {
      for (let tStep = 0; tStep <= 10; tStep += 0.2) {
        const p1 = routeWaypoints[0];
        const p2 = routeWaypoints[routeWaypoints.length - 1];
        const frac = tStep / 10;
        const tx = p1.x + (p2.x - p1.x) * frac;
        const ty = p1.y + (p2.y - p1.y) * frac;
        const proj = project3D(tx, ty, 0);
        if (tStep === 0) ctx.moveTo(proj.screenX, proj.screenY);
        else ctx.lineTo(proj.screenX, proj.screenY);
      }
    }
    ctx.stroke();
    ctx.restore();

    // 3. Draw Target Position Marker
    const targetProj = project3D(
      simState.controllerState.targetPosition.x,
      simState.controllerState.targetPosition.y,
      simState.controllerState.targetPosition.z
    );
    ctx.save();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetProj.screenX, targetProj.screenY, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(targetProj.screenX, targetProj.screenY, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();
    ctx.restore();

    // 4. Draw Physical Field Sources (Fixed Hardware)
    simState.sources.forEach((source) => {
      const proj = project3D(source.position.x, source.position.y, source.position.z);

      // Hardware base cylinder / coil
      ctx.save();
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(proj.screenX, proj.screenY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Source label
      ctx.font = '10px ui-monospace, JetBrains Mono, monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(source.id, proj.screenX - 18, proj.screenY + 22);

      // Rotation indicator ring
      ctx.beginPath();
      const rotRadius = 16 + Math.sin(simState.time * 5) * 2;
      ctx.arc(proj.screenX, proj.screenY, rotRadius, 0, Math.PI * 2);
      ctx.strokeStyle = source.angularVelocity >= 0 ? '#22c55e' : '#eab308';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    });

    // 5. Draw Emergent Resonance Pockets (Field-defined Container)
    simState.pockets.forEach((pocket) => {
      const proj = project3D(pocket.centroid.x, pocket.centroid.y, pocket.centroid.z);

      ctx.save();
      const radius = Math.cbrt(pocket.volume + 1e-6) * 35;

      // Glow gradient for resonance potential
      const radGrad = ctx.createRadialGradient(
        proj.screenX,
        proj.screenY,
        0,
        proj.screenX,
        proj.screenY,
        radius
      );
      radGrad.addColorStop(0, 'rgba(168, 85, 247, 0.7)');
      radGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.25)');
      radGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(proj.screenX, proj.screenY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Pocket boundary ring
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(proj.screenX, proj.screenY, radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#f3e8ff';
      ctx.font = '11px ui-monospace, JetBrains Mono, monospace';
      ctx.fillText(`POCKET R=${pocket.peakPotential.toFixed(2)}`, proj.screenX - 35, proj.screenY - radius - 6);
      ctx.restore();
    });

    // 6. Draw Charged Particles Response
    simState.particles.forEach((p) => {
      const proj = project3D(p.position.x, p.position.y, p.position.z);

      ctx.save();
      ctx.fillStyle = p.pocketId ? '#22c55e' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(proj.screenX, proj.screenY, p.pocketId ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 7. Overlay HUD: Demonstrative Core Principle Statement
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(16, 16, 420, 64);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, 420, 64);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px ui-monospace, JetBrains Mono, monospace';
    ctx.fillText('CORE PRINCIPLE DEMONSTRATION:', 26, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('“The machine did not move. Its field geometry did.”', 26, 56);
    ctx.restore();
  }, [project3D, simState]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Orbit navigation event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    rotAngleRef.current.yaw += dx * 0.005;
    rotAngleRef.current.pitch = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, rotAngleRef.current.pitch + dy * 0.005)
    );
    drawCanvas();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/90 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-[12px] font-semibold text-slate-200">
            ARFR 3D FIELD WORKSPACE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-slate-700 bg-slate-800/80 font-mono text-[11px] text-slate-200 hover:bg-slate-700"
            onClick={() => {
              rotAngleRef.current = { yaw: 0.4, pitch: 0.35 };
              drawCanvas();
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> RESET VIEW
          </Button>
          {onPauseToggle && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-slate-700 bg-slate-800/80 font-mono text-[11px] text-slate-200 hover:bg-slate-700"
              onClick={onPauseToggle}
            >
              {isRunning ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
              {isRunning ? 'PAUSE' : 'PLAY'}
            </Button>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="block h-auto w-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
