import { useMemo, useState } from "react";
import { capitalPosition } from "./accounting";
import type { SimulationSnapshot } from "./types";
import { money } from "./exports";
type NetworkLayer =
  "funding" | "payments" | "margin" | "facilities" | "ownership";
export function FinancialNetwork({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: SimulationSnapshot;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [layer, setLayer] = useState<NetworkLayer>("funding");
  const nodes = useMemo(
    () =>
      snapshot.actors.map((actor, i) => ({
        actor,
        x: 94 + (i % 4) * 188,
        y: 48 + Math.floor(i / 4) * 98,
      })),
    [snapshot.actors],
  );
  const positions = new Map(nodes.map((n) => [n.actor.id, n]));
  const edges = snapshot.networkEdges.filter((e) => e.layer === layer);
  const height = Math.max(410, 100 + (Math.ceil(nodes.length / 4) - 1) * 98);
  return (
    <section className="desk-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CURRENT SYSTEM</p>
          <h2>Where does pressure travel?</h2>
        </div>
        <label className="compact-label">
          Network layer
          <select
            aria-label="Network layer"
            value={layer}
            onChange={(e) => setLayer(e.target.value as NetworkLayer)}
          >
            {(
              [
                "funding",
                "payments",
                "margin",
                "facilities",
                "ownership",
              ] as const
            ).map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="desk-note">
        {layer === "funding"
          ? "Arrows point from creditor to debtor. Line width represents remaining contractual exposure."
          : layer === "ownership"
            ? "Ownership relationships are synthetic. Cross-border funding restrictions are separate contractual assumptions."
            : layer === "margin"
              ? "Line width represents contractual notional, not current margin due."
              : "Arrows follow the direction of payment or facility support."}{" "}
        Select an institution to inspect its accounts.
      </p>
      <div className="network-scroll">
        <svg
          viewBox={`0 0 755 ${height}`}
          role="group"
          aria-label={`${layer} network at hour ${snapshot.hour}, round ${snapshot.round}`}
          className="financial-network"
        >
          <defs>
            <marker
              id="financial-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L6,3 L0,6" fill="#738982" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = positions.get(e.from),
              b = positions.get(e.to);
            if (!a || !b) return null;
            return (
              <path
                key={e.id}
                d={`M${a.x},${a.y + 12} Q${(a.x + b.x) / 2 + 18},${(a.y + b.y) / 2 + 22} ${b.x},${b.y - 20}`}
                fill="none"
                stroke={
                  selected === e.from || selected === e.to
                    ? "#08695a"
                    : "#748b82"
                }
                strokeWidth={
                  layer === "ownership" ? 1.5 : Math.min(5, 1 + e.amount / 50)
                }
                opacity={selected === e.from || selected === e.to ? 0.65 : 0.25}
                markerEnd="url(#financial-arrow)"
              >
                <title>
                  {e.from} → {e.to}: {money(e.amount)}
                </title>
              </path>
            );
          })}
          {nodes.map(({ actor: a, x, y }) => {
            const capital = capitalPosition(a);
            const danger = capital.state !== "SOLVENT";
            return (
              <g
                key={a.id}
                transform={`translate(${x},${y})`}
                tabIndex={0}
                role="button"
                aria-label={`Inspect ${a.name}, ${capital.state}`}
                onClick={() => onSelect(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(a.id);
                  }
                }}
                className="network-node"
              >
                <rect
                  x="-80"
                  y="-24"
                  width="160"
                  height="58"
                  rx="5"
                  fill={
                    selected === a.id
                      ? "#143e35"
                      : danger
                        ? "#fce8e1"
                        : "#f9faf6"
                  }
                  stroke={
                    selected === a.id
                      ? "#143e35"
                      : danger
                        ? "#b5442c"
                        : "#bbc8bd"
                  }
                  strokeWidth="1.5"
                />
                <text
                  textAnchor="middle"
                  y="-3"
                  fill={selected === a.id ? "#fff" : "#1a3029"}
                  fontSize="12"
                  fontWeight="600"
                >
                  {a.name}
                </text>
                <text
                  textAnchor="middle"
                  y="15"
                  fill={
                    selected === a.id
                      ? "#cfdfd4"
                      : danger
                        ? "#9b2c19"
                        : "#456353"
                  }
                  fontSize="10"
                >
                  {danger
                    ? capital.state.replace(/_/g, " ")
                    : money(a.balanceSheet.assets.reserves)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="desk-note">
        Node subtitle: settlement balances, or capital status when impaired.
        Select a round in the propagation timeline to inspect changing balances.
      </p>
    </section>
  );
}
