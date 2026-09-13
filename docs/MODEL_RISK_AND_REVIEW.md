# Model risk, security, and adversarial review

## Intended use

The lab is an education/research instrument for forming and comparing transparent systemic-risk hypotheses. It can help a researcher locate which declared mechanism produced a simulated outcome. It must not be used as the sole basis for supervisory findings, firm ratings, liquidity requirements, collateral eligibility, lending decisions, trading, forecasts, or emergency-policy decisions.

## Known model risk

- Bundled institutions and parameter values are synthetic. Public publications motivate mechanisms and path formats only.
- Opening funding claims are grossed up rather than reconstructed from historical transactions.
- Accounting is internally consistent but the chart of accounts, capital proxy, resolution rule, and margin contract are simplified.
- Results depend on discrete event order, timestep, propagation cap, thresholds, network completeness, and the selected inverse-demand curve.
- Behavioral withdrawal, hoarding, stigma, herding, and intragroup-support rules are deterministic stylizations, not estimated reactions.
- The market has a finite designated buyer rather than endogenous matching/equilibrium. Volatility innovations are seeded modeling assumptions.
- Settlement lacks daylight overdraft rules, multilateral netting, queues with cancellation/reprioritization, legal finality, and an FMI recovery waterfall.
- Facility lending omits legal authority, actual terms/eligibility, collateral operations, lender loss, and broad monetary-policy transmission.
- Collateral maturity is measured from scenario time zero; duration, liquidity class, and price sensitivity are reduced-form fields.
- The nine-quarter adapter maps only disclosed variables and uses 72-hour steps; it cannot preserve intraday dynamics.
- DRR fit compares selected compatible features. Omitted variables, measurement error, correlated mechanisms, and mapping choice can dominate a ranking.
- Hashes provide content integrity, not signatures or provenance authentication.

## Adversarial review record

The final implementation pass simulated five perspectives and treated all Critical and Important findings as blockers.

| Reviewer                    | Severity  | Blocking issue found                                                                                                                                                                     | Resolution                                                                                                                                                                                                                                                                |
| --------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Central-bank economist      | Important | support could not be distinguished from solvency repair; accepted inputs could silently do nothing                                                                                       | facility postings preserve equity; insolvent borrowers are ineligible; intragroup support uses existing parent liquidity; volatility, price sensitivity, funding dependency, collateral maturity, and tiers now affect mechanics                                          |
| Bank supervisor             | Important | edited assumptions could retain stale provenance; round-selected network/actor explanations could show final-state data                                                                  | evidence rows are reconciled to current values and reclassified after edits; snapshots now store liquidity and edges; inspector filters postings through the selected hour/round; shock targets and unused fields fail closed                                             |
| Payment-systems researcher  | Critical  | no-recycling budget reset across rounds and could also block newly issued facility liquidity; defaulted payment losses were implicit                                                     | a step-level budget survives rounds while admitting non-settlement liquidity; payment claims carry LGD, written-off and residual amounts; failure retains claims; status and collateral-release references are validated                                                  |
| Quantitative validator      | Important | causal language, tie handling, and replay precision overstated conclusions                                                                                                               | output is constraint contribution analysis; close fits become `not discriminated`; holdout is frozen/disjoint; exact-number canonicalization hashes the full result; uncertainty labels distinguish empirical summaries from confidence claims                            |
| Skeptical software engineer | Critical  | long research runs could freeze rendering; untrusted JSON and unbounded growth increased risk; the inherited lockfile contained critical/high advisories in router and development tools | heavy tasks run in cancellable Web Workers with progress; strict/bounded schemas and unsafe-key checks guard imports; payment/event/snapshot budgets fail closed; route CSP/security headers restrict the workstation; dependencies were upgraded to a zero-finding audit |

Residual minor issues are disclosed rather than hidden: the financial Genesis and hybrid heuristics can be observationally identical; browser rendering must still be checked in each deployment environment; output hashes are not signatures; and large-but-valid nine-quarter passports can approach the 40 MB import ceiling.

## Security boundary

The systemic engine has no fetch, storage, analytics, telemetry, credential, or dynamic-code path. Imports remain in browser memory and exports use local Blob downloads. Core/worker imports are static. Production headers for `/systemic-lab` restrict scripts, connections, workers, framing, permissions, referrers, and MIME sniffing. No secrets belong in scenario files or client code.

The repository uses pinned lockfile resolution, CI verification, dependency audit commands, and an on-demand CycloneDX SBOM. The final 2026-09-13 review resolved the dependency tree to zero `npm audit` findings; future advisory data can change that result, so CI fails on new high/critical findings. These controls reduce software risk; they do not constitute an authority-to-operate, government deployment authorization, privacy assessment, penetration test, or supply-chain certification.

## Falsification and loss conditions

A mechanism is inconsistent when its normalized selected-feature error exceeds the prespecified tolerance. It is not discriminated when too few compatible features exist, confidence/robustness is insufficient, or close fits cannot be separated. A policy holdout claim is unsupported if its paired interval misses the frozen minimum effect, any pair breaches failed-payment/capital-loss limits, or a numerical warning occurs. Genesis may lose to any comparator; no material difference is valid.
