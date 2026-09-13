/** All monetary quantities are USD millions; time is hours. Ratios are fractions. */
export const MODEL_VERSION = "systemic-lab.1.0.0";
export const TOLERANCE = 1e-7;
export const ACTOR_TYPES = [
  "commercial-bank",
  "bank-holding-company",
  "foreign-parent",
  "ihc",
  "branch-agency",
  "broker-dealer",
  "money-market-fund",
  "hedge-fund",
  "insurer",
  "ccp",
  "central-bank",
  "settlement-utility",
  "corporate-borrower",
  "deposit-sector",
  "secured-funding-provider",
  "unsecured-funding-provider",
] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
export const ASSET_ACCOUNTS = [
  "cash",
  "reserves",
  "securities",
  "loans",
  "interbankAssets",
  "repoAssets",
  "derivativesCollateral",
  "marginReceivables",
  "paymentReceivables",
  "centralBankLoans",
] as const;
export const LIABILITY_ACCOUNTS = [
  "retailDeposits",
  "uninsuredDeposits",
  "operationalDeposits",
  "wholesaleDeposits",
  "securedBorrowing",
  "unsecuredBorrowing",
  "repo",
  "commercialPaper",
  "interbankBorrowing",
  "centralBankBorrowing",
  "reserveLiabilities",
  "marginPayables",
  "marginCollateralLiability",
  "paymentPayables",
] as const;
export type AssetAccount = (typeof ASSET_ACCOUNTS)[number];
export type LiabilityAccount = (typeof LIABILITY_ACCOUNTS)[number];
export type Account = AssetAccount | LiabilityAccount | "equity";
export interface BalanceSheet {
  assets: Record<AssetAccount, number>;
  liabilities: Record<LiabilityAccount, number>;
  equity: number;
}
export type LiquidityState =
  "ADEQUATE" | "ILLIQUID" | "FACILITY_DEPENDENT" | "SETTLEMENT_SUSPENDED";
export type SolvencyState =
  "SOLVENT" | "CAPITAL_IMPAIRED" | "INSOLVENT" | "RESOLVED";
export interface LiquidityPosition {
  available: number;
  due: number;
  shortfall: number;
  state: LiquidityState;
}
export interface CapitalPosition {
  classification: "SIMULATION_CAPITAL_PROXY";
  equity: number;
  equityAssets: number;
  leverage: number | null;
  rwa: number;
  cet1Proxy: number | null;
  buffer: number;
  state: SolvencyState;
}
export const ASSET_CLASSES = [
  "cash",
  "treasury",
  "agency",
  "mbs",
  "corporate",
  "loans",
  "other",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];
export interface CollateralItem {
  id: string;
  assetClass: AssetClass;
  account: "cash" | "reserves" | "securities" | "loans";
  quantity: number;
  price: number;
  haircut: number;
  liquidityClass: 1 | 2 | 3;
  eligibleFacilities: string[];
  valuationUncertainty: number;
  maturityHours: number;
  durationYears: number;
  priceSensitivity: number;
  /** Quantity pledged by contract ID. Pledged quantities cannot be sold or reused. */
  pledges: Record<string, number>;
}
export type CollateralInventory = CollateralItem[];
export type CalibrationType =
  | "PUBLIC_DATA_DERIVED"
  | "LITERATURE_DERIVED"
  | "EMPIRICALLY_ESTIMATED"
  | "STYLIZED_ASSUMPTION"
  | "EXPERIMENTAL";
