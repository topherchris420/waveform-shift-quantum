# Settlement network

## Claims and settlement

A payment is a directed obligation with payer, receiver, amount, remaining/settled/written-off components, due time, deadline, priority, kind, LGD, status, and any collateral release instructions. Claims remain on both balance sheets while queued or failed. Settlement transfers existing unencumbered cash/reserves and removes matching payable/receivable balances.

Eligible payments require both endpoints to be active, the due time to have arrived, the deadline not to have elapsed, and a deterministic keyed reliability draw to pass. Each payment receives one draw per hour; repeated propagation rounds do not create new random chances.

## Modes

- **Gross:** each obligation must be funded in full. The engine rescans the queue when recycling is enabled so receipts can fund downstream payments within the same step.
- **Bilateral netting:** reciprocal claims are cancelled by equal amount before residual gross settlement. No reserves are issued by netting.
- **FIFO:** priority, due time, then stable ID.
- **Network matching / hybrid / Genesis:** after priority, payments that release recipients with more queued outgoing value move earlier. All use the same visible queue and liquidity. Hybrid and Genesis may incur the configured routing fee; Genesis has no privileged funds.

When recycling is disabled, the payer cannot spend receipts obtained from settlement during that macro step, even across propagation rounds. Fresh liquidity from a facility, asset sale, or committed line remains spendable. This models a funding constraint, not a specific payment-system operating rule.

At the deadline an unpaid claim becomes `FAILED`; it remains on balance sheets unless a separately modeled resolution write-down occurs. Settlement failure is not silently converted into disappearance or cash.

## Scope boundary

The engine is inspired by general payment-system risk and FMI concepts. It is not Fedwire, FedNow, CHIPS, CLS, a CCP rulebook, a daylight-overdraft implementation, or an operational resilience certification. The public [Federal Reserve Payment System Risk overview](https://www.federalreserve.gov/paymentsystems/psr_about.htm) and [PFMI](https://www.bis.org/cpmi/publ/d101a.pdf) are background references, not calibrations.
