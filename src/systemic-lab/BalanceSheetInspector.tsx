import { useMemo } from "react";
import { assets, liabilities, capitalPosition } from "./accounting";
import { CollateralEngine } from "./collateral";
import { money, pct } from "./exports";
import type {
  FinancialInstitution,
  PolicySimulationResult,
  SimulationSnapshot,
} from "./types";
export function BalanceSheetInspector({
  institution,
  initial,
  snapshot,
  result,
}: {
  institution: FinancialInstitution;
  initial: FinancialInstitution;
  snapshot: SimulationSnapshot;
  result: PolicySimulationResult;
}) {
  const bs = institution.balanceSheet,
    c = capitalPosition(institution),
    collateral = CollateralEngine.inspect(institution);
  const relationships = snapshot.networkEdges.filter(
    (edge) => edge.from === institution.id || edge.to === institution.id,
  );
  const paymentObligations = relationships.filter(
    (edge) => edge.layer === "payments",
  );
  const events = useMemo(
    () =>
      result.events
        .filter(
          (e) =>
            (e.actorId === institution.id ||
              e.postings.some((p) => p.actorId === institution.id)) &&
            (e.hour < snapshot.hour ||
              (e.hour === snapshot.hour && e.round <= snapshot.round)),
        )
        .slice(-12)
        .reverse(),
    [institution.id, result.events, snapshot.hour, snapshot.round],
  );
  return (
    <section className="desk-panel balance-inspector">
      <p className="eyebrow">INSTITUTION INSPECTOR</p>
      <h2>{institution.name}</h2>
      <p className="desk-note">
        {institution.type} · {institution.jurisdiction} ·{" "}
        {c.state.replace(/_/g, " ")}
      </p>
      <div className="accounting-check">
        <span>Accounting identity</span>
        <strong>
          {money(assets(bs))} = {money(liabilities(bs))} + {money(bs.equity)}
        </strong>
      </div>
      <div className="account-columns">
        {(["assets", "liabilities"] as const).map((group) => (
          <div key={group}>
            <h3>{group}</h3>
            <dl>
              {Object.entries(bs[group])
                .filter(
                  ([key, value]) =>
                    value !== 0 ||
                    initial.balanceSheet[group][
                      key as keyof (typeof bs)[typeof group]
                    ] !== 0,
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                    <dd>
                      {money(value)}
                      <small>
                        Δ{" "}
                        {money(
                          value -
                            (initial.balanceSheet[group][
                              key as keyof (typeof bs)[typeof group]
                            ] ?? 0),
                        )}
                      </small>
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="inspector-stats">
        <div>
          <span>Available liquidity</span>
          <b>{money(snapshot.liquidityPositions[institution.id].available)}</b>
        </div>
        <div>
          <span>Liquidity shortfall</span>
          <b>{money(snapshot.liquidityPositions[institution.id].shortfall)}</b>
        </div>
        <div>
          <span>Equity / assets</span>
          <b>{pct(c.equityAssets)}</b>
        </div>
        <div>
          <span>Capital buffer</span>
          <b>{money(c.buffer)}</b>
        </div>
        <div>
          <span>Facility borrowing</span>
          <b>{money(bs.liabilities.centralBankBorrowing)}</b>
        </div>
        <div>
          <span>Available collateral</span>
          <b>{money(collateral.available)}</b>
        </div>
        <div>
          <span>Pledged collateral</span>
          <b>{money(collateral.pledged)}</b>
        </div>
      </div>
      <p className="desk-note">
        Capital measures are simulation proxies. They are not official
        regulatory calculations.
      </p>
      <details>
        <summary>
          Counterparties and obligations · {relationships.length} current links
        </summary>
        <p className="desk-note">
          {paymentObligations.length} due payment obligations are visible at
          this hour and propagation round.
        </p>
        <ul className="relationship-list">
          {relationships.map((edge) => (
            <li key={`${edge.layer}:${edge.id}:${edge.from}:${edge.to}`}>
              <strong>{edge.layer.replace(/-/g, " ")}</strong>
              <span>
                {edge.from} → {edge.to}
                {edge.layer === "ownership" ? "" : ` · ${money(edge.amount)}`}
              </span>
            </li>
          ))}
        </ul>
        {relationships.length === 0 ? (
          <p className="desk-note">No current network links.</p>
        ) : null}
      </details>
      <details>
        <summary>
          Why did this happen? · {events.length} recent mechanisms and shocks
        </summary>
        <ol className="explanation-chain">
          {events.map((e) => (
            <li key={e.id}>
              <strong>
                {e.mechanism.replace(/-/g, " ")} ·{" "}
                {e.units === "USD million"
                  ? money(e.amount)
                  : e.amount.toFixed(3)}
              </strong>
              <span>
                Hour {e.hour}, round {e.round}. {e.calculation}
              </span>
            </li>
          ))}
        </ol>
        {events.length === 0 ? (
          <p className="desk-note">
            No recorded changes for this institution at this observation.
          </p>
        ) : null}
      </details>
    </section>
  );
}
