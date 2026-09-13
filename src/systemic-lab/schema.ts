import { z } from "zod";
import {
  ACTOR_TYPES,
  ASSET_ACCOUNTS,
  LIABILITY_ACCOUNTS,
  ASSET_CLASSES,
  FUNDING_KINDS,
  LAYERS,
  type Scenario,
} from "./types";
import { reconcileEvidence } from "./evidence";
import { assertFinancialState } from "./network";
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_.:/-]+$/);
const label = z.string().min(1).max(2000);
const money = z.number().finite().min(0).max(1e9);
const signed = z.number().finite().min(-1e9).max(1e9);
const ratio = z.number().finite().min(0).max(1);
const hour = z.number().finite().min(0).max(100000);
const classifications = z.enum([
  "PUBLIC_DATA_DERIVED",
  "LITERATURE_DERIVED",
  "EMPIRICALLY_ESTIMATED",
  "STYLIZED_ASSUMPTION",
  "EXPERIMENTAL",
]);
export const ParameterEvidenceSchema = z
  .strictObject({
    id,
    value: signed,
    units: label,
    lower: signed,
    upper: signed,
    source: label,
    sourceDate: z.iso.date(),
    calibrationType: classifications,
    confidence: ratio,
    notes: label,
  })
  .refine(
    (p) => p.lower <= p.value && p.value <= p.upper,
    "Evidence value must lie within its bounds",
  );
