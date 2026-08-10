import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import type { EpistemicClass } from '@/lib/epistemics';

export type SceneMode =
  | 'scalar_kernel'
  | 'signatures'
  | 'classical_limit'
  | 'teleportation'
  | 'interference'
  | 'superposition';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 520;

interface ResonanceNode {
  x: number;
  y: number;
  intensity: number;
  phase: number;
}

interface InstrumentSceneProps {
  mode: SceneMode;
  fieldIntensity: number;
  couplingG: number;
  responseAlpha: number;
  phaseShift: number;
  /** Which epistemic class the rendered scene belongs to. */
  epistemicKind: EpistemicClass;
  caption: string;
}

/**
 * Supporting field scene for the comparison modes that are not the Reality
 * Split. Purely illustrative of the analytical expressions named in each
 * caption — it renders no claim that is not also stated numerically elsewhere.
 */
export const InstrumentScene: React.FC<InstrumentSceneProps> = ({
  mode,
  fieldIntensity,
  couplingG,
  responseAlpha,
  phaseShift,
  epistemicKind,
  caption,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const timeRef = useRef(0);
  const lastRef = useRef(0);
  const [isRunning, setIsRunning] = useState(true);

  const resonanceNodes = useMemo<ResonanceNode[]>(() => {
    const nodes: ResonanceNode[] = [];
    // Deterministic lattice so the backdrop is reproducible between sessions.
    let s = 1;
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    for (let x = 0; x <= CANVAS_WIDTH; x += 48) {
      for (let y = 0; y <= CANVAS_HEIGHT; y += 48) {
        nodes.push({ x, y, intensity: 0.16 + rand() * 0.24, phase: rand() * Math.PI * 2 });
      }
    }
    return nodes;
  }, []);

  const drawBackdrop = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const background = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      background.addColorStop(0, '#030712');
      background.addColorStop(0.52, '#07111d');
      background.addColorStop(1, '#101326');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.globalAlpha = 0.08 * fieldIntensity;
      for (let r = 50; r < 460; r += 60) {
        ctx.beginPath();
        ctx.arc(
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          r + Math.sin(t * 1.5 + r * 0.05) * 15,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.strokeStyle = 'rgba(78, 234, 255, 0.04)';
        ctx.stroke();
      }

      resonanceNodes.forEach((node) => {
        const intensity =
          node.intensity * fieldIntensity * (1 + 0.35 * Math.sin(t * 1.6 + node.phase));
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 46);
        gradient.addColorStop(0, `rgba(112, 232, 255, ${intensity * 0.16})`);
        gradient.addColorStop(1, 'rgba(112, 232, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(node.x - 46, node.y - 46, 92, 92);
      });
    },
    [fieldIntensity, resonanceNodes]
  );

  const drawScene = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawBackdrop(ctx, t);

      if (mode === 'scalar_kernel') {
        const startX = 100;
        const endX = 860;
        const baselineY = 400;
        const width = endX - startX;

        ctx.save();
        // Born density P_B(x) = |ψ|² — established physics.
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        for (let px = 0; px <= width; px += 4) {
          const x = startX + px;
          const normX = (px / width - 0.5) * 6;
          const pb = Math.exp(-normX * normX);
          const y = baselineY - pb * 170;
          if (px === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Kernel-biased density P_loc(x) — proposed model.
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        const driveShift = Math.sin(t * 1.5) * 1.5;
        for (let px = 0; px <= width; px += 4) {
          const x = startX + px;
          const normX = (px / width - 0.5) * 6;
          const pb = Math.exp(-normX * normX);
          const L = 1 / (1 + (normX - driveShift) ** 2);
          const chi = Math.exp(responseAlpha * L);
          const ploc = pb * chi * 0.5;
          const y = baselineY - ploc * 170;
          if (px === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.font = '12px ui-monospace, JetBrains Mono, monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('┄ Born density P_B(x) = |ψ(x)|²  [established]', startX + 10, 120);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(
          '━ Kernel-biased P_loc(x) = χ(x)|ψ|² / ∫χ|ψ|²  [proposed]',
          startX + 10,
          140
        );
        ctx.restore();
        return;
      }

      if (mode === 'signatures') {
        const startX = 140;
        const endX = 820;
        const midY = 270;
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(startX, midY);
        ctx.quadraticCurveTo(CANVAS_WIDTH / 2, midY - 110, endX, midY);
        ctx.stroke();
        ctx.strokeStyle = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(startX, midY);
        ctx.quadraticCurveTo(CANVAS_WIDTH / 2, midY + 110, endX, midY);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 15px Inter, sans-serif';
        ctx.fillText(
          `Predicted interferometric phase shift Δφ_φ = ${phaseShift.toFixed(4)} rad`,
          CANVAS_WIDTH / 2 - 190,
          midY - 130
        );
        ctx.restore();
        return;
      }

      if (mode === 'classical_limit') {
        const startX = 100;
        const width = 760;
        const baselineY = 420;
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let minX = startX + width / 2;
        let minY = baselineY;
        for (let px = 0; px <= width; px += 4) {
          const x = startX + px;
          const normX = (px / width - 0.5) * 6;
          const vBare = normX * normX;
          const phiVal = Math.cos(normX * 2 - t * 1.5) * fieldIntensity;
          const veff = vBare + couplingG * phiVal;
          const y = baselineY - veff * 32;
          if (px === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          if (y > minY) {
            minY = y;
            minX = x;
          }
        }
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(minX, minY - 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText('Effective potential V_eff(x,t) = V(x) + g φ(x,t)', startX + 10, 120);
        ctx.fillText(
          `Classical minimum x_cl = ${((minX - startX) / width).toFixed(3)}`,
          startX + 10,
          144
        );
        ctx.restore();
        return;
      }

      // Remaining modes use the field backdrop with a labelled centre marker.
      ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(caption, 60, 80);
    },
    [caption, couplingG, drawBackdrop, fieldIntensity, mode, phaseShift, responseAlpha]
  );

  useEffect(() => {
    const tick = (timestamp: number) => {
      const last = lastRef.current || timestamp;
      const delta = Math.min((timestamp - last) / 1000, 0.05);
      lastRef.current = timestamp;
      if (isRunning) timeRef.current += delta;
      drawScene(timeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [drawScene, isRunning]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/90">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <EpistemicTag kind={epistemicKind} />
          <span className="font-mono text-[11px] text-slate-300">Supporting field scene</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-slate-700 bg-slate-800/80 font-mono text-[11px] text-slate-200 hover:bg-slate-700"
          onClick={() => setIsRunning((value) => !value)}
        >
          {isRunning ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
          {isRunning ? 'PAUSE' : 'PLAY'}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label={caption}
        className="block h-auto w-full"
      />
      <p className="border-t border-slate-800 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
        {caption}
      </p>
    </div>
  );
};
