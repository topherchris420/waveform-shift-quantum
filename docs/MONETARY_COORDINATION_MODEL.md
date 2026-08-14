# Monetary Coordination Model

## Research scope

The Genesis Protocol is an experiment-discovery engine for comparing information and allocation systems. It does **not** claim that money, markets, or central banking are inherently harmful. Every architecture receives the same seeded agents, physical capacities, geography, conversion matrix, renewable shock, and hidden physical-welfare oracle. A result describes a simulated regime, not an economy-wide empirical conclusion.

## Epistemic ledger

### ESTABLISHED ECONOMIC MECHANISM

Markets coordinate decentralized plans through prices, budgets, credit, collateral, counterparties, and settlement. Liquidity and solvency are distinct: a solvent borrower can be temporarily unable to settle, while additional liquidity cannot make an insolvent transaction viable. A lender of last resort can supply collateralized liquidity during a panic, but consumes balance-sheet capacity, entails funding/verification costs, and cannot manufacture energy, compute, storage, or transmission capacity.

### SIMULATION ASSUMPTION

Agents have deterministic seeded balances, private-credit limits, collateral, solvency state, and intermediary exposure. A proposed trade clears only when:

1. a compatible, geographically reachable physical route has capacity;
2. balance plus haircut-adjusted credit covers its simulated price;
3. both counterparties are solvent; and
4. the settlement draw succeeds.

The stabilized architecture may fill a liquidity gap for a solvent transaction, subject to `backstopCapacity`. It cannot rescue insolvency, failed settlement, or a physically impossible edge. Backstop use increases measured coordination cost. Price noise changes ranking; it does not directly subtract welfare. Telemetry noise changes Hybrid and Genesis rankings. Mechanism overhead is explicit and sensitivity-tested rather than hidden.

Unmet demand is classified in a conserved decomposition:

- **real physical shortage**: demand above available capacity;
- **financial exclusion / monetary constraint**: feasible volume rejected by liquidity, credit, collateral, counterparty, or settlement checks;
- **network/geographic constraint**: compatible capacity that cannot reach the requester;
- **compatibility/conversion constraint**: capacity that cannot perform the required physical service.

`FUD = financially rejected physically feasible demand / total demand`.

Stranded Physical Utility is the oracle-attainable welfare not reached by an architecture. It is computed from the common simulated world and allocation outcome, never assigned as a penalty.

### PROPOSED GENESIS MECHANISM

Genesis ranks direct physical-resource routes using scarcity, demand, urgency, quality, location, energy availability, reliability, and compatibility telemetry. Its baseline allocation has no monetary clearing constraint, but it retains finite capacity, geography, conversion loss, verification cost, telemetry reliability, relay dependence, and physical scarcity. Hybrid uses the same noisy telemetry and optimizer while retaining prices, balances, credit, collateral, counterparties, settlement, and the central-bank facility.

### TESTABLE HYPOTHESIS

Monetary coordination should perform well when settlement and credit work, relative prices are informative, and telemetry is unreliable or expensive. Stabilization should dominate an unstabilized market in genuine solvent liquidity crises. Computation may add value when reliable physical telemetry reveals constraints obscured by financial stress or noisy prices. Direct routing may add value only where viable physical supply is financially stranded and the additional concentration, fragility, inequality, relay, overhead, and telemetry risks remain within preregistered tolerances.

### FALSIFICATION CONDITION

Genesis superiority is rejected unless a frozen discovery claim:

- clears a preregistered minimum effect on disjoint holdout seeds and shocks;
- beats both the stabilized market and the telemetry-equivalent Hybrid comparator;
- closes the oracle-welfare gap;
- wins consistently out of sample;
- passes every systemic-risk gate; and
- survives an overhead sensitivity check.

Valid outputs include Market, Stabilized Market, or Hybrid superiority, Genesis superiority **in a specific regime**, no significant difference, and insufficient evidence. A real-resource shock that removes capacity must reduce attainable fulfillment for every architecture.

## Thermodynamic Safety Valve

The visible state machine is:

`NORMAL → FINANCIAL_STRESS → STABILIZED_MARKET → HYBRID → GENESIS_BASELINE → RECOVERY`

It is an advisory, nonsilent policy state. `GENESIS_BASELINE` requires all configured conditions: remaining physical availability, material monetary deterioration, critical unmet demand, insufficient central-bank stabilization, and a risk-compliant computational improvement. State transitions never alter supply.

## Interpretation limits

This stylized agent-based model is not calibrated for policy prediction. Its price formation, credit underwriting, settlement probability, conversion matrix, and oracle are simulation assumptions. The regime map is a deterministic parameter-space discovery view, not evidence that any cell describes a particular real economy. Its purpose is to reveal where claims fail and identify hypotheses suitable for empirical validation.
