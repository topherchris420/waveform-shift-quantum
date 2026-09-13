import { describe, it, expect } from "vitest";
import {
  FedScenarioAdapter,
  syntheticMacroPath,
  scenarioFromPublicPath,
  parseCSV,
  runNineQuarterScenario,
} from "../../systemic-lab/adapters";
import { createDemo } from "../../systemic-lab/scenarios";
describe("Public scenario adapter and nine-quarter horizon", () => {
  it("preserves units, source and all ten time points", () => {
    const p = FedScenarioAdapter.parse(syntheticMacroPath());
    const x = scenarioFromPublicPath(createDemo(), p);
    expect(x.quarters).toHaveLength(10);
    expect(x.scenario.horizonHours).toBe(19440);
    expect(x.scenario.shocks).toHaveLength(27);
    expect(x.unmappedVariables).toEqual([]);
  });
  it("rejects missing quarters, duplicate observations and wrong mapping units", () => {
    const p = syntheticMacroPath();
    p.rows.pop();
    expect(() => FedScenarioAdapter.parse(p)).toThrow();
    const q = syntheticMacroPath();
    q.rows.forEach((r) => (r.units = "basis points"));
    expect(() => scenarioFromPublicPath(createDemo(), q)).toThrow();
  });
  it("parses quoted CSV and refuses unterminated quoted fields", () => {
    expect(parseCSV('a,b\n"x,y",2')).toEqual([
      ["a", "b"],
      ["x,y", "2"],
    ]);
    expect(() => parseCSV('a,b\n"bad,2')).toThrow();
  });
  it("normalizes the published Federal Reserve domestic CSV shape without treating corporate yield as spread", () => {
    const header = [
      "Scenario Name",
      "Date",
      "Real GDP growth",
      "Nominal GDP growth",
      "Real disposable income growth",
      "Nominal disposable income growth",
      "Unemployment rate",
      "CPI inflation rate",
      "3-month Treasury rate",
      "5-year Treasury yield",
      "10-year Treasury yield",
      "BBB corporate yield",
      "Mortgage rate",
      "Prime rate",
      "Dow Jones Total Stock Market Index (Level)",
      "House Price Index (Level)",
      "Commercial Real Estate Price Index (Level)",
      "Market Volatility Index (Level)",
    ].join(",");
    const rows = Array.from({ length: 13 }, (_, index) => {
      const year = 2026 + Math.floor(index / 4);
      const quarter = (index % 4) + 1;
      return [
        "Supervisory Severely Adverse",
        `${year} Q${quarter}`,
        -5 + index,
        0,
        0,
        0,
        6 + index / 10,
        2,
        1,
        2,
        3,
        7.5,
        6,
        5,
        40_000 - index * 1_000,
        300 - index,
        290 - index,
        60 - index,
      ].join(",");
    });
    const path = FedScenarioAdapter.fromFederalReserveDomesticCSV(
      [header, ...rows].join("\n"),
      {
        scenarioYear: 2026,
        kind: "adverse",
        source: "https://www.federalreserve.gov/example.csv",
        publicationDate: "2026-02-17",
        startQuarter: "2026Q2",
      },
    );
    expect(path.rows).toHaveLength(100);
    expect(path.rows[0].quarter).toBe("2026Q2");
    expect(
      path.rows.find(
        (row) =>
          row.quarter === "2026Q2" && row.variable === "corporate_spread",
      )?.value,
    ).toBe(4.5);
    expect(path.rows.every((row) => row.provenance.includes(path.source))).toBe(
      true,
    );
  });
  it("allows asset-price recovery with lower yields without manufacturing physical supply", () => {
    const p = syntheticMacroPath();
    p.rows
      .filter((r) => r.variable === "treasury_yield")
      .forEach((r, i) => (r.value = 4 - i * 0.1));
    const x = scenarioFromPublicPath(createDemo(), p);
    expect(
      x.scenario.shocks.find((s) => s.kind === "price")!.magnitude,
    ).toBeLessThan(0);
    expect(x.scenario.physical).toEqual(createDemo().physical);
  });
  it("runs a continuous nine-quarter state and exposes Q0 through Q9", () => {
    const base = createDemo();
    base.exposures = [];
    for (const a of base.actors) {
      for (const k of Object.keys(a.balanceSheet.assets))
        if (["interbankAssets", "repoAssets"].includes(k)) {
          const key = k as "interbankAssets" | "repoAssets";
          a.balanceSheet.equity -= a.balanceSheet.assets[key];
          a.balanceSheet.assets[key] = 0;
        }
    }
    const x = runNineQuarterScenario(base, syntheticMacroPath(), [
      {
        variable: "treasury_yield",
        mechanism: "duration-price",
        target: "treasury",
        sensitivity: 2,
        expectedUnits: "percent",
        evidence: "Synthetic duration assumption",
      },
    ]);
    expect(x.quarterly.map((q) => q.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(x.result.finalState.hour).toBe(19440);
  }, 20000);
});
