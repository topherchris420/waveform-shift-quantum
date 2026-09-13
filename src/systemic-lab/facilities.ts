import {
  actor,
  capitalPosition,
  event,
  liquid,
  liquidPostings,
  liquidityPosition,
  post,
  sum,
} from "./accounting";
import { CollateralEngine, collateralUnitValue } from "./collateral";
import { evidencePaths } from "./evidence";
import {
  TOLERANCE,
  type CentralBankFacility,
  type FacilityLoan,
  type SystemicState,
} from "./types";
export const outstanding = (loan: FacilityLoan) =>
  ["PENDING", "ACTIVE", "DEFAULTED"].includes(loan.status);
function facilityEvidence(
  state: SystemicState,
  facility: CentralBankFacility,
): string[] {
  const root = `facilities.${state.facilities.findIndex((f) => f === facility)}`;
  return evidencePaths(
    state,
    `${root}.borrowingCap`,
    `${root}.counterpartyLimit`,
    `${root}.capacity`,
    `${root}.responseLagHours`,
    `${root}.termHours`,
    `${root}.spreadBps`,
    `${root}.stigma`,
    `${root}.usagePreference`,
  );
}
export class FacilityEngine {
  static eligible(
    state: SystemicState,
    facility: CentralBankFacility,
    id: string,
  ): boolean {
    const a = actor(state, id);
    return (
      facility.eligibleCounterparties.includes(a.type) &&
      !a.resolved &&
      a.outageUntil <= state.hour &&
      (!facility.requireSolvent || a.balanceSheet.equity >= 0) &&
      !state.facilityLoans.some(
        (l) => l.borrower === id && l.status === "DEFAULTED",
      )
    );
  }
  static request(
    state: SystemicState,
    facility: CentralBankFacility,
    id: string,
  ): FacilityLoan | null {
    const a = actor(state, id);
    const pending = sum(
      state.facilityLoans
        .filter((l) => l.borrower === id && l.status === "PENDING")
        .map((l) => l.amount),
    );
    const need = Math.max(0, liquidityPosition(state, a).shortfall - pending);
    if (need <= TOLERANCE) return null;
    const used = sum(
      state.facilityLoans
        .filter((l) => l.facilityId === facility.id && outstanding(l))
        .map((l) => l.amount),
    );
    const borrowerUse = sum(
      state.facilityLoans
        .filter(
          (l) =>
            l.facilityId === facility.id && l.borrower === id && outstanding(l),
        )
        .map((l) => l.amount),
    );
    const willing =
      facility.usagePreference >=
      facility.stigma * a.behavior.stigmaSensitivity;
    const amount = Math.max(
      0,
      Math.min(
        need,
        facility.borrowingCap,
        facility.counterpartyLimit - borrowerUse,
        facility.capacity - used,
        CollateralEngine.inspect(a, facility, state.hour).borrowingCapacity,
      ),
    );
    if (
      !this.eligible(state, facility, id) ||
      !willing ||
      amount <= TOLERANCE
    ) {
      // One explanation per facility, borrower and hour, independent of iterative passes.
      if (
        !state.events.some(
          (e) =>
            e.hour === state.hour &&
            e.actorId === id &&
            e.edgeId === facility.id &&
            e.mechanism === "facility-ineligible",
        )
      )
        event(state, {
          actorId: id,
          mechanism: "facility-ineligible",
          amount: need,
          units: "USD million",
          previous: need,
          next: need,
          calculation: !this.eligible(state, facility, id)
            ? "Counterparty, solvency, outage or prior facility-default rule failed."
            : !willing
              ? "Usage preference below explicit stigma cost."
              : "Borrowing cap, aggregate capacity or haircut-adjusted collateral is binding.",
          evidenceIds: facilityEvidence(state, facility),
          edgeId: facility.id,
        });
      return null;
    }
    const loan: FacilityLoan = {
      id: `facility-loan:${state.facilityLoans.length}`,
      facilityId: facility.id,
      borrower: id,
      amount,
      requestedHour: state.hour,
      decisionHour: state.hour + facility.responseLagHours,
      maturityHour: state.hour + facility.responseLagHours + facility.termHours,
      status: "PENDING",
      renewals: 0,
      pledged: [],
    };
    loan.pledged = CollateralEngine.pledge(
      a,
      facility,
      loan.id,
      amount,
      state.hour,
    );
    state.facilityLoans.push(loan);
    event(state, {
      actorId: id,
      mechanism: "facility-request",
      amount,
      units: "USD million",
      previous: 0,
      next: amount,
      calculation:
        "min(shortfall, unreserved capacity, borrower limit, borrowing cap, haircut-adjusted eligible collateral). Collateral and capacity reserved during operational delay.",
      evidenceIds: facilityEvidence(state, facility),
      edgeId: loan.id,
    });
    return loan;
  }
  static process(state: SystemicState): void {
    for (const loan of state.facilityLoans) {
      const facility = state.facilities.find((f) => f.id === loan.facilityId)!;
      const a = actor(state, loan.borrower),
        cb = actor(state, facility.centralBankId);
      if (loan.status === "PENDING" && state.hour >= loan.decisionHour) {
        const coverage = sum(
          loan.pledged.map(
            (p) =>
              p.quantity *
              collateralUnitValue(
                a.collateral.find((c) => c.id === p.lotId)!,
                facility,
                state.hour,
              ),
          ),
        );
        const need = liquidityPosition(state, a).shortfall;
        const amount = Math.min(loan.amount, coverage, need);
        CollateralEngine.release(a, loan.id);
        if (
          !this.eligible(state, facility, a.id) ||
          cb.outageUntil > state.hour ||
          amount <= TOLERANCE
        ) {
          loan.status = "REJECTED";
          loan.pledged = [];
          event(state, {
            actorId: a.id,
            mechanism: "facility-rejection",
            amount: loan.amount,
            units: "USD million",
            previous: "PENDING",
            next: "REJECTED",
            calculation:
              "Eligibility, operational status, need and current collateral are rechecked at disbursement.",
            evidenceIds: facilityEvidence(state, facility),
            edgeId: loan.id,
          });
          continue;
        }
        loan.amount = amount;
        loan.pledged = CollateralEngine.pledge(
          a,
          facility,
          loan.id,
          amount,
          state.hour,
        );
        post(
          state,
          [
            { actorId: a.id, account: "reserves", delta: amount },
            { actorId: a.id, account: "centralBankBorrowing", delta: amount },
            { actorId: cb.id, account: "centralBankLoans", delta: amount },
            { actorId: cb.id, account: "reserveLiabilities", delta: amount },
          ],
          {
            actorId: a.id,
            mechanism: "facility-disbursement",
            amount,
            units: "USD million",
            previous: liquid(a),
            next: liquid(a) + amount,
            calculation:
              "Central bank issues matched reserves/loan assets; borrower records reserves/debt. Equity and physical capacity are unchanged.",
            evidenceIds: facilityEvidence(state, facility),
            edgeId: loan.id,
          },
        );
        loan.status = "ACTIVE";
        loan.decisionHour = state.hour;
        loan.maturityHour = state.hour + facility.termHours;
        state.cumulativeFacilityDraws += amount;
      }
      if (loan.status !== "ACTIVE") continue;
      const coverage = sum(
        loan.pledged.map(
          (p) =>
            p.quantity *
            collateralUnitValue(
              a.collateral.find((c) => c.id === p.lotId)!,
              facility,
              state.hour,
            ),
        ),
      );
      if (coverage + TOLERANCE < loan.amount) {
        const extra = Math.min(
          loan.amount - coverage,
          CollateralEngine.inspect(a, facility, state.hour).borrowingCapacity,
        );
        if (extra > TOLERANCE)
          loan.pledged.push(
            ...CollateralEngine.pledge(a, facility, loan.id, extra, state.hour),
          );
        if (coverage + extra + TOLERANCE < loan.amount) {
          const warning = `${loan.id}: collateral shortfall; accelerated repayment requested at hour ${state.hour}`;
          if (!state.warnings.includes(warning)) state.warnings.push(warning);
          loan.maturityHour = Math.min(loan.maturityHour, state.hour);
        }
      }
      if (state.hour < loan.maturityHour) continue;
      const interest =
        (((loan.amount * facility.spreadBps) / 10000) *
          (state.hour - loan.decisionHour)) /
        8760;
      const due = loan.amount + interest;
      if (
        liquid(a) + TOLERANCE >= due &&
        !a.resolved &&
        a.outageUntil <= state.hour
      ) {
        post(
          state,
          [
            ...liquidPostings(a, due),
            {
              actorId: a.id,
              account: "centralBankBorrowing",
              delta: -loan.amount,
            },
            { actorId: a.id, account: "equity", delta: -interest },
            {
              actorId: cb.id,
              account: "centralBankLoans",
              delta: -loan.amount,
            },
            { actorId: cb.id, account: "reserveLiabilities", delta: -due },
            { actorId: cb.id, account: "equity", delta: interest },
          ],
          {
            actorId: a.id,
            mechanism: "facility-repayment",
            amount: due,
            units: "USD million",
            previous: loan.amount,
            next: 0,
            calculation: `Bullet principal plus simple annual spread × elapsed hours / 8760; interest=${interest}. Reserves extinguished.`,
            evidenceIds: facilityEvidence(state, facility),
            edgeId: loan.id,
          },
        );
        loan.status = "REPAID";
        CollateralEngine.release(a, loan.id);
        loan.pledged = [];
      } else if (
        facility.renewalRule === "reassess" &&
        loan.renewals < facility.maxRenewals &&
        coverage + TOLERANCE >= loan.amount &&
        this.eligible(state, facility, a.id)
      ) {
        loan.renewals++;
        loan.maturityHour += facility.termHours;
        event(state, {
          actorId: a.id,
          mechanism: "facility-renewal",
          amount: loan.amount,
          units: "USD million",
          previous: loan.maturityHour - facility.termHours,
          next: loan.maturityHour,
          calculation:
            "Reassessed counterparty and collateral; interest continues accruing from original disbursement.",
          evidenceIds: facilityEvidence(state, facility),
          edgeId: loan.id,
        });
      } else {
        loan.status = "DEFAULTED";
        event(state, {
          actorId: a.id,
          mechanism: "facility-default",
          amount: due,
          units: "USD million",
          previous: "ACTIVE",
          next: "DEFAULTED",
          calculation:
            "Bullet repayment failed. Principal remains outstanding and collateral stays encumbered; no loss is erased.",
          evidenceIds: facilityEvidence(state, facility),
          edgeId: loan.id,
        });
      }
    }
  }
}
