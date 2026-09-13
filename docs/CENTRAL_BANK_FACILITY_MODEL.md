# Central-bank facility model

The facility engine is a generic research contract. Names and parameters in bundled scenarios are synthetic; the engine does not represent a particular Federal Reserve facility or establish counterparty eligibility.

## Contract fields

Each facility specifies issuer, eligible actor types and collateral classes, haircut schedule, valuation rule, spread, term, per-request cap, counterparty limit, aggregate capacity, response lag, bullet repayment, renewal rule/count, stigma, usage preference, disclosure text, and whether nonnegative equity is required.

## Lifecycle

1. **Request:** calculate shortfall net of already-pending requests; check willingness, borrower eligibility, line/counterparty/aggregate capacity, and collateral capacity.
2. **Reserve:** immediately reserve collateral and capacity so concurrent delayed requests cannot reuse either.
3. **Decision:** after the configured lag, recompute need, eligibility, issuer/borrower operating state, and current collateral value. Reject and release reservations if a condition fails.
4. **Disbursement:** issue matched reserves and a central-bank loan asset; the borrower records reserves and borrowing. Neither party receives an equity transfer.
5. **Maintenance:** revalue collateral. Attempt a bounded top-up; otherwise accelerate maturity and report a warning.
6. **Repayment:** extinguish principal and reserves at bullet maturity and transfer simple interest based on spread and elapsed hours.
7. **Renewal/default:** a bounded reassessment may extend maturity. Otherwise the loan remains outstanding as `DEFAULTED` and its collateral stays encumbered; the engine does not erase a loss.

Facility reserves are spendable even when same-step settlement receipt recycling is disabled. This distinction prevents an anti-recycling experiment from accidentally disabling policy liquidity.

## Boundaries

- Support is liquidity provision, never solvency repair.
- A resolved, operationally unavailable, ineligible, or (when required) insolvent borrower cannot draw.
- Stigma is a disclosed deterministic willingness threshold, not an estimated demand curve.
- Collateral seizure, lender loss, resolution preference, legal eligibility, and emergency authority are outside the model.
- Facility comparisons condition on common input states and seeds; they are not policy recommendations.
