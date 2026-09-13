import type { SimulationSnapshot } from "./types";
import { money } from "./exports";
export function TimelineChart({
  rows,
  index,
  onChange,
}: {
  rows: SimulationSnapshot[];
  index: number;
  onChange: (index: number) => void;
}) {
  const max = Math.max(
    1,
    ...rows.map((r) =>
      Math.max(r.metrics.liquidityShortfall, r.metrics.facilityUsage),
    ),
  );
  const width = 900,
    height = 145;
  const path = (key: "liquidityShortfall" | "facilityUsage") =>
    rows
      .map(
        (r, i) =>
          `${i ? "L" : "M"}${30 + (i / Math.max(1, rows.length - 1)) * (width - 45)},${height - 20 - (r.metrics[key] / max) * (height - 45)}`,
      )
      .join(" ");
  return (
    <section className="desk-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PROPAGATION</p>
          <h2>Shock. Response. Spillover.</h2>
        </div>
        <span className="observation-label">
          Hour {rows[index].hour} · round {rows[index].round}
        </span>
      </div>
      <svg
        className="timeline-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Liquidity shortfall and facility usage by recorded simulation observation"
      >
        <line x1="30" x2="885" y1="125" y2="125" stroke="#bbc8bd" />
        <text x="30" y="15" fontSize="11" fill="#456353">
          {money(max)}
        </text>
        <path
          d={path("liquidityShortfall")}
          fill="none"
          stroke="#ae442e"
          strokeWidth="2.5"
        />
        <path
          d={path("facilityUsage")}
          fill="none"
          stroke="#087360"
          strokeWidth="2.5"
        />
        <line
          x1={30 + (index / Math.max(1, rows.length - 1)) * (width - 45)}
          x2={30 + (index / Math.max(1, rows.length - 1)) * (width - 45)}
          y1="20"
          y2="125"
          stroke="#253e34"
          strokeDasharray="3 4"
        />
      </svg>
      <div className="chart-legend">
        <span className="shortfall-dot">Liquidity shortfall</span>
        <span className="facility-dot">Facility borrowing</span>
        <span>Recorded observations; time steps and rounds are discrete</span>
      </div>
      <label className="timeline-control">
        Inspect a simulation observation
        <input
          aria-label="Simulation observation"
          type="range"
          min="0"
          max={rows.length - 1}
          value={index}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    </section>
  );
}
