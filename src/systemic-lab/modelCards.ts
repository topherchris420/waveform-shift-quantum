export interface ModelComponentCard {
  id: string;
  name: string;
  intendedUse: string;
  mechanism: string;
  assumptions: string[];
  parameters: string[];
  limitations: string[];
  calibration: string;
  validationStatus: string;
  failureModes: string[];
  prohibitedInterpretation: string;
}
const definitions = [
  [
    "market",
    "Market engine",
    "Compare financial exchange and resource allocation.",
    "Finite cash buyer for financial assets; seven existing resource comparators remain in the separate resource engine.",
    "Finite buyer liquidity; synthetic supply curves.",
    "marketDepth,elasticity,volatility,liquidityTier,priceSensitivity,routingOverheadBps",
    "Does not estimate equilibrium interest rates or macro welfare.",
  ],
  [
    "behavior",
    "Behavior engine",
    "Investigate funding reactions to visible liquidity or capital pressure.",
    "Counterparty withdrawal elasticity, risk aversion and herding act on explicit outstanding claims.",
    "Bounded synthetic decision rules; no rational expectations.",
    "withdrawalAcceleration,confidenceThreshold,withdrawalElasticity,fundingDependency,riskAversion,hoarding,herding",
    "No empirical behavioral estimation in bundled fixtures.",
  ],
  [
    "settlement",
    "Settlement engine",
    "Study intraday gridlock and recycling.",
    "Due bilateral obligations settle gross or net subject to available liquidity, priorities, outages and keyed reliability draws.",
    "Transferable settlement balances include nonbank agency access.",
    "reliability,liquidityRecycling,priority,deadlineHour",
    "Not an implementation of Fedwire or any specific payment utility.",
  ],
  [
    "facility",
    "Facility engine",
    "Separate liquidity support from solvency repair.",
    "Collateral and capacity reservation, delayed rechecking, matched reserve issuance, bullet repayment, optional reassessed renewals.",
    "Generic eligible counterparties and collateral schedules.",
    "capacity,counterpartyLimit,borrowingCap,haircuts,responseLagHours,termHours,spreadBps,stigma,usagePreference",
    "Defaulted principal remains outstanding; no complete insolvency waterfall.",
  ],
  [
    "collateral",
    "Collateral engine",
    "Measure available and encumbered borrowing capacity.",
    "Quantity × market price × (1-haircut) × (1-valuation uncertainty); exclusive pledges.",
    "Inventory is a subset of book assets; fair-value accounting.",
    "haircut,valuationUncertainty,quantity,price,priceSensitivity,liquidityClass,maturityHours,eligibleFacilities",
    "No official collateral valuation service or regulatory eligibility certification.",
  ],
  [
    "contagion",
    "Contagion engine",
    "Trace contractual, funding and shared-price spillovers.",
    "Explicit directed claims, funding withdrawals, resolution write-downs, sale feedback and payment delay.",
    "Discrete steps and configured maximum rounds.",
    "stepHours,maxRounds,convergenceTolerance,lossGivenDefault",
    "Numerical truncation is reported; results require timestep sensitivity.",
  ],
  [
    "fire-sale",
    "Fire-sale engine",
    "Test sale-driven price feedback.",
    "P_new=P_old exp(-elasticity × gross sale notional / marketDepth), followed by fair-value marks for all holders.",
    "Stylized inverse demand and finite market-maker cash.",
    "marketDepth,elasticity,liquidityProviderId",
    "No price recovery without an explicit positive price shock; no calibrated market microstructure.",
  ],
  [
    "genesis",
    "Genesis engine",
    "Compare experimental coordination with transparent alternatives.",
    "Financial payment sequencing uses the same observable queue and money constraints as matching/hybrid; separate resource lab retains full Genesis allocation.",
    "Experimental routing gets no additional money, collateral or physical capacity.",
    "routing,routingOverheadBps",
    "Financial sequencing may be observationally identical to matching. No claim of distinct financial superiority.",
  ],
] as const;
export const MODEL_CARDS: ModelComponentCard[] = definitions.map(
  ([id, name, intendedUse, mechanism, assumption, parameters, limitation]) => ({
    id,
    name,
    intendedUse,
    mechanism,
    assumptions: [assumption],
    parameters: parameters.split(","),
    limitations: [limitation],
    calibration:
      "Bundled parameters are synthetic unless a user supplies documented calibration.",
    validationStatus:
      "Accounting, conservation, deterministic replay and mechanism tests. No empirical validation claim.",
    failureModes: [
      "Invalid inputs rejected.",
      "Nonconvergence or unresolved payments remain visible.",
    ],
    prohibitedInterpretation:
      "No Federal Reserve approval, real-institution diagnosis, regulatory certification or economy-wide policy conclusion.",
  }),
);
export const EVIDENCE_BOUNDARIES = [
  {
    category: "ESTABLISHED ECONOMIC / FINANCIAL MECHANISM",
    description:
      "Accounting identity, debt, collateral and settlement are known mechanisms; their implementation here is simplified.",
  },
  {
    category: "STYLIZED ECONOMIC SIMULATION",
    description:
      "All bundled institutions and numerical parameters are synthetic.",
  },
  {
    category: "EXPERIMENTAL COORDINATION MECHANISM",
    description:
      "Genesis is an optional comparator that receives no privileged resources.",
  },
  {
    category: "TESTABLE HYPOTHESIS",
    description:
      "Imported signals motivate alternative mechanisms tested under declared assumptions.",
  },
  {
    category: "INTERPRETIVE CLAIM",
    description:
      "A simulated fit is not evidence of an identified real-world cause.",
  },
];