export interface ParameterEvidence {
  id: string;
  value: number;
  units: string;
  lower: number;
  upper: number;
  source: string;
  sourceDate: string;
  calibrationType: CalibrationType;
  confidence: number;
  notes: string;
}
export interface BehavioralProfile {
  role: "depositor" | "dealer" | "lender" | "treasury" | "fund";
  withdrawalElasticity: number;
  riskAversion: number;
  hoarding: number;
  herding: number;
  stigmaSensitivity: number;
  calibrationType: CalibrationType;
}
export interface FinancialInstitution {
  id: string;
  name: string;
  type: ActorType;
  jurisdiction: string;
  parentId: string | null;
  balanceSheet: BalanceSheet;
  collateral: CollateralInventory;
  behavior: BehavioralProfile;
  capitalFloor: number;
  riskWeight: number;
  liquidityBuffer: number;
  outageUntil: number;
  resolved: boolean;
}
export const FUNDING_KINDS = [
  "retail-deposits",
  "uninsured-deposits",
  "operational-deposits",
  "wholesale-deposits",
  "secured-wholesale",
  "unsecured-wholesale",
  "repo",
  "commercial-paper",
  "interbank",
  "central-bank",
] as const;
export type FundingKind = (typeof FUNDING_KINDS)[number];
/** creditor -> debtor: creditor holds the asset, debtor owes the liability. */
export interface CounterpartyExposure {
  id: string;
  creditor: string;
  debtor: string;
  kind:
    | "unsecured"
    | "repo"
    | "derivative"
    | "committed-liquidity"
    | "intragroup"
    | "securities-financing";
  fundingKind: FundingKind;
  principal: number;
  creditorAccount: AssetAccount;
  debtorAccount: LiabilityAccount;
  securedAmount: number;
  collateralIds: string[];
  maturityHour: number;
  rolloverProbability: number;
  lossGivenDefault: number;
  fundingDependency: number;
  transferLimit: number;
  transferRestricted: boolean;
  spreadBps: number;
}
export type FundingProfile = CounterpartyExposure[];
export interface PaymentObligation {
  id: string;
  from: string;
  to: string;
  amount: number;
  remaining: number;
  settled: number;
  writtenOff: number;
  lossGivenDefault: number;
  createdHour: number;
  dueHour: number;
  deadlineHour: number;
  priority: number;
  kind:
    | "payment"
    | "funding-withdrawal"
    | "margin"
    | "facility-repayment"
    | "intragroup";
  status: "QUEUED" | "SETTLED" | "FAILED";
  settledHour: number | null;
  releasePledges: {
    actorId: string;
    lotId: string;
    contractId: string;
    quantity: number;
  }[];
}
export interface MarginAgreement {
  id: string;
  payer: string;
  receiver: string;
  assetClass: AssetClass;
  notional: number;
  initialMargin: number;
  postedInitialMargin: number;
  threshold: number;
  frequencyHours: number;
  sensitivity: number;
  lastPrice: number;
  nextHour: number;
  collateralSubstitution: boolean;
}
export interface MarketImpactModel {
  liquidityProviderId: string;
  assetClass: AssetClass;
  price: number;
  initialPrice: number;
  marketDepth: number;
  elasticity: number;
  volatility: number;
  liquidityTier: 1 | 2 | 3;
}
export interface CentralBankFacility {
  id: string;
  name: string;
  centralBankId: string;
  eligibleCounterparties: ActorType[];
  eligibleCollateral: AssetClass[];
  haircutSchedule: Partial<Record<AssetClass, number>>;
  valuationRule: "market-minus-uncertainty";
  spreadBps: number;
  termHours: number;
  borrowingCap: number;
  counterpartyLimit: number;
  capacity: number;
  responseLagHours: number;
  repaymentRule: "bullet";
  renewalRule: "none" | "reassess";
  maxRenewals: number;
  stigma: number;
  usagePreference: number;
  disclosure: string;
  requireSolvent: boolean;
}
export interface FacilityLoan {
  id: string;
  facilityId: string;
  borrower: string;
  amount: number;
  requestedHour: number;
  decisionHour: number;
  maturityHour: number;
  status: "PENDING" | "ACTIVE" | "REPAID" | "REJECTED" | "DEFAULTED";
  renewals: number;
  pledged: { lotId: string; quantity: number }[];
}
export type StressResponseState =
  | "NORMAL"
  | "LIQUIDITY_STRESS"
  | "MARKET_STRESS"
  | "FACILITY_SUPPORT"
  | "SYSTEMIC_STRESS"
  | "STABILIZATION"
  | "RECOVERY";
