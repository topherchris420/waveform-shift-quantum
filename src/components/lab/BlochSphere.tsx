import React from 'react';

interface BlochSphereProps {
  theta: number; // polar angle [0, π]
  phi: number;   // azimuthal angle [0, 2π]
  size?: number;
  label?: string;
}

// 2D orthographic projection (view down +y). Enough to read polar/azimuth
// without pulling in three.js. Physicist-standard axes: z↑ (|0⟩), x→, y⊙.
export const BlochSphere: React.FC<BlochSphereProps> = ({ theta, phi, size = 180, label }) => {
  const R = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;

  // State vector components on the sphere.
  const sx = Math.sin(theta) * Math.cos(phi);
  const sy = Math.sin(theta) * Math.sin(phi);
  const sz = Math.cos(theta);

  // Project (x, z) with a subtle y-depth for perspective.
  const px = cx + sx * R;
  const py = cy - sz * R + sy * 6;

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Bloch sphere">
        <defs>
          <radialGradient id="bloch-fill" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.22)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.02)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="url(#bloch-fill)" stroke="hsl(var(--primary) / 0.45)" strokeWidth={1} />
        {/* Equator */}
        <ellipse cx={cx} cy={cy} rx={R} ry={R * 0.28} fill="none" stroke="hsl(var(--foreground) / 0.22)" strokeDasharray="2 4" />
        {/* Meridian */}
        <ellipse cx={cx} cy={cy} rx={R * 0.28} ry={R} fill="none" stroke="hsl(var(--foreground) / 0.14)" strokeDasharray="2 4" />
        {/* Axes */}
        <line x1={cx - R - 6} y1={cy} x2={cx + R + 6} y2={cy} stroke="hsl(var(--foreground) / 0.35)" strokeWidth={0.75} />
        <line x1={cx} y1={cy - R - 6} x2={cx} y2={cy + R + 6} stroke="hsl(var(--foreground) / 0.35)" strokeWidth={0.75} />
        <text x={cx + R + 8} y={cy + 3} fontFamily="ui-monospace" fontSize="9" fill="hsl(var(--muted-foreground))">x</text>
        <text x={cx - 4} y={cy - R - 8} fontFamily="ui-monospace" fontSize="9" fill="hsl(var(--muted-foreground))">|0⟩</text>
        <text x={cx - 6} y={cy + R + 14} fontFamily="ui-monospace" fontSize="9" fill="hsl(var(--muted-foreground))">|1⟩</text>
        {/* Vector */}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="hsl(var(--copper))" strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={px} cy={py} r={4.5} fill="hsl(var(--copper))" stroke="hsl(var(--foreground))" strokeWidth={0.6} />
      </svg>
      {label && <figcaption className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</figcaption>}
    </figure>
  );
};
