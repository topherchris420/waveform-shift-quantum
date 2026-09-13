import { z } from "zod";
import { clamp } from "./accounting";
import { runPolicySimulation } from "./engine";
import { parseScenario } from "./schema";
import type {
  FinancialInstitution,
  CounterpartyExposure,
  MarketImpactModel,
  Scenario,
} from "./types";
export const MACRO_VARIABLES = [
  "unemployment",
  "real_gdp_growth",
  "inflation",
  "treasury_yield",
  "mortgage_rate",
  "corporate_spread",
  "equity_index",
  "house_price_index",
  "cre_price_index",
  "volatility",
  "foreign_gdp_growth",
  "foreign_inflation",
  "foreign_yield",
  "exchange_rate",
] as const;
export const ScenarioPathSchema = z
  .strictObject({
    schema: z.literal("public-scenario-path.v1"),
    scenarioYear: z.number().int().min(2000).max(2100),
    name: z.string().min(1).max(150),
    kind: z.enum(["baseline", "adverse", "exploratory"]),
    source: z.string().min(1).max(2000),
    publicationDate: z.iso.date(),
    rows: z
      .array(
        z.strictObject({
          quarter: z.string().regex(/^20\d{2}Q[1-4]$/),
          variable: z.enum(MACRO_VARIABLES),
          value: z.number().finite().min(-100000).max(1e8),
          units: z.enum(["percent", "index", "basis points", "ratio"]),
          provenance: z.string().min(1).max(2000),
        }),
      )
      .min(10)
      .max(140),
  })
  .superRefine((p, ctx) => {
    const keys = p.rows.map((r) => `${r.quarter}:${r.variable}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Duplicate quarter-variable" });
    const quarters = [...new Set(p.rows.map((r) => r.quarter))].sort();
    if (quarters.length !== 10)
      ctx.addIssue({
        code: "custom",
        message: "Provide Q0 baseline and nine scenario quarters",
      });
    const ordinal = (q: string) =>
      Number(q.slice(0, 4)) * 4 + Number(q.slice(-1));
    if (
      quarters.some(
        (q, i) => i > 0 && ordinal(q) !== ordinal(quarters[i - 1]) + 1,
      )
    )
      ctx.addIssue({ code: "custom", message: "Quarters must be consecutive" });
    for (const variable of new Set(p.rows.map((r) => r.variable))) {
      const rows = p.rows.filter((r) => r.variable === variable);
      if (rows.length !== 10 || new Set(rows.map((r) => r.units)).size !== 1)
        ctx.addIssue({
          code: "custom",
          message: `Incomplete path or inconsistent units for ${variable}`,
        });
    }
  });
export type PublicScenarioPath = z.infer<typeof ScenarioPathSchema>;
export interface ScenarioDataProvider {
  load(): Promise<PublicScenarioPath>;
}
export interface BalanceSheetProvider {
  load(): Promise<FinancialInstitution[]>;
}
export interface MarketDataProvider {
  load(): Promise<MarketImpactModel[]>;
}
export interface NetworkDataProvider {
  load(): Promise<CounterpartyExposure[]>;
}

export type FederalReserveDomesticMetadata = Omit<
  PublicScenarioPath,
  "schema" | "name" | "rows"
> & {
  /** Required when a file contains more than one named scenario. */
  scenarioName?: string;
  /** First quarter in the ten-quarter research window, for example 2026Q1. */
  startQuarter?: string;
};

/** RFC-style CSV reader for normalized public paths, including quoted commas/newlines. */
export function parseCSV(text: string): string[][] {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error("CSV exceeds 2 MB");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === '"') {
      if (quoted && normalized[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length) throw new Error("Malformed CSV quote");
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(cell);
      cell = "";
      if (c === "\n") {
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length > 2000) throw new Error("Too many CSV rows");
  return rows;
}
export class FedScenarioAdapter {
  static parse(value: unknown): PublicScenarioPath {
    return ScenarioPathSchema.parse(value);
  }
  static fromCSV(
    text: string,
    metadata: Omit<PublicScenarioPath, "rows" | "schema">,
  ): PublicScenarioPath {
    const [header, ...data] = parseCSV(text);
    const expected = ["quarter", "variable", "value", "units", "provenance"];
    if (!header || header.join(",") !== expected.join(","))
      throw new Error(
        "Expected normalized CSV header: quarter,variable,value,units,provenance. Preserve the source and publication metadata.",
      );
    return this.parse({
      ...metadata,
      schema: "public-scenario-path.v1",
      rows: data.map((r) => {
        if (r.length !== 5 || r[2].trim() === "")
          throw new Error("Incomplete CSV row");
        return {
          quarter: r[0],
          variable: r[1],
          value: Number(r[2]),
          units: r[3],
          provenance: r[4],
        };
      }),
    });
  }

  /**
   * Normalize the Federal Reserve's published domestic scenario CSV shape.
   * The source and publication date remain caller-supplied because neither is
   * encoded in the CSV. A ten-quarter window is selected explicitly; no
   * supervisory loss or capital model is reproduced here.
   */
  static fromFederalReserveDomesticCSV(
    text: string,
    metadata: FederalReserveDomesticMetadata,
  ): PublicScenarioPath {
    const [header, ...data] = parseCSV(text);
    if (!header) throw new Error("Federal Reserve CSV is empty");
    const canonical = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, " ");
    const columns = new Map(
      header.map((value, index) => [canonical(value), index]),
    );
    if (columns.size !== header.length)
      throw new Error("Federal Reserve CSV contains duplicate columns");
    const required = [
      "Scenario Name",
      "Date",
      "Real GDP growth",
      "Unemployment rate",
      "CPI inflation rate",
      "10-year Treasury yield",
      "BBB corporate yield",
      "Mortgage rate",
      "Dow Jones Total Stock Market Index (Level)",
      "House Price Index (Level)",
      "Commercial Real Estate Price Index (Level)",
      "Market Volatility Index (Level)",
    ];
    for (const name of required)
      if (!columns.has(canonical(name)))
        throw new Error(`Federal Reserve CSV is missing column: ${name}`);
    const cell = (row: string[], name: string) => {
      const value = row[columns.get(canonical(name))!];
      if (value === undefined)
        throw new Error(`Incomplete Federal Reserve CSV row: ${name}`);
      return value.trim();
    };
    const scenarioNames = [
      ...new Set(data.map((row) => cell(row, "Scenario Name"))),
    ].filter(Boolean);
    const scenarioName = metadata.scenarioName ?? scenarioNames[0];
    if (!scenarioName || (!metadata.scenarioName && scenarioNames.length !== 1))
      throw new Error(
        "Select scenarioName when a Federal Reserve CSV contains multiple scenarios",
      );
    const quarterPattern = /^(20\d{2})\s*Q([1-4])$/i;
    const selected = data
      .filter((row) => cell(row, "Scenario Name") === scenarioName)
      .map((row) => {
        const match = cell(row, "Date").match(quarterPattern);
        if (!match)
          throw new Error("Unsupported Federal Reserve quarter label");
        return { quarter: `${match[1]}Q${match[2]}`, row };
      })
      .sort((a, b) => a.quarter.localeCompare(b.quarter));
    if (
      new Set(selected.map((entry) => entry.quarter)).size !== selected.length
    )
      throw new Error("Federal Reserve CSV contains duplicate quarters");
    const startQuarter = metadata.startQuarter
      ?.replace(/\s+/g, "")
      .toUpperCase();
    const start = startQuarter
      ? selected.findIndex((entry) => entry.quarter === startQuarter)
      : 0;
    if (start < 0) throw new Error("Requested startQuarter is not present");
    const window = selected.slice(start, start + 10);
    if (window.length !== 10)
      throw new Error("Federal Reserve import needs ten consecutive quarters");
    if (Number(selected[0].quarter.slice(0, 4)) !== metadata.scenarioYear)
      throw new Error("scenarioYear must match the scenario's first quarter");
    const number = (row: string[], name: string) => {
      const value = Number(cell(row, name));
      if (!Number.isFinite(value))
        throw new Error(`Non-numeric Federal Reserve value: ${name}`);
      return value;
    };
    const direct = [
      ["Real GDP growth", "real_gdp_growth", "percent"],
      ["Unemployment rate", "unemployment", "percent"],
      ["CPI inflation rate", "inflation", "percent"],
      ["10-year Treasury yield", "treasury_yield", "percent"],
      ["Mortgage rate", "mortgage_rate", "percent"],
      ["Dow Jones Total Stock Market Index (Level)", "equity_index", "index"],
      ["House Price Index (Level)", "house_price_index", "index"],
      [
        "Commercial Real Estate Price Index (Level)",
        "cre_price_index",
        "index",
      ],
      ["Market Volatility Index (Level)", "volatility", "index"],
    ] as const;
    const rows: PublicScenarioPath["rows"] = [];
    for (const { quarter, row } of window) {
      for (const [sourceColumn, variable, units] of direct)
        rows.push({
          quarter,
          variable,
          value: number(row, sourceColumn),
          units,
          provenance: `${sourceColumn}; ${metadata.source}`,
        });
      rows.push({
        quarter,
        variable: "corporate_spread",
        value:
          number(row, "BBB corporate yield") -
          number(row, "10-year Treasury yield"),
        units: "percent",
        provenance: `Calculated as BBB corporate yield minus 10-year Treasury yield; ${metadata.source}`,
      });
    }
    return this.parse({
      schema: "public-scenario-path.v1",
      scenarioYear: metadata.scenarioYear,
      name: scenarioName,
      kind: metadata.kind,
      source: metadata.source,
      publicationDate: metadata.publicationDate,
      rows,
    });
  }
}
export interface MacroMapping {
  variable: PublicScenarioPath["rows"][number]["variable"];
  mechanism: "duration-price" | "index-price" | "withdrawal" | "spread";
  target: string;
  sensitivity: number;
  expectedUnits: PublicScenarioPath["rows"][number]["units"];
  evidence: string;
}
export const DEFAULT_MACRO_MAPPINGS: MacroMapping[] = [
  {
    variable: "treasury_yield",
    mechanism: "duration-price",
    target: "treasury",
    sensitivity: 2,
    expectedUnits: "percent",
    evidence:
      "Stylized two-year duration; price ratio exp(-duration × change in yield).",
  },
  {
    variable: "unemployment",
    mechanism: "withdrawal",
    target: "all",
    sensitivity: 0.02,
    expectedUnits: "percent",
    evidence:
      "Stylized 2% funding withdrawal per percentage-point unemployment rise; not a supervisory model.",
  },
  {
    variable: "corporate_spread",
    mechanism: "spread",
    target: "all",
    sensitivity: 100,
    expectedUnits: "percent",
    evidence:
      "One percentage-point annual spread change equals 100 basis points.",
  },
];
/** Apply Q1..Q9 as timed events in one continuous state, preserving all facility contracts. */
export function scenarioFromPublicPath(
  base: Scenario,
  input: unknown,
  mappings: MacroMapping[] = DEFAULT_MACRO_MAPPINGS,
): { scenario: Scenario; quarters: string[]; unmappedVariables: string[] } {
  const path = FedScenarioAdapter.parse(input),
    s = structuredClone(base),
    quarters = [...new Set(path.rows.map((r) => r.quarter))].sort();
  if (
    mappings.some(
      (m) => !Number.isFinite(m.sensitivity) || Math.abs(m.sensitivity) > 10000,
    )
  )
    throw new Error("Invalid macro sensitivity");
  s.horizonHours = 9 * 90 * 24;
  s.stepHours = 72;
  s.maxRounds = 3;
  s.shocks = [];
  for (const [mi, mapping] of mappings.entries()) {
    const values = quarters.map((q) =>
      path.rows.find((r) => r.quarter === q && r.variable === mapping.variable),
    );
    if (values.every((v) => !v)) continue;
    if (values.some((v) => !v || v.units !== mapping.expectedUnits))
      throw new Error(
        `Mapping requires ${mapping.expectedUnits}: ${mapping.variable}`,
      );
    for (let q = 1; q < 10; q++) {
      const prev = values[q - 1]!,
        cur = values[q]!,
        change = cur.value - prev.value;
      const magnitude =
        mapping.mechanism === "duration-price"
          ? 1 - Math.exp((-mapping.sensitivity * change) / 100)
          : mapping.mechanism === "index-price"
            ? 1 - (cur.value / prev.value) ** mapping.sensitivity
            : mapping.mechanism === "withdrawal"
              ? clamp(change * mapping.sensitivity)
              : change * mapping.sensitivity;
      if (!Number.isFinite(magnitude))
        throw new Error("Undefined macro mapping; check index denominator");
      const evidenceId = `macro.${mi}.${q}`;
      s.evidence.push({
        id: evidenceId,
        value: cur.value,
        units: cur.units,
        lower: Math.min(-100000, cur.value),
        upper: Math.max(1e8, cur.value),
        source: path.source,
        sourceDate: path.publicationDate,
        calibrationType: cur.provenance.toLowerCase().includes("synthetic")
          ? "STYLIZED_ASSUMPTION"
          : "PUBLIC_DATA_DERIVED",
        confidence: 0,
        notes: `${cur.provenance}; scenario input is not a prediction. Mapping: ${mapping.evidence}`,
      });
      s.shocks.push({
        id: `macro-${mi}-${q}`,
        hour: (q - 1) * 2160,
        kind:
          mapping.mechanism === "withdrawal"
            ? "withdrawal"
            : mapping.mechanism === "spread"
              ? "spread"
              : "price",
        target: mapping.target,
        magnitude,
        durationHours: 0,
        evidenceIds: [evidenceId],
      });
    }
  }
  s.provenance.sources = [...new Set([...s.provenance.sources, path.source])];
  s.provenance.assumptions.push(
    "Public scenario paths enter a stylized propagation model; this does not reproduce Federal Reserve supervisory stress-testing models.",
    "Quarterly mode uses 72-hour time steps over nine synthetic 90-day quarters. Intraday effects require a separate hourly experiment.",
  );
  return {
    scenario: parseScenario(s),
    quarters,
    unmappedVariables: [...new Set(path.rows.map((r) => r.variable))].filter(
      (v) => !mappings.some((m) => m.variable === v),
    ),
  };
}
export function runNineQuarterScenario(
  base: Scenario,
  path: unknown,
  mappings?: MacroMapping[],
) {
  const prepared = scenarioFromPublicPath(base, path, mappings),
    result = runPolicySimulation(prepared.scenario);
  const quarters = prepared.quarters.map((quarter, index) => ({
    quarter,
    index,
    snapshot:
      index === 0
        ? result.timeline[0]
        : [...result.timeline]
            .reverse()
            .find((row) => row.hour < index * 2160) || result.timeline[0],
  }));
  quarters[9].snapshot = result.timeline[result.timeline.length - 1];
  return { ...prepared, result, quarterly: quarters };
}
export function syntheticMacroPath(): PublicScenarioPath {
  const rows: PublicScenarioPath["rows"] = [];
  for (let i = 0; i < 10; i++)
    for (const variable of [
      "treasury_yield",
      "unemployment",
      "corporate_spread",
    ] as const)
      rows.push({
        quarter: `${2026 + Math.floor(i / 4)}Q${(i % 4) + 1}`,
        variable,
        value:
          variable === "unemployment"
            ? 4 + Math.min(i, 5) * 0.3
            : variable === "treasury_yield"
              ? 4 + i * 0.1
              : 1 + i * 0.1,
        units: "percent",
        provenance: "Synthetic illustrative path; not Federal Reserve data.",
      });
  return {
    schema: "public-scenario-path.v1",
    scenarioYear: 2026,
    name: "Synthetic adverse path",
    kind: "adverse",
    source: "Synthetic offline fixture",
    publicationDate: "2026-09-12",
    rows,
  };
}
