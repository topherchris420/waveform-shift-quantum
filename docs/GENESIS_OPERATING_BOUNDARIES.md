# Genesis operating boundaries

Genesis is a coordination assist for narrow physical-resource logistics. It is not a bank, a currency, a market replacement, or a machine that decides what a community should value.

## Three explicit limits

### 1. Human and community judgment stays authoritative

The simulator may rank operational fit—such as compatibility, timing, reliability, or location—but it does not infer the value of art, care, dignity, or a public project from those fields. A requester or community supplies a declared reservation boundary, priority, and consent state. A provider can withhold consent. A `pending` or `rejected` community decision holds the route rather than turning disagreement into a hidden algorithmic price.

The seeded world uses synthetic declarations so that the experiment is reproducible. A deployment would need a real, auditable process for collecting and changing those declarations.

### 2. Cash and ordinary settlement remain the crisis anchor

The default `cash-first` mode routes physical-fit suggestions through the same balances, credit, collateral, counterparties, and settlement reliability used by the monetary comparators. Genesis cannot mint liquidity, create reserves, or make an insolvent trade viable. An optional `advisory` mode can produce recommendations without executing them; it is explicitly not a substitute for a bank.

If routing telemetry falls below the configured threshold, the routing grid is unavailable, or a provider/node fails, Genesis pauses direct vector ordering and uses the market/cash path. The result records `genesisFallbackRate` so a run cannot hide that degradation. This is a service-continuity rule, not a claim that digital barter can replace cash during a crisis.

### 3. The model is deliberately plain

The resource lab is a stylized logistics spreadsheet with a visual route preview. Its fields are operational signals, its prices are synthetic assumptions, and its outcomes are seeded counterfactuals. Quantum mechanics and the separate physics workstation provide no economic evidence. “Genesis superiority” means only that a frozen, holdout-tested logistics comparison won in a specified parameter regime; it never means universal economic or political superiority.

## What the lab can and cannot answer

| Question | Lab treatment |
| --- | --- |
| Can a physical route fit a declared need? | Yes, as a seeded logistics comparison. |
| What is a painting, care service, or park worth? | No; people and institutions must decide. |
| Can a vector network provide crisis liquidity? | No; cash/market settlement remains available and is the fallback. |
| Does a route preview execute a trade? | No; consent, institutional checks, and settlement are required. |
| Does a Genesis win generalize to an economy? | No; it is a falsifiable result for one modeled regime. |

## Testable boundary checks

- With `genesisSettlementMode: 'cash-first'`, a liquidity freeze creates financial exclusion for Genesis as it does for the monetary comparators.
- With `genesisSettlementMode: 'advisory'`, the model reports recommendations without settlement attempts.
- With an outage, low telemetry reliability, or a failed node, `genesisOperatingPolicy` returns `cash-market-fallback` and the run reports a non-zero fallback rate.
- With consent withdrawn or a community decision pending/rejected, the affected route is held and counted as a subjective-boundary rejection rather than silently repriced.

