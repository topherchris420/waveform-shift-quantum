import { reconcileEvidence } from "./evidence";
import { emptyBalanceSheet, sum } from "./accounting";
import { initialState } from "./engine";
import { createPayment } from "./network";
import {
  LAYERS,
  type ActorType,
  type CounterpartyExposure,
  type FinancialInstitution,
  type ParameterEvidence,
  type Scenario,
} from "./types";
function institution(
  id: string,
  type: ActorType,
  cash: number,
  securities: number,
  parentId: string | null = null,
): FinancialInstitution {
  const bs = emptyBalanceSheet();
  bs.assets.reserves = cash;
  bs.assets.securities = securities;
  bs.equity = cash + securities;
  return {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type,
    jurisdiction: id === "foreign-parent" ? "Foreign" : "US",
    parentId,
    balanceSheet: bs,
    collateral: securities
      ? [
          {
            id: `${id}-treasury`,
            assetClass: "treasury",
            account: "securities",
            quantity: securities,
            price: 1,
            haircut: 0.1,
            liquidityClass: 1,
            eligibleFacilities: ["research-liquidity"],
            valuationUncertainty: 0.02,
            maturityHours: 17520,
            durationYears: 2,
            priceSensitivity: 1,
            pledges: {},
          },
        ]
      : [],
    behavior: {
      role:
        type === "deposit-sector"
          ? "depositor"
          : type === "broker-dealer"
            ? "dealer"
            : ["money-market-fund", "hedge-fund"].includes(type)
              ? "fund"
              : "treasury",
      withdrawalElasticity: 0.15,
      riskAversion: 0.1,
      hoarding: 0.05,
      herding: 0.05,
      stigmaSensitivity: 0.2,
      calibrationType: "STYLIZED_ASSUMPTION",
    },
    capitalFloor: 0.06,
    riskWeight: 0.8,
    liquidityBuffer: 0,
    outageUntil: 0,
    resolved: false,
  };
}
export const PUBLIC_REFERENCES = {
  funding:
    "https://www.federalreserve.gov/publications/financial-stability-report.htm",
  fbo: "https://www.federalreserve.gov/supervisionreg/topics/fbo_supervision.htm",
  settlement: "https://www.federalreserve.gov/paymentsystems/psr_about.htm",
  pfmi: "https://www.bis.org/cpmi/publ/d101a.pdf",
  margin: "https://www.bis.org/bcbs/publ/d537.htm",
  scenarios:
    "https://www.federalreserve.gov/supervisionreg/dfa-stress-tests-2026.htm",
  svb: "https://www.federalreserve.gov/publications/2023-April-SVB-Key-Takeaways.htm",
};
/** Numeric fixture assumptions are deliberately not attributed to historical observations. */
export function syntheticEvidence(s: Scenario): ParameterEvidence[] {
  return reconcileEvidence(s);
}
export type DemoId =
  "lfbo-dollar-funding" | "intraday-settlement" | "fire-sale-margin";
