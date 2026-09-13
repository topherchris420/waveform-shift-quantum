import { emptyBalanceSheet } from "../../systemic-lab/accounting";
import type {
  FinancialInstitution,
  SystemicState,
  CentralBankFacility,
} from "../../systemic-lab/types";
export function institution(id = "bank"): FinancialInstitution {
  const balanceSheet = emptyBalanceSheet();
  balanceSheet.assets.reserves = 20;
  balanceSheet.assets.securities = 100;
  balanceSheet.liabilities.uninsuredDeposits = 100;
  balanceSheet.equity = 20;
  return {
    id,
    name: id,
    type: "commercial-bank",
    jurisdiction: "US",
    parentId: null,
    balanceSheet,
    collateral: [
      {
        id: `${id}-t`,
        assetClass: "treasury",
        account: "securities",
        quantity: 100,
        price: 1,
        haircut: 0.1,
        liquidityClass: 1,
        eligibleFacilities: ["facility"],
        valuationUncertainty: 0.05,
        maturityHours: 8760,
        durationYears: 2,
        priceSensitivity: 1,
        pledges: {},
      },
    ],
    behavior: {
      role: "treasury",
      withdrawalElasticity: 0.2,
      riskAversion: 0.1,
      hoarding: 0.05,
      herding: 0.1,
      stigmaSensitivity: 0,
      calibrationType: "STYLIZED_ASSUMPTION",
    },
    capitalFloor: 0.06,
    riskWeight: 0.8,
    liquidityBuffer: 0,
    outageUntil: 0,
    resolved: false,
  };
}
export function stateOf(actors = [institution()]): SystemicState {
  return {
    hour: 0,
    round: 0,
    actors,
    exposures: [],
    payments: [],
    margins: [],
    markets: [],
    evidence: [],
    facilities: [],
    facilityLoans: [],
    physical: { capacity: 100, demand: 100, units: "resource units" },
    events: [],
    warnings: [],
    response: "NORMAL",
    cumulativeSales: 0,
    cumulativeFacilityDraws: 0,
    cumulativeLoss: 0,
  };
}
export function facility(): CentralBankFacility {
  return {
    id: "facility",
    name: "Research facility",
    centralBankId: "cb",
    eligibleCounterparties: ["commercial-bank"],
    eligibleCollateral: ["treasury"],
    haircutSchedule: { treasury: 0.2 },
    valuationRule: "market-minus-uncertainty",
    spreadBps: 100,
    termHours: 48,
    borrowingCap: 100,
    counterpartyLimit: 100,
    capacity: 200,
    responseLagHours: 0,
    repaymentRule: "bullet",
    renewalRule: "none",
    maxRenewals: 0,
    stigma: 0,
    usagePreference: 1,
    disclosure: "Synthetic public record",
    requireSolvent: true,
  };
}
