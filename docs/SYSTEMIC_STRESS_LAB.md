# Systemic Stress & Coordination Lab

## Status and purpose

The Systemic Stress & Coordination Lab is a transparent, deterministic research simulator at `/systemic-lab`. It helps a researcher turn an explicit systemic-risk hypothesis into inspectable balance-sheet, funding, collateral, market, settlement, and policy experiments. It is not a production supervision system, a regulatory-ratio calculator, a forecast, or an implementation of any Federal Reserve model.

The relevant epistemic categories are:

- **Established economic / financial mechanism:** double-entry accounting, debt claims, collateral encumbrance, margin, settlement, and default losses are real mechanisms. Their representation here is simplified.
- **Stylized economic simulation:** all bundled institutions, networks, balances, behavioral rules, market curves, and numerical shocks are synthetic.
- **Experimental coordination mechanism:** Genesis is an optional payment-sequencing comparator. It receives no additional money, collateral, information, or physical capacity.
- **Testable hypothesis:** a DRR signal can motivate several simulations whose predicted observables may agree or disagree with selected features.
- **Interpretive claim:** simulated agreement never identifies the real-world cause of an observation.

These classifications are independent of the repository's physics classifications. See [PHYSICS_WORKSTATION.md](PHYSICS_WORKSTATION.md).

## Policy Desk workflow

1. Select a synthetic flagship experiment or import a strict `systemic-scenario.v1` file.
2. Inspect starting actors, legal-entity ownership, funding and settlement networks, collateral, and evidence rows.
3. Change an explicit parameter and rerun; the evidence registry marks the edited value as researcher-modified.
4. Follow the timeline and select an actor to inspect accounts, liquidity, capital proxy, collateral, and the event/posting chain.
5. Compare no intervention, market adjustment, facility designs, settlement support, hybrid routing, and Genesis routing from common starting states.
6. Run uncertainty, policy robustness, layer ablation, exploratory calibration, or a preregistered holdout experiment.
7. Import a DRR `SystemicSignal`, explicitly map its observed institution to a synthetic actor, and compare six mechanisms.
8. Export a policy passport and replay it under the matching model version.

## Flagship synthetic experiments

| Experiment                     | Main disturbance                                                     | Mechanisms available for inspection                                                                                           |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| LFBO Dollar-Funding Stress     | deposit and repo withdrawal, higher haircuts/spreads, payment demand | parent/IHC/branch topology, ring-fencing, intragroup support, funding conversion, facility delay, settlement, asset sales     |
| Intraday Settlement Disruption | participant outage with short deadlines                              | queued claims, priorities, gross or bilateral netting, liquidity recycling, failure after deadline                            |
| Fire-Sale / Margin Spiral      | Treasury price shock                                                 | fair-value losses, margin calls, collateral encumbrance, forced sales, exponential price impact, second-round capital effects |

The fixtures are historically inspired only in the sense that public literature motivates the mechanism categories. They do not reproduce a named episode, and their numbers are not attributed to observed institutions.

## Public scenario paths

The adapter accepts either a normalized ten-quarter path (Q0 through Q9) or the Federal Reserve's published domestic scenario CSV shape. For a published file, the caller supplies its source, publication date, scenario kind, and optional ten-quarter window because those metadata are not encoded in the CSV. The adapter maps the documented domestic columns, calculates the corporate spread as BBB corporate yield minus the 10-year Treasury yield, and preserves provenance for every observation. It never relabels the BBB yield itself as a spread.

Only disclosed variable mappings become simulation shocks; unmapped variables remain visible. The bundled path is synthetic. An imported public path is applied to this lab's transparent propagation model; it does not become a Federal Reserve supervisory stress test or reproduce supervisory loss and capital models.

Current background references include the Federal Reserve's [2026 stress-test scenario and data page](https://www.federalreserve.gov/supervisionreg/dfa-stress-tests-2026.htm), [FBO supervision topics](https://www.federalreserve.gov/supervisionreg/topics/fbo_supervision.htm), and [Payment System Risk policy overview](https://www.federalreserve.gov/paymentsystems/psr_about.htm), plus the BIS-hosted [Principles for Financial Market Infrastructures](https://www.bis.org/cpmi/publ/d101a.pdf) and [Review of margining practices](https://www.bis.org/bcbs/publ/d537.htm). These sources do not validate the implementation or bundled parameter values.

## Units and bounds

- Monetary stock and flow fields: USD millions.
- Rates: fractions unless the name ends in `Bps`; user-facing views convert them to percentages or basis points.
- Time: hours; quarterly mode uses nine synthetic 90-day quarters with 72-hour steps.
- Physical capacity: separate resource units, never created by financial intervention.
- Strict schemas reject unknown keys, non-finite numbers, invalid references, duplicate IDs, unsafe JSON keys, inconsistent payment totals, excess collateral pledges, and workloads above fixed bounds.

## Further documentation

- [Financial mechanisms](FINANCIAL_MECHANISMS.md)
- [Facility model](CENTRAL_BANK_FACILITY_MODEL.md)
- [Settlement network](SETTLEMENT_NETWORK.md)
- [Contagion model](CONTAGION_MODEL.md)
- [Genesis comparator](GENESIS_EXPERIMENT.md)
- [DRR bridge](DRR_GENESIS_BRIDGE.md)
- [Policy passports](POLICY_SIMULATION_PASSPORT.md)
- [Validation](VALIDATION.md)
- [Model risk, security, and adversarial review](MODEL_RISK_AND_REVIEW.md)