export function createDemo(id: DemoId = "lfbo-dollar-funding"): Scenario {
  const actors = [
    institution("foreign-parent", "foreign-parent", 100, 250),
    institution("us-ihc", "ihc", 35, 140, "foreign-parent"),
    institution("us-bank", "commercial-bank", 45, 220, "us-ihc"),
    institution("us-branch", "branch-agency", 25, 110, "foreign-parent"),
    institution("dealer", "broker-dealer", 30, 220, "us-ihc"),
    institution("other-subsidiary", "corporate-borrower", 15, 20, "us-ihc"),
    institution("mmf", "money-market-fund", 150, 0),
    institution("hedge-fund", "hedge-fund", 30, 60),
    institution("insurer", "insurer", 75, 150),
    institution("deposits", "deposit-sector", 20, 0),
    institution("secured-lender", "secured-funding-provider", 200, 0),
    institution("unsecured-lender", "unsecured-funding-provider", 150, 0),
    institution("ccp", "ccp", 70, 0),
    institution("payments", "settlement-utility", 20, 0),
    institution("market-maker", "secured-funding-provider", 1000, 50),
    institution("central-bank", "central-bank", 0, 0),
  ];
  const exposures: CounterpartyExposure[] = [];
  function fund(
    creditor: string,
    debtor: string,
    amount: number,
    kind: CounterpartyExposure["fundingKind"],
    restricted = false,
  ) {
    const c = actors.find((a) => a.id === creditor)!,
      d = actors.find((a) => a.id === debtor)!;
    const debt =
      kind === "repo"
        ? "repo"
        : kind === "uninsured-deposits"
          ? "uninsuredDeposits"
          : kind === "retail-deposits"
            ? "retailDeposits"
            : kind === "interbank"
              ? "interbankBorrowing"
              : "unsecuredBorrowing";
    const asset = kind === "repo" ? "repoAssets" : "interbankAssets";
    // Opening balance sheets are grossed up with the reciprocal contractual claims.
    c.balanceSheet.assets[asset] += amount;
    c.balanceSheet.equity += amount;
    d.balanceSheet.liabilities[debt] += amount;
    d.balanceSheet.equity -= amount;
    const edge: CounterpartyExposure = {
      id: `${creditor}:${debtor}`,
      creditor,
      debtor,
      kind:
        kind === "repo"
          ? "repo"
          : creditor === "foreign-parent"
            ? "intragroup"
            : "unsecured",
      fundingKind: kind,
      principal: amount,
      creditorAccount: asset,
      debtorAccount: debt,
      securedAmount: 0,
      collateralIds: [],
      maturityHour: 48,
      rolloverProbability: 0.9,
      lossGivenDefault: 0.5,
      fundingDependency: 0.5,
      transferLimit: creditor === "foreign-parent" ? 100 : 1e6,
      transferRestricted: restricted,
      spreadBps: 100,
    };
    if (kind === "repo") {
      const lot = d.collateral[0];
      const quantity = Math.min(lot.quantity * 0.5, amount / lot.price);
      lot.pledges[`edge:${edge.id}`] = quantity;
      edge.collateralIds = [lot.id];
      edge.securedAmount = Math.min(
        amount,
        quantity * lot.price * (1 - lot.haircut),
      );
    }
    exposures.push(edge);
  }
  fund("foreign-parent", "us-ihc", 100, "interbank", true);
  fund("foreign-parent", "us-branch", 65, "interbank");
  fund("deposits", "us-bank", 130, "uninsured-deposits");
  fund("deposits", "us-branch", 45, "uninsured-deposits");
  fund("mmf", "dealer", 110, "repo");
  fund("secured-lender", "us-bank", 70, "repo");
  fund("unsecured-lender", "us-ihc", 45, "unsecured-wholesale");
  fund("dealer", "hedge-fund", 55, "unsecured-wholesale");
  fund("us-bank", "other-subsidiary", 20, "unsecured-wholesale");
  const cb = actors.find((a) => a.id === "central-bank")!;
  const reserves = sum(actors.map((a) => a.balanceSheet.assets.reserves));
  cb.balanceSheet.assets.securities = reserves;
  cb.balanceSheet.liabilities.reserveLiabilities = reserves;
  const base: Scenario = {
    schema: "systemic-scenario.v1",
    id,
    name:
      id === "lfbo-dollar-funding"
        ? "LFBO Dollar-Funding Stress"
        : id === "intraday-settlement"
          ? "Intraday Settlement Disruption"
          : "Fire-Sale / Margin Spiral",
    description:
      "Synthetic institutions and parameters. Investigate explicit mechanisms under common initial conditions.",
    seed: 420,
    horizonHours: 48,
    stepHours: 4,
    maxRounds: 4,
    convergenceTolerance: 1e-6,
    actors,
    exposures,
    payments: [],
    margins: [],
    markets: [
      {
        liquidityProviderId: "market-maker",
        assetClass: "treasury",
        price: 1,
        initialPrice: 1,
        marketDepth: 900,
        elasticity: 0.35,
        volatility: 0,
        liquidityTier: 1,
      },
    ],
    facilities: [
      {
        id: "research-liquidity",
        name: "Generic Collateralized Liquidity Facility",
        centralBankId: "central-bank",
        eligibleCounterparties: [
          "commercial-bank",
          "ihc",
          "branch-agency",
          "broker-dealer",
        ],
        eligibleCollateral: ["treasury", "agency"],
        haircutSchedule: { treasury: 0.15, agency: 0.2 },
        valuationRule: "market-minus-uncertainty",
        spreadBps: 150,
        termHours: 48,
        borrowingCap: 60,
        counterpartyLimit: 80,
        capacity: 150,
        responseLagHours: 8,
        repaymentRule: "bullet",
        renewalRule: "none",
        maxRenewals: 0,
        stigma: 0.2,
        usagePreference: 0.8,
        disclosure:
          "Synthetic usage is fully visible to researchers; no claim to actual facility terms.",
        requireSolvent: true,
      },
    ],
    shocks: [],
    layers: Object.fromEntries(
      LAYERS.map((l) => [l, true]),
    ) as Scenario["layers"],
    physical: { capacity: 100, demand: 100, units: "resource units" },
    evidence: [],
    settlement: { mode: "gross", reliability: 1, liquidityRecycling: true },
    behavior: {
      withdrawalAcceleration: 0.1,
      confidenceThreshold: 0.3,
      marginHaircutFeedback: 0.15,
    },
    policy: { allowAssetSales: true, routing: "fifo", routingOverheadBps: 2 },
    provenance: {
      kind: "historically-inspired",
      sources: [
        PUBLIC_REFERENCES.funding,
        PUBLIC_REFERENCES.fbo,
        PUBLIC_REFERENCES.settlement,
        PUBLIC_REFERENCES.pfmi,
      ],
      sourceVintage: "2026-09-12",
      assumptions: [
        "All actors, exposures, balances and numerical shock values are synthetic.",
        "Historical references motivate mechanisms; these fixtures do not reproduce any historical event.",
        "Reserves denotes transferable settlement balances; nonbanks access the rail through an implicit settlement agent.",
        "Foreign-parent to IHC liquidity is ring-fenced in this fixture; no assertion about any actual institution.",
        "Price-taking external demand is represented by a finite-cash market-maker.",
      ],
    },
  };
  if (id === "lfbo-dollar-funding")
    base.shocks = [
      {
        id: "deposit-run",
        hour: 4,
        kind: "withdrawal",
        target: "us-branch",
        magnitude: 0.45,
        durationHours: 0,
        evidenceIds: [],
      },
      {
        id: "repo-pullback",
        hour: 4,
        kind: "withdrawal",
        target: "dealer",
        magnitude: 0.35,
        durationHours: 0,
        evidenceIds: [],
      },
      {
        id: "haircuts",
        hour: 4,
        kind: "haircut",
        target: "treasury",
        magnitude: 0.15,
        durationHours: 0,
        evidenceIds: [],
      },
      {
        id: "spreads",
        hour: 4,
        kind: "spread",
        target: "all",
        magnitude: 250,
        durationHours: 0,
        evidenceIds: [],
      },
      {
        id: "settlement-demand",
        hour: 8,
        kind: "payment-demand",
        target: "us-bank",
        magnitude: 30,
        durationHours: 16,
        evidenceIds: [],
      },
    ];
  if (id === "intraday-settlement") {
    base.horizonHours = 12;
    base.stepHours = 1;
    base.shocks = [
      {
        id: "outage",
        hour: 1,
        kind: "outage",
        target: "dealer",
        magnitude: 0,
        durationHours: 6,
        evidenceIds: [],
      },
    ];
    base.facilities[0].responseLagHours = 2;
  }
  if (id === "fire-sale-margin") {
    base.shocks = [
      {
        id: "market-shock",
        hour: 4,
        kind: "price",
        target: "treasury",
        magnitude: 0.12,
        durationHours: 0,
        evidenceIds: [],
      },
    ];
    base.margins = [
      {
        id: "dealer-ccp",
        payer: "dealer",
        receiver: "ccp",
        assetClass: "treasury",
        notional: 400,
        initialMargin: 8,
        postedInitialMargin: 0,
        threshold: 0.25,
        frequencyHours: 4,
        sensitivity: 1,
        lastPrice: 1,
        nextHour: 0,
        collateralSubstitution: false,
      },
    ];
    base.markets[0].marketDepth = 350;
    base.provenance.sources.push(PUBLIC_REFERENCES.margin);
  }
  const state = initialState(base);
  for (const [i, from, to, amount] of [
    [0, "us-bank", "dealer", 25],
    [1, "dealer", "us-branch", 40],
    [2, "us-branch", "us-bank", 25],
    [3, "dealer", "ccp", 15],
  ] as const)
    createPayment(state, {
      id: `opening-${i}`,
      from,
      to,
      amount,
      dueHour: id === "intraday-settlement" ? 1 : 8,
      deadlineHour: id === "intraday-settlement" ? 5 : 24,
      priority: i === 3 ? 0 : 1,
      kind: "payment",
    });
  base.actors = state.actors;
  base.payments = state.payments;
  base.evidence = syntheticEvidence(base);
  return base;
}
