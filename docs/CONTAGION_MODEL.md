# Contagion model

## Event order

The engine uses fixed macro steps and bounded within-step propagation rounds. At a step it applies scheduled shocks once, accrues simple funding interest for active counterparties, processes maturity/behavioral funding reactions, records the pre-policy state, then iterates:

1. permitted intragroup or committed liquidity support;
2. facility requests and decisions;
3. margin processing;
4. collateral revaluation and counterparty resolution;
5. forced sales for remaining liquidity shortfalls;
6. endogenous haircut feedback;
7. any routing cost;
8. settlement;
9. accounting and collateral invariants;
10. state/metric recording and convergence test.

The sequence is part of the model, is recorded in the source version, and should be varied in model-risk work. It is not a claim about universal real-world event order.

## Explicit transmission channels

- **Contractual:** default writes down the unsecured portion of directed claims.
- **Funding:** non-rollover, exogenous withdrawal, or behavioral reactions turn existing funding into due payments.
- **Settlement:** outages, reliability, priorities, liquidity, and deadlines determine which claims settle or fail.
- **Collateral:** price/haircut changes lower support capacity and may trigger top-ups or accelerated facility maturity.
- **Market:** an actor sells unencumbered assets to a finite-cash buyer; the resulting price applies to all holders.
- **Margin:** price changes generate cash calls or revalue substituted collateral.
- **Institutional:** ownership, transfer limits, and ring-fencing determine whether parent or committed support can move.
- **Physical:** resource destruction affects physical capacity only; financial liquidity cannot restore it.

No counterparty edge means no contractual-loss transmission. A common price can still connect two holders, and settlement claims can still connect payer and receiver, because those are separate explicit edges.

## Convergence and failure

Within a macro step, the engine compares a rounded signature of liquidity shortfall, equity, queue value, facility use, and price dislocation. Two consecutive identical signatures stop iteration. Reaching the configured round maximum emits a numerical warning and does not masquerade as an economic result. Step, actor, snapshot, payment, and event budgets fail closed rather than allowing an unbounded browser workload.

The response state machine distinguishes normal, liquidity stress, market stress, facility support, systemic stress, stabilization, and recovery. Recovery is observed only after thresholds clear through a stabilization state. If it is not observed within the horizon, recovery time is `null`.

## Limitations

The simulator does not include an endogenous macroeconomy, deposit creation by commercial banks, a complete interdealer market, secured-closeout mechanics, a bankruptcy waterfall, legal netting opinions, stochastic default intensities, optimal behavior, or an equilibrium price process. Multiple rounds reveal feedback inside the declared mechanism graph; they do not make the model empirically identified.
