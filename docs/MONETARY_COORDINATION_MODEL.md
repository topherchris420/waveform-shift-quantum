# Monetary Coordination and Resource Resonance Research Model

## Research question and scope

> Under what observable physical, informational, financial, behavioral, and institutional conditions does direct computational resource allocation outperform market-mediated allocation, and under what conditions do markets or hybrid mechanisms outperform direct computation?

Resource Resonance is a stylized, deterministic-seed simulation. It is designed to reject as well as support hypotheses. It does **not** claim that money is an allocation algorithm, that markets are inherently harmful, or that Genesis is universally superior. Results apply only to modeled regimes and are not empirical policy estimates. The physics workstation is epistemically separate from this economic simulation.

## Epistemic labels

- **SIMULATION ASSUMPTION:** generated agents, conversion coefficients, geography, shocks, costs, behavioral responses, and institutional rejection rules.
- **MECHANISM:** an explicit allocation and, where relevant, payment/settlement procedure.
- **OBSERVABLE STATE:** bids, asks, prices, or reported telemetry available to a mechanism.
- **HIDDEN EVALUATION VARIABLE:** true urgency, demand, reliability, private value, physical compatibility, and realized delivered utility used only to score outcomes.
- **RESULT:** a paired-seed comparison within a declared parameter regime.
- **INTERPRETATION LIMIT:** neither simulated welfare nor an oracle upper bound establishes external validity.

## What markets model

Money is not itself an allocation algorithm. Markets combine decentralized price discovery and incentives with budgets, credit, collateral, counterparties, and settlement. A solvent buyer can be illiquid; a liquidity backstop can relax a settlement constraint but cannot create energy, compute, storage, or network capacity. Markets can use computation and physical telemetry, which is why the benchmark includes an algorithmic shadow-price market rather than comparing Genesis only with a weak price heuristic.

## Mechanisms

1. **Market (`market`) — heuristic price-matching baseline.** Preserved for backward compatibility. Synthetic price and bid scores rank feasible edges; budgets, credit, solvency, and stochastic settlement bind. It is not described as a competitive equilibrium.
2. **Double auction (`doubleAuction`).** Buyers report shaded bids derived from private willingness-to-pay; sellers report asks derived from private marginal costs. Compatible trades require bid at least ask and clear at the bid/ask midpoint. Physical quantity, budgets, credit, and settlement remain binding. Private values are hidden from clearing.
3. **Shadow-price computational market (`shadowPriceMarket`).** A maximum-weight physical flow proposes trades using the same feasible network used by direct allocators, then financial constraints bind. The displayed shadow price is a documented scarcity approximation (optimized attainable welfare divided by capacity), not an exact LP dual.
4. **Stabilized market (`stabilizedMarket`).** The heuristic market with a capacity-limited lender-of-last-resort for solvent liquidity gaps. Rescue consumes backstop capacity and adds overhead.
5. **Hybrid.** Combines reported physical telemetry and price ranks, then applies financial settlement.
6. **Maximum-weight matching (`maxWeightMatching`).** A nonmonetary maximum-weight divisible flow. This is appropriate to the modeled divisible commodities; top-trading-cycles and stable-marriage algorithms are intentionally omitted because their ownership/indivisibility assumptions do not match this network.
7. **Genesis.** Direct reported-telemetry routing without monetary settlement, with explicit telemetry verification and coordination costs.
8. **Oracle.** A hidden-state maximum-weight flow subject to supply, demand, compatibility, conversion, geography, and physical availability, but not monetary settlement. Successive longest augmenting paths with reverse residual arcs solve the continuous bipartite transportation problem and can undo earlier assignments. This replaces a local greedy ordering.

## Counterfactual fairness

Each ensemble draw constructs one base world. The oracle, every mechanism, and every provider-failure cascade receive independent deep copies, including nested resource vectors. No comparator observes another mechanism's balance changes. Architecture evaluation order therefore cannot alter results. Paired mechanisms use the same world seed, renewable shock, agent population, and random seed. Public evaluation functions clone at their boundary to support deterministic replay.

The evaluator reports raw architecture welfare, oracle welfare, oracle gap, and

$$\text{efficiency ratio}=\frac{\text{architecture welfare}}{\text{oracle welfare}}.$$

No architecture may exceed the physical oracle beyond numerical tolerance.

## Information and strategic behavior

Truth and reports are separate: true/reported urgency, demand, scarcity, and reliability coexist with private value/reported bid and marginal cost/reported ask. Misreport probability and magnitude, auditing, penalties, bid shading, and telemetry manipulation are configurable. Allocation uses reports; hidden evaluation uses true physical utility. Reported diagnostics include manipulation vulnerability and false-critical allocation rate.

Matched comparisons estimate, rather than assert, an information effect, a mechanism effect, and their interaction. These are factorial contrasts in this stylized model, not identified causal estimates from real data.

## Constraints and conserved accounting

A route must be compatible, geographically reachable, and capacity-feasible. Conversion coefficients reduce delivered quantity. Monetary mechanisms additionally face compliance, behavior, balance, haircut-adjusted credit, collateral, solvency, and settlement checks. Balances are floored at zero; failed trades transfer nothing. Delivered quantity cannot exceed feasible supply or demand.

Unmet demand is decomposed into physical shortage, financial exclusion, behavioral friction, institutional friction, information friction, network constraints, compatibility constraints, and residual coordination failure. This attribution is model bookkeeping, not empirical causal identification.

## Objective and multi-metric interpretation

The hidden edge objective rewards delivered physical utility adjusted for quality, true demand and urgency, conversion, location, and reliability. The UI also reports fulfillment, waste, latency, concentration, cascade loss, shortfall Gini, overhead, settlement failure, liquidity shortfall, and telemetry sensitivity. A scalar ranking is conditional on the declared objective and overhead assumptions. Where confidence intervals overlap, the verdict is no significant difference; risk gates may yield insufficient evidence. Multi-metric disagreements should be interpreted as Pareto tradeoffs, not universal wins.

## Experimental protocol

Discovery searches only its declared seed bank. Parameters and predicted effects are frozen before challenge. Holdout adjudication uses disjoint paired seeds and requires a practical effect, confidence bound above zero, superiority to strong non-oracle comparators, an improving oracle gap, consistency, all risk gates, and overhead robustness. Searching many regions increases false-discovery risk; the current fixed grid is transparent but does not yet implement a formal family-wise correction. The experiment hash records the seed and canonical parameter content for replay.

Valid conclusions include market, double-auction, shadow-price market, stabilized-market, hybrid, matching, or regime-specific Genesis superiority; Pareto tradeoff; no significant difference; and insufficient evidence. Genesis is never granted superiority merely for beating the heuristic market.

## Adversarial regimes

Presets and parameter exports support market-friendly liquidity/private-preference cases, compatibility-dominant routing, liquidity freezes with physical abundance, telemetry corruption, urgency manipulation, extreme physical scarcity, and coupled crises. Severe scarcity is a negative control: no mechanism should remove a real shortage. Forecast-horizon parameters are reserved in the experiment schema, but rolling storage dynamics and genuine model-predictive control are not yet implemented.

## Remaining limitations

The model has synthetic rather than estimated preferences and institutions; three resource classes; a static one-period network; divisible flows; stylized geography; approximate rather than exact reported shadow-price duals; simplified bidding and auditing; and no endogenous entry, production, investment, learning, mechanism-design equilibrium, or general-equilibrium feedback. Confidence intervals quantify seeded simulation variation, not model uncertainty. Real-world claims require calibration, external data, preregistration outside the codebase, robustness across alternative objectives, and independent replication.
