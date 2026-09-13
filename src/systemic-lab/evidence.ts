import type { ParameterEvidence, Scenario, SystemicState } from "./types";

/** Validate and return parameter paths for an event's provenance link. */
export function evidencePaths(
  state: Pick<SystemicState, "evidence">,
  ...paths: string[]
): string[] {
  if (!state.evidence.length) return [];
  const known = new Set(state.evidence.map((e) => e.id));
  for (const path of paths)
    if (!known.has(path))
      throw new Error(`Missing parameter evidence: ${path}`);
  return paths;
}
/** Registry values always describe the current input, never a stale pre-edit slider value. */
export function reconcileEvidence(s: Scenario): ParameterEvidence[] {
  const existing = new Map(s.evidence.map((e) => [e.id, e]));
  const rows: ParameterEvidence[] = [];
  const units = (path: string) =>
    /Bps$/.test(path)
      ? "basis points"
      : /Hours?$/.test(path)
        ? "hours"
        : /Years$/.test(path)
          ? "years"
          : path.startsWith("physical.")
            ? "resource units"
            : /(balanceSheet|principal|securedAmount|transferLimit|marketDepth|borrowingCap|counterpartyLimit|capacity|liquidityBuffer|initialMargin|postedInitialMargin|notional|\.amount|\.remaining|\.settled|writtenOff)/.test(
                  path,
                )
              ? "USD million"
              : /(seed|maxRounds|priority|liquidityTier|maxRenewals)/.test(path)
                ? "count"
                : /(price|Price)$/.test(path)
                  ? "USD million per asset unit"
                  : /quantity|pledges/.test(path)
                    ? "asset units"
                    : "fraction or dimensionless coefficient";
  const walk = (value: unknown, path: string) => {
    if (typeof value === "number") {
      const old = existing.get(path),
        changed = old && old.value !== value;
      rows.push(
        old && !changed
          ? old
          : {
              id: path,
              value,
              units: old?.units ?? units(path),
              lower: Math.min(old?.lower ?? 0, value),
              upper: Math.max(old?.upper ?? 1, value),
              source: changed
                ? "Researcher-modified scenario input"
                : "Synthetic or user-supplied scenario assumption; no source calibration attached",
              sourceDate: s.provenance.sourceVintage,
              calibrationType: changed ? "EXPERIMENTAL" : "STYLIZED_ASSUMPTION",
              confidence: 0,
              notes: changed
                ? `Changed from ${old.value}; earlier calibration metadata does not establish support for this value.`
                : "Value from current scenario. No empirical calibration claim.",
            },
      );
      existing.delete(path);
    } else if (Array.isArray(value))
      value.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value))
        if (k !== "evidence") walk(v, path ? `${path}.${k}` : k);
  };
  walk(s, "");
  // Non-path evidence (e.g., public scenario observations) remains provenance, never a parameter override.
  const referenced = new Set(s.shocks.flatMap((shock) => shock.evidenceIds));
  for (const e of existing.values())
    if (
      e.id.startsWith("macro.") ||
      e.id.startsWith("calibration.") ||
      referenced.has(e.id)
    )
      rows.push(e);
  return rows;
}
