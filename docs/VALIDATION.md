# Validation and reproducibility

## Automated gate

`npm run verify` executes repository-wide ESLint, strict TypeScript, the full Vitest suite, and a production Vite build. Pull requests run the same four stages on pinned Node 22.22.2, fail on high/critical dependency advisories, and validate a generated SBOM. Open schemas/examples are regenerated with `npm run schemas`; dependencies are checked with `npm run audit:dependencies`; a valid CycloneDX JSON SBOM is emitted with `npm run --silent sbom > sbom.cdx.json`.

## Systemic-lab validation matrix

| Area               | Enforced property                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounting         | every changed actor satisfies assets = liabilities + equity; invalid multi-posting transactions roll back                                            |
| Conservation       | settlement only transfers liquidity; bilateral netting issues none; fire sales preserve asset quantity and aggregate cash                            |
| Liquidity/solvency | liquid and capital states are separate; unpaid initial margin enters liquidity need; facilities cannot repair equity                                 |
| Collateral         | eligibility, maturity, haircut, uncertainty, inventory/account bounds, encumbrance, release, and no repledging                                       |
| Facilities         | finite capacity and borrower limits, delayed recheck, matched reserve issuance, collateral maintenance, repayment/default                            |
| Payments           | obligation identity `amount = remaining + settled + writtenOff`; claims reconcile to both counterparties; outage/deadline behavior                   |
| Contagion          | no contractual edge means no contractual loss; LGD and collateral drive explicit write-downs                                                         |
| Fire sales         | zero volume means zero impact; larger volume cannot raise price; finite buyer cash; pledged assets cannot be sold                                    |
| Margin             | variation margin direction/amount, returnable cash IM, securities substitution, and no cash creation                                                 |
| Scenarios          | three flagships replay deterministically; every snapshot reconciles; finance does not repair physical destruction                                    |
| Uncertainty        | deterministic Latin hypercube/Monte Carlo samples, empirical percentiles/tail means/breach frequencies, bootstrap behavior                           |
| Discovery/holdout  | unique disjoint seeds, immutable preregistration, frozen thresholds, paired evaluation                                                               |
| DRR bridge         | strict schema, explicit actor mapping, six mechanisms, low-information `not discriminated` result                                                    |
| Replay/provenance  | exact finite-number canonicalization, immutable passport, mutation detection, full-outcome replay equivalence, current-value evidence reconciliation |
| Input security     | strict deep schemas, semantic foreign-key checks, unsafe-key rejection, byte and workload budgets                                                    |

Generated loops cover monotonic haircut capacity and perfect-reliability seed ensembles. They are invariant/property checks without an external property-testing dependency.

## Numerical interpretation

The accounting tolerance is `1e-7` USD million plus a small scale term for the balance-sheet identity. Input convergence tolerance is bounded from `1e-9` through `0.01`; it rounds a five-value state signature, not transaction postings. Reaching the propagation-round limit creates a warning. Reports with warnings should be treated as numerically unresolved and fail the holdout support rule.

Ensemble percentiles are empirical summaries of the declared input distribution, not population confidence intervals. Bootstrap intervals summarize paired simulated effects only. Layer-contribution intervals are ranges over selected seeds. Calibration's near-optimal range is explicitly not a statistical confidence interval.

## Manual research checks

Before interpreting a result, vary step size, maximum rounds, seeds, shock timing, facility lag/capacity/haircuts, market depth/elasticity/volatility, settlement mode/reliability/recycling, transfer restrictions, funding concentration, and behavioral reactions. Inspect numerical warnings and contradictory outcomes. Compare Genesis to FIFO, matching, hybrid, market adjustment, and facility designs under common starting resources.

## Remaining validation boundary

The bundled scenarios have not been calibrated or backtested against confidential or public institution-level data. No independent model validation, benchmark against an established supervisory engine, legal review, red-team certification, load certification, or deployment authorization has occurred. Automated invariants establish internal consistency, not empirical adequacy.