export interface Posting {
  actorId: string;
  account: Account;
  delta: number;
}
export interface SystemicEvent {
  id: string;
  hour: number;
  round: number;
  actorId: string;
  mechanism: string;
  amount: number;
  units: "USD million" | "fraction" | "hours" | "resource units";
  previous: number | string;
  next: number | string;
  calculation: string;
  evidenceIds: string[];
  edgeId: string | null;
  postings: Posting[];
}
export const LAYERS = [
  "physical",
  "financial",
  "market-price",
  "settlement",
  "counterparty",
  "behavioral",
  "institutional",
  "policy-intervention",
  "computational-routing",
] as const;
export type Layer = (typeof LAYERS)[number];
export type LayerConfiguration = Record<Layer, boolean>;
export interface Shock {
  id: string;
  hour: number;
  kind:
    | "withdrawal"
    | "price"
    | "haircut"
    | "outage"
    | "default"
    | "physical"
    | "spread"
    | "payment-demand";
  target: string;
  magnitude: number;
  durationHours: number;
  evidenceIds: string[];
}
export interface PhysicalSystem {
  capacity: number;
  demand: number;
  units: "resource units";
}
export interface Scenario {
  schema: "systemic-scenario.v1";
  id: string;
  name: string;
  description: string;
  seed: number;
  horizonHours: number;
  stepHours: number;
  maxRounds: number;
  convergenceTolerance: number;
  actors: FinancialInstitution[];
  exposures: CounterpartyExposure[];
  payments: PaymentObligation[];
  margins: MarginAgreement[];
  markets: MarketImpactModel[];
  facilities: CentralBankFacility[];
  shocks: Shock[];
  layers: LayerConfiguration;
  physical: PhysicalSystem;
  evidence: ParameterEvidence[];
  settlement: {
    mode: "gross" | "bilateral-netting";
    reliability: number;
    liquidityRecycling: boolean;
  };
  behavior: {
    withdrawalAcceleration: number;
    confidenceThreshold: number;
    marginHaircutFeedback: number;
  };
  policy: {
    allowAssetSales: boolean;
    routing: "fifo" | "network-matching" | "hybrid" | "genesis";
    routingOverheadBps: number;
  };
  provenance: {
    kind: "synthetic" | "historically-inspired" | "public-data-calibrated";
    sources: string[];
    sourceVintage: string;
    assumptions: string[];
  };
}
export interface SystemicState {
  hour: number;
  round: number;
  actors: FinancialInstitution[];
  exposures: CounterpartyExposure[];
  payments: PaymentObligation[];
  margins: MarginAgreement[];
  markets: MarketImpactModel[];
  evidence: ParameterEvidence[];
  facilities: CentralBankFacility[];
  facilityLoans: FacilityLoan[];
  physical: PhysicalSystem;
  events: SystemicEvent[];
  warnings: string[];
  response: StressResponseState;
  cumulativeSales: number;
  cumulativeFacilityDraws: number;
  cumulativeLoss: number;
}
export interface SystemicMetrics {
  liquidityShortfall: number;
  impairedInstitutions: number;
  insolventInstitutions: number;
  equity: number;
  capitalImpairment: number;
  queuedPayments: number;
  failedSettlementValue: number;
  settlementCompletion: number;
  averageSettlementDelayHours: number | null;
  peakIntradayLiquidityNeed: number;
  liquidityRecyclingRatio: number | null;
  networkCongestion: number;
  collateralAvailable: number;
  collateralPledged: number;
  collateralExhaustion: number;
  assetSales: number;
  priceDislocation: number;
  facilityUsage: number;
  facilityUtilization: number;
  counterpartyHHI: number;
  fundingHHI: number;
  criticalNodeDependency: number;
  interconnectedness: number;
  cascadeBreadth: number;
  cascadeDepth: number;
  systemicLossProxy: number;
  physicalShortfall: number;
  distributionalShortfall: number;
}
export interface SimulationSnapshot {
  hour: number;
  round: number;
  response: StressResponseState;
  actors: FinancialInstitution[];
  metrics: SystemicMetrics;
  liquidityPositions: Record<string, LiquidityPosition>;
  networkEdges: {
    id: string;
    from: string;
    to: string;
    layer: "funding" | "payments" | "margin" | "facilities" | "ownership";
    amount: number;
  }[];
}
export interface PolicySimulationResult {
  modelVersion: string;
  scenarioId: string;
  seed: number;
  timeline: SimulationSnapshot[];
  events: SystemicEvent[];
  finalState: SystemicState;
  summary: SystemicMetrics & {
    peakLiquidityShortfall: number;
    recoveryTimeHours: number | null;
  };
  numericalWarnings: string[];
  interpretation: string;
}
