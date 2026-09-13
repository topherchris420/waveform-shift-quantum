# Genesis financial sequencing experiment

Genesis in the Systemic Stress Lab is a deliberately narrow experimental comparator. It changes the order in which already-visible, already-due payment claims are attempted. It does not allocate new credit, create reserves, change collateral eligibility, override transfer restrictions, repair capital, alter physical capacity, or observe information unavailable to the other routing rules.

## Comparators

| Rule             | Queue information             | Resource set                | Ordering                                              |
| ---------------- | ----------------------------- | --------------------------- | ----------------------------------------------------- |
| FIFO             | priority, due time, ID        | common liquidity and claims | earliest due first                                    |
| Network matching | plus recipient outgoing value | same                        | prioritize payments that may unlock more queued value |
| Hybrid           | same                          | same                        | matching order plus configured overhead               |
| Genesis          | same                          | same                        | experimental matching order plus configured overhead  |

In the current financial implementation, network matching, hybrid, and Genesis share the same transparent heuristic and configured overhead; they may differ from FIFO but may be identical to one another. That is an intentionally admissible result. The richer Genesis physical-resource routing model remains confined to `/resonance` and is not evidence for financial sequencing.

The `/resonance` model is likewise bounded: Genesis is a human-approved logistics assist, not a replacement for cash, banks, markets, or community judgment. Its physical-fit suggestions settle through the ordinary monetary rail in `cash-first` mode and fall back to market coordination when routing data or nodes fail. See [Genesis operating boundaries](GENESIS_OPERATING_BOUNDARIES.md).

Policy comparisons include a no-intervention case, market adjustment, facility variants, bilateral settlement support, hybrid, and Genesis. A claim about Genesis must be judged against the strongest common-resource comparator and must survive disjoint-seed holdout and robustness gates. “No material difference,” “market adjustment performs better,” “intervention fails,” and “insufficient evidence” are valid outputs.

Layer-removal output is labeled constraint contribution analysis. It is a paired descriptive model comparison, not causal attribution. Interaction terms show non-additivity under the selected removal design and seed range; they are not real-world causal effects or population confidence intervals.
