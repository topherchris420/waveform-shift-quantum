# DRR ↔ Genesis bridge

The repositories remain separate. DRR is an observational diagnostic; the Systemic Stress Lab is a counterfactual mechanism simulator. The open `systemic-signal.v1` contract is defined in [JSON Schema](schemas/systemic-signal.v1.schema.json), with an offline example under `public/systemic-examples/systemic-signal.json`.

## Signal boundary

A signal records a synthetic or externally supplied institution identifier/name, date, selected metric directions/magnitudes/units/baselines, peer context, overall direction/magnitude/persistence/confidence/robustness, topology changes, lead-lag relationships, provenance, and linked evidence IDs. Strict validation rejects unknown fields, duplicate observed metrics, invalid units, and unlinked topology or lead-lag evidence.

The researcher must explicitly map the observed institution to a synthetic actor. No real institution name causes an automatic balance-sheet lookup or substitution.

## Six competing mechanisms

The bridge prepares funding-run, collateral-pressure, market-loss, settlement-pressure, common-factor, and no-shock/insufficient-evidence experiments. The default 20% shock and eight-hour outage are disclosed translation assumptions, not values inferred from the alert. Each hypothesis carries assumptions, variables affected, initial shocks, propagation rules, predicted observables, and falsification conditions.

The comparison normalizes only compatible observed units, reports missing features, and computes selected-feature RMSE. It requires at least two comparable features and minimum signal confidence/robustness before discrimination. Fits closer than the declared separation tolerance are labeled `not discriminated`.

The exported comparison includes the original validated signal, mapping, translation assumptions, all prepared hypotheses, model results, rankings, contradictory/missing features, and this evidence boundary:

> A scenario can reproduce selected observed features under declared assumptions. Best fit does not identify causation or establish what happened to the observed institution.

The bridge does not fetch confidential or public supervisory data, does not send files to DRR, and has no network or telemetry path.