const behavior = z.strictObject({
  role: z.enum(["depositor", "dealer", "lender", "treasury", "fund"]),
  withdrawalElasticity: ratio,
  riskAversion: ratio,
  hoarding: ratio,
  herding: ratio,
  stigmaSensitivity: ratio,
  calibrationType: classifications,
});
export const BalanceSheetSchema = z.strictObject({
  assets: z.record(z.enum(ASSET_ACCOUNTS), money),
  liabilities: z.record(z.enum(LIABILITY_ACCOUNTS), money),
  equity: signed,
});
const lot = z.strictObject({
  id,
  assetClass: z.enum(ASSET_CLASSES),
  account: z.enum(["cash", "reserves", "securities", "loans"]),
  quantity: money,
  price: money,
  haircut: ratio,
  liquidityClass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  eligibleFacilities: z.array(id).max(10),
  valuationUncertainty: ratio,
  maturityHours: hour,
  durationYears: z.number().finite().min(0).max(100),
  priceSensitivity: z.number().finite().min(0).max(10),
  pledges: z.record(id, money),
});
const institution = z.strictObject({
  id,
  name: label,
  type: z.enum(ACTOR_TYPES),
  jurisdiction: z.string().min(2).max(40),
  parentId: id.nullable(),
  balanceSheet: BalanceSheetSchema,
  collateral: z.array(lot).max(40),
  behavior,
  capitalFloor: ratio,
  riskWeight: z.number().finite().min(0).max(5),
  liquidityBuffer: money,
  outageUntil: hour,
  resolved: z.boolean(),
});
const exposure = z.strictObject({
  id,
  creditor: id,
  debtor: id,
  kind: z.enum([
    "unsecured",
    "repo",
    "derivative",
    "committed-liquidity",
    "intragroup",
    "securities-financing",
  ]),
  fundingKind: z.enum(FUNDING_KINDS),
  principal: money,
  creditorAccount: z.enum(ASSET_ACCOUNTS),
  debtorAccount: z.enum(LIABILITY_ACCOUNTS),
  securedAmount: money,
  collateralIds: z.array(id).max(40),
  maturityHour: hour,
  rolloverProbability: ratio,
  lossGivenDefault: ratio,
  fundingDependency: ratio,
  transferLimit: money,
  transferRestricted: z.boolean(),
  spreadBps: z.number().finite().min(0).max(10000),
});
const payment = z.strictObject({
  id,
  from: id,
  to: id,
  amount: money,
  remaining: money,
  settled: money,
  writtenOff: money,
  lossGivenDefault: ratio.default(0.5),
  createdHour: hour,
  dueHour: hour,
  deadlineHour: hour,
  priority: z.number().int().min(0).max(10),
  kind: z.enum([
    "payment",
    "funding-withdrawal",
    "margin",
    "facility-repayment",
    "intragroup",
  ]),
  status: z.enum(["QUEUED", "SETTLED", "FAILED"]),
  settledHour: hour.nullable(),
  releasePledges: z
    .array(
      z.strictObject({
        actorId: id,
        lotId: id,
        contractId: id,
        quantity: money,
      }),
    )
    .max(40),
});
const margin = z.strictObject({
  id,
  payer: id,
  receiver: id,
  assetClass: z.enum(ASSET_CLASSES),
  notional: money,
  initialMargin: money,
  postedInitialMargin: money,
  threshold: money,
  frequencyHours: hour.positive(),
  sensitivity: z.number().finite().min(0).max(10),
  lastPrice: money,
  nextHour: hour,
  collateralSubstitution: z.boolean(),
});
const market = z.strictObject({
  liquidityProviderId: id,
  assetClass: z.enum(ASSET_CLASSES),
  price: money.positive(),
  initialPrice: money.positive(),
  marketDepth: money.positive(),
  elasticity: z.number().finite().min(0).max(10),
  volatility: ratio,
  liquidityTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
const facility = z.strictObject({
  id,
  name: label,
  centralBankId: id,
  eligibleCounterparties: z.array(z.enum(ACTOR_TYPES)).max(20),
  eligibleCollateral: z.array(z.enum(ASSET_CLASSES)).max(7),
  haircutSchedule: z.partialRecord(z.enum(ASSET_CLASSES), ratio),
  valuationRule: z.literal("market-minus-uncertainty"),
  spreadBps: z.number().finite().min(0).max(10000),
  termHours: hour.positive(),
  borrowingCap: money,
  counterpartyLimit: money,
  capacity: money,
  responseLagHours: hour,
  repaymentRule: z.literal("bullet"),
  renewalRule: z.enum(["none", "reassess"]),
  maxRenewals: z.number().int().min(0).max(20),
  stigma: ratio,
  usagePreference: ratio,
  disclosure: label,
  requireSolvent: z.boolean(),
});
const shock = z.strictObject({
  id,
  hour,
  kind: z.enum([
    "withdrawal",
    "price",
    "haircut",
    "outage",
    "default",
    "physical",
    "spread",
    "payment-demand",
  ]),
  target: id,
  magnitude: signed,
  durationHours: hour,
  evidenceIds: z.array(id).max(100),
});
export const ScenarioSchema = z
  .strictObject({
    schema: z.literal("systemic-scenario.v1"),
    id,
    name: label,
    description: label,
    seed: z.number().int().min(0).max(4294967295),
    horizonHours: hour.positive(),
    stepHours: hour.positive(),
    maxRounds: z.number().int().min(1).max(20),
    convergenceTolerance: z.number().finite().min(1e-9).max(0.01),
    actors: z.array(institution).min(2).max(80),
    exposures: z.array(exposure).max(500),
    payments: z.array(payment).max(1000),
    margins: z.array(margin).max(100),
    markets: z.array(market).max(7),
    facilities: z.array(facility).max(10),
    shocks: z.array(shock).max(200),
    layers: z.record(z.enum(LAYERS), z.boolean()),
    physical: z.strictObject({
      capacity: money,
      demand: money,
      units: z.literal("resource units"),
    }),
    evidence: z.array(ParameterEvidenceSchema).max(10000),
    settlement: z.strictObject({
      mode: z.enum(["gross", "bilateral-netting"]),
      reliability: ratio,
      liquidityRecycling: z.boolean(),
    }),
    behavior: z.strictObject({
      withdrawalAcceleration: ratio,
      confidenceThreshold: ratio,
      marginHaircutFeedback: ratio,
    }),
    policy: z.strictObject({
      allowAssetSales: z.boolean(),
      routing: z.enum(["fifo", "network-matching", "hybrid", "genesis"]),
      routingOverheadBps: z.number().finite().min(0).max(10000),
    }),
    provenance: z.strictObject({
      kind: z.enum([
        "synthetic",
        "historically-inspired",
        "public-data-calibrated",
      ]),
      sources: z.array(label).max(100),
      sourceVintage: z.iso.date(),
      assumptions: z.array(label).min(1).max(100),
    }),
  })
  .superRefine((s, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (
      s.horizonHours / s.stepHours > 1000 ||
      Math.abs(
        s.horizonHours / s.stepHours - Math.round(s.horizonHours / s.stepHours),
      ) > 1e-8
    )
      error("Horizon must be an integer number of at most 1000 steps");
    const ids = new Set(s.actors.map((a) => a.id)),
      markets = new Set(s.markets.map((m) => m.assetClass)),
      evidenceIds = new Set(s.evidence.map((e) => e.id));
    for (const list of [
      s.actors,
      s.exposures,
      s.payments,
      s.margins,
      s.facilities,
      s.shocks,
      s.evidence,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        error("Duplicate ID");
    if (markets.size !== s.markets.length) error("Duplicate asset market");
    const known = (x: string) => {
      if (!ids.has(x)) error(`Unknown actor ${x}`);
    };
    for (const a of s.actors) {
      if (a.parentId) known(a.parentId);
      const seen = new Set([a.id]);
      let parent = a.parentId;
      while (parent) {
        if (seen.has(parent)) {
          error("Parent cycle");
          break;
        }
        seen.add(parent);
        parent = s.actors.find((x) => x.id === parent)?.parentId ?? null;
      }
      if (new Set(a.collateral.map((c) => c.id)).size !== a.collateral.length)
        error("Duplicate collateral lot");
    }
    for (const m of s.markets) known(m.liquidityProviderId);
    for (const m of s.margins) {
      known(m.payer);
      known(m.receiver);
      if (!markets.has(m.assetClass)) error("Margin market missing");
      if (m.payer === m.receiver) error("Self margin contract");
    }
    for (const f of s.facilities) {
      known(f.centralBankId);
      if (
        s.actors.find((a) => a.id === f.centralBankId)?.type !== "central-bank"
      )
        error("Facility issuer must be a central bank");
    }
    const pendingReleases = new Map<string, number>();
    for (const p of s.payments) {
      known(p.from);
      known(p.to);
      if (
        p.from === p.to ||
        p.deadlineHour < p.dueHour ||
        p.createdHour > p.dueHour
      )
        error("Invalid payment timing or endpoints");
      if (
        (p.status === "SETTLED" &&
          (p.remaining > 1e-7 || p.settledHour === null)) ||
        (p.status !== "SETTLED" && p.settledHour !== null) ||
        (p.settledHour !== null && p.settledHour > s.horizonHours)
      )
        error(`Payment ${p.id} has inconsistent status or settlement time`);
      for (const release of p.releasePledges) {
        known(release.actorId);
        const owner = s.actors.find((a) => a.id === release.actorId),
          lot = owner?.collateral.find((c) => c.id === release.lotId);
        if (release.actorId !== p.from || !lot) {
          error(`Payment ${p.id} has an invalid collateral release`);
          continue;
        }
        const key = `${release.actorId}\u0000${release.lotId}\u0000${release.contractId}`;
        const total = (pendingReleases.get(key) ?? 0) + release.quantity;
        pendingReleases.set(key, total);
        if (total > (lot.pledges[release.contractId] ?? 0) + 1e-7)
          error(`Payment ${p.id} releases unpledged collateral`);
      }
    }
    const steps = s.horizonHours / s.stepHours;
    if (s.actors.length * ((steps + 1) * (s.maxRounds + 1) + 1) > 150000)
      error("Snapshot budget exceeded");
    if (s.markets.some((m) => m.assetClass === "cash"))
      error("Cash is a settlement asset, not a mark-to-market security");
    for (const a of s.actors)
      for (const c of a.collateral) {
        if (
          ["cash", "reserves"].includes(c.account) &&
          (c.assetClass !== "cash" || c.price !== 1)
        )
          error("Cash collateral must have unit price and cash class");
        for (const facilityId of c.eligibleFacilities)
          if (!s.facilities.some((f) => f.id === facilityId))
            error("Unknown collateral facility");
      }
    for (const e of s.exposures) {
      known(e.creditor);
      known(e.debtor);
      const debtor = s.actors.find((a) => a.id === e.debtor);
      if (
        e.collateralIds.some(
          (id) => !debtor?.collateral.some((c) => c.id === id),
        )
      )
        error("Unknown exposure collateral");
      const securedValue =
        debtor?.collateral
          .filter((c) => e.collateralIds.includes(c.id))
          .reduce(
            (total, c) =>
              total +
              (c.pledges[`edge:${e.id}`] ?? 0) * c.price * (1 - c.haircut),
            0,
          ) ?? 0;
      if (e.securedAmount > securedValue + 1e-7)
        error("Secured exposure exceeds explicitly pledged collateral");
      if (e.securedAmount > e.principal)
        error("Secured amount exceeds principal");
    }
    const exposureIds = new Set(s.exposures.map((e) => e.id)),
      debtorIds = new Set(s.exposures.map((e) => e.debtor)),
      collateralClasses = new Set(
        s.actors.flatMap((a) => a.collateral.map((c) => c.assetClass)),
      ),
      collateralOwners = new Set(
        s.actors.filter((a) => a.collateral.length).map((a) => a.id),
      );
    for (const sh of s.shocks) {
      for (const evidenceId of sh.evidenceIds)
        if (!evidenceIds.has(evidenceId))
          error(`Shock ${sh.id} references unknown evidence ${evidenceId}`);
      const validTarget =
        sh.kind === "price"
          ? markets.has(sh.target as (typeof ASSET_CLASSES)[number])
          : sh.kind === "haircut"
            ? sh.target === "all" ||
              collateralOwners.has(sh.target) ||
              collateralClasses.has(sh.target as (typeof ASSET_CLASSES)[number])
            : sh.kind === "withdrawal" || sh.kind === "spread"
              ? sh.target === "all" ||
                debtorIds.has(sh.target) ||
                exposureIds.has(sh.target)
              : sh.kind === "physical"
                ? sh.target === "all"
                : ids.has(sh.target);
      if (!validTarget) error(`Invalid target for ${sh.kind} shock`);
      if (sh.hour > s.horizonHours) error("Shock beyond horizon");
      if (
        ["withdrawal", "haircut", "physical"].includes(sh.kind) &&
        (sh.magnitude < 0 || sh.magnitude > 1)
      )
        error("Fractional shock must be in [0,1]");
      if (sh.kind === "price" && (sh.magnitude > 1 || sh.magnitude < -10))
        error("Price shock outside [-10,1]");
      if (!["price", "spread"].includes(sh.kind) && sh.magnitude < 0)
        error("Negative shock magnitude");
      if (sh.kind === "default" && sh.magnitude !== 1)
        error("Default shock magnitude must be one");
      if (sh.kind === "outage" && sh.magnitude !== 0)
        error("Outage magnitude is reserved and must be zero");
      if (
        !["outage", "payment-demand"].includes(sh.kind) &&
        sh.durationHours !== 0
      )
        error(`Duration is not used by ${sh.kind} shocks and must be zero`);
      if (sh.kind === "outage" && sh.durationHours === 0)
        error("Outage duration must be positive");
    }
  });
export function parseScenario(value: unknown): Scenario {
  const s: Scenario = ScenarioSchema.parse(value);
  s.evidence = reconcileEvidence(s);
  assertFinancialState({
    ...s,
    hour: 0,
    round: 0,
    facilityLoans: [],
    events: [],
    warnings: [],
    response: "NORMAL",
    cumulativeSales: 0,
    cumulativeFacilityDraws: 0,
    cumulativeLoss: 0,
  });
  return s;
}
/** Bound parsing before JSON allocation; never accepts executable configuration. */
export function parseBoundedJSON(
  text: string,
  maximumBytes = 5_000_000,
): unknown {
  if (new TextEncoder().encode(text).byteLength > maximumBytes)
    throw new Error(`Import exceeds ${maximumBytes} bytes`);
  return JSON.parse(text, (key, value) => {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Unsafe object key");
    return value;
  });
}
