# Financial mechanisms

## Accounting state

Every actor has named asset accounts, liability accounts, and equity. Every transaction is staged on cloned balance sheets and commits only if each affected actor satisfies

\[
A = L + E
\]

within the disclosed numerical tolerance. Negative asset/liability accounts and non-finite values fail the run. The event ledger records the postings, actor, time, propagation round, previous/next value, formula narrative, evidence IDs, and related edge.

Opening synthetic funding claims are grossed up on both counterparties' balance sheets. This is a fixture-construction convention, not a claim about origination economics. A funding withdrawal reclassifies an existing claim into a payment receivable/payable and does not change equity. A new operating payment is recorded as payer expense/payable and receiver income/receivable before settlement.

## Liquidity versus solvency

Available liquidity is unencumbered cash plus reserves. An actor's liquidity need is due outbound payments plus unpaid initial margin plus its configured liquidity buffer. This produces `ADEQUATE`, `ILLIQUID`, `FACILITY_DEPENDENT`, or `SETTLEMENT_SUSPENDED` status.

The capital view is labeled `SIMULATION_CAPITAL_PROXY`. It computes equity/assets and a synthetic risk-weighted capital proxy. It is not CET1, leverage-ratio, liquidity-coverage-ratio, or supervisory-rule code. A facility can add reserves and debt to a solvent-but-illiquid actor; it does not raise equity or repair insolvency.

## Funding and intragroup support

Each directed edge points creditor to debtor and names the corresponding asset and liability accounts, principal, maturity, rollover probability, LGD, collateral, spread, transfer limit, and restriction flag. Non-rollover and behavioral withdrawals convert only existing principal into due payments.

Committed-liquidity and intragroup edges can supply a shortfall from the lender's existing unencumbered liquidity. The transfer is limited by the remaining line, ring-fencing, outages, solvency, the lender's liquidity buffer, and its disclosed hoarding fraction. It creates matched funding assets/liabilities and no equity or money. Disabling the institutional layer disables this support mechanism.

## Collateral

For collateral lot \(i\), facility borrowing value is

\[
q_i p_i\left(1-\max(h_i,h_{f,i})\right)(1-u_i),
\]

where \(q\) is unencumbered quantity, \(p\) is price, \(h\) is the larger of lot and facility haircut, and \(u\) is valuation uncertainty. Eligibility, quantity, price, maturity, liquidity class, account, and every pledge are explicit. A unit cannot be sold or pledged twice.

Secured default protection uses current pledged value after haircut and uncertainty. Collateral allocated to a converted withdrawal claim is not simultaneously counted on the residual exposure.

## Margin

Variation margin is the full amount above the transfer threshold:

\[
VM=N(P_{last}-P_{now})s.
\]

The reference price does not reset below threshold, so sub-threshold moves accumulate. A call becomes a matched payment claim. Initial cash margin becomes a returnable derivatives-collateral asset for the payer and a collateral-return liability for the receiver. When substitution is enabled, unencumbered noncash collateral may instead be pledged after haircut and uncertainty; ownership, cash, and equity do not change.

This is a synthetic bilateral convention. It does not implement a CCP rulebook, close-out netting, default fund, liquidation waterfall, or legal segregation regime.

## Default and resolution

Resolution suspends the participant. For a contractual exposure, the creditor loss is

\[
\max(0,\;principal-current\ secured\ value)\times LGD.
\]

The creditor reduces its claim and equity; the debtor reduces the corresponding liability and recognizes resolution income. For a payment claim, the same rule uses the payment's explicit LGD and any collateral released only when that payment settles. The remaining claim stays frozen and the failed/written-off portions remain separately reconciled:

\[
amount=remaining+settled+writtenOff.
\]

This is a research loss rule, not a bankruptcy, resolution, netting, or recovery model.

## Market impact

Sales require an explicit buyer with finite cash. For sale notional \(S\), market price changes by

\[
P_{new}=P_{old}\exp(-\lambda S/D),
\]

where \(D\) is market depth and \(\lambda\) is elasticity. Each holding is marked by quantity × market-price change × its explicit price sensitivity before the sale transfers cash and quantity. Liquidity tier orders markets/lots, and a nonzero volatility parameter creates a seeded lognormal price innovation scaled to the step length. Pure financial shocks leave physical resource capacity unchanged.

## Metrics

Reported values include liquidity shortfall, capital impairment, payment queue/failure/completion, delay, recycling, collateral availability/encumbrance, asset sales, price dislocation, facility use, counterparty/funding HHI, directed density, cascade breadth/depth, and a cumulative modeled-loss proxy. “Systemic loss proxy” is not social welfare, GDP loss, or a regulatory loss estimate. Recovery remains `null` when recovery is not observed.
