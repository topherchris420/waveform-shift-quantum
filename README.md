# R.A.I.N. Lab (experiment #9)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Evaluating standard quantum mechanics alongside the proposed **Woodyard (2026)** field-modulated spatial localization model.

> **Research Instrument Notice:** This app is designed as a rigorous scientific workstation. Established quantum mechanics and proposed physical extensions are strictly segregated, with explicit falsification conditions and cryptographically verifiable research artifacts.

## Epistemic Classification Framework

To ensure scientific rigor, all physics calculations and visual models are tagged under four explicit categories:

### 1. ESTABLISHED PHYSICS

- **Standard Quantum Mechanics**: Schrödinger evolution $i\hbar \frac{\partial\psi}{\partial t} = \hat{H}\psi$, Born-rule outcome probabilities $P(i) = \left|\langle i|\psi\rangle\right|^2$.
- **Barrier Tunneling**: 1D rectangular potential barrier transmission $T(E, V_0, a)$.
- **Quantum Teleportation**: Bennett et al. (1993) 3-qubit discrete protocol via pre-shared entanglement and classical communication.
- **Werner States & Entanglement**: Entanglement concurrence $C(\rho) = \max\left(0, \frac{3p-1}{2}\right)$ and Massar–Popescu classical limit $F \le \frac{2}{3}$.

### 2. PROPOSED MODEL (Woodyard 2026)

- **Field-Modulated Two-Site System**: Hamiltonian
  $$H_2 = \begin{pmatrix} E_A + g\phi_A & \Delta \\ \Delta & E_B + g\phi_B \end{pmatrix}$$
  with matter-scalar coupling $g$.
- **Localization Response Kernel**: Biased spatial density profile
  $$P_{\mathrm{loc}}(x) = \frac{\chi(x) P_B(x)}{\int \chi(x') P_B(x') \,\mathrm{d}x'}$$
  with kernel factor $\chi(x) = \exp\left[\alpha L(x)\right]$.
- **Numerical Time Evolution**: Unitary matrix propagation $U(\mathrm{d}t) = \exp\left(-\frac{i}{\hbar} H \,\mathrm{d}t\right)$ preserving state norm $P_A(t) + P_B(t) \equiv 1$.

### 3. INTERPRETIVE CLAIM

- Conceptual framing of spatial location as an internal dynamical state modulated by scalar fields, rather than a fixed classical coordinate.

### 4. TESTABLE PREDICTIONS & FALSIFICATION CONDITIONS

- **Interferometric Phase Shift**:
  $$\Delta\varphi_\phi = \frac{g}{\hbar} \int_0^T \left[\phi(x_1(t),t) - \phi(x_2(t),t)\right] \mathrm{d}t$$
- **Falsification Rule**: If precision atom interferometry or optical clock experiments show zero phase deviation within modeled uncertainty ($\sigma < 10^{-4}$), the proposed field coupling parameter region is falsified and excluded.

---

## Core Lab Features

1. **Standard QM vs. Woodyard Model Comparison Mode**: Simultaneous dual predictions, numerical difference $\Delta P$, percentage deviation, and explicit "WHAT WOULD FALSIFY THIS?" controls.
2. **Anomaly Engine**: Automated parameter space sweep searching for states that maximize measurable deviation from standard QM baseline, ranked by numerical stability, score, and experimental feasibility.
3. **Catalyst OS Integration**: Generate exportable JSON research artifacts with SHA-256 canonical hash chains, source commit SHA, parameter digests, and root artifact verification.
4. **Numerical Two-Site Time Evolution**: Live propagation of $|\psi(t)\rangle$ displaying $P_A(t)$ and $P_B(t)$ oscillations, avoided crossings, and exact norm preservation.
5. **Model Context Protocol (MCP) Tools**: Expose quantum physics calculation endpoints over Deno/Supabase Edge Functions.

---

## The Genesis Protocol: Complex-Systems Resource Routing

The Genesis Protocol extends Waveform Shift's experimental philosophy into bounded economic coordination: compare ordinary monetary exchange with a logistics assist that uses physical-fit information, then record where each approach succeeds or fails.

The laboratory now compares four architectures—Market, a lender-of-last-resort Stabilized Market, a telemetry-enabled Computational Market/Hybrid, and Genesis coordination assistance—against one hidden physical-welfare benchmark. Monetary trades must actually clear through balances, credit, collateral, counterparties, and settlement. Genesis uses declared preferences only as consent and ranking inputs, settles through the same cash/credit rail by default, and falls back to market coordination when its routing data or nodes fail. Pure financial shocks preserve the physical world, while real-resource shocks bind every mechanism.

Genesis is not a banking replacement, an autonomous currency, or a civic preference calculator, and it cannot receive a hardcoded victory. Discovery and holdout seeds remain separate; a narrow logistics claim must beat the strongest monetary/hybrid comparator, clear confidence and oracle-gap requirements, pass systemic-risk gates, and survive overhead sensitivity. See [the operating boundaries](docs/GENESIS_OPERATING_BOUNDARIES.md) and [the monetary coordination model](docs/MONETARY_COORDINATION_MODEL.md) for mechanisms, assumptions, hypotheses, and falsification conditions.

> **Core Principle:** Computation may assist with physically measurable logistics (where the scarce information is how resources physically fit together), while people, communities, and markets remain authoritative for subjective preferences, price discovery, liquidity, and financial risk.

### Key Simulation Components

1. **Operational fit signals**: Multiple physical fields measure scarcity, demand, urgency, quality, location, energy, reliability, and compatibility. They supplement—rather than replace—human value judgments or prices.
2. **Seeded energy availability**: A 24-hour stochastic power-availability input exercises timing and outage assumptions without claiming to model a real utility.
3. **Route preview**: Dynamic direct or relay paths show possible logistics choices; execution still requires the declared human boundary and cash/market settlement.

## Systemic Stress & Coordination Lab

`/systemic-lab` is a separate, offline-first financial research workstation. It represents institutions with reconciled balance sheets, collateral inventories, directed funding claims, payment obligations, market positions, margin agreements, ownership links, and explicit facility contracts. Three synthetic flagship experiments cover LFBO dollar-funding stress, an intraday settlement disruption, and a fire-sale/margin spiral.

The Policy Desk supports public scenario-path imports, DRR `SystemicSignal` imports, competing-mechanism experiments, policy counterfactuals, parameter uncertainty, layer ablations, robustness checks, exploratory calibration, preregistered holdout evaluation, and exact-replay policy passports. Federal Reserve and BIS publications motivate mechanisms and input formats only. The lab is not a Federal Reserve model, supervisory system, regulatory-ratio implementation, forecast, or endorsement.

Start with [Systemic Stress Lab](docs/SYSTEMIC_STRESS_LAB.md), then see the [financial mechanisms](docs/FINANCIAL_MECHANISMS.md), [validation boundary](docs/VALIDATION.md), and [model-risk review](docs/MODEL_RISK_AND_REVIEW.md).

## Separate research workstations

| Workstation                        | Route           | Epistemic domain                                                               |
| ---------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| Quantum / Woodyard model           | `/`             | Established quantum mechanics versus a proposed physical model                 |
| ARFR                               | `/arfr`         | Proposed physical technology and falsifiable simulation                        |
| Genesis resource lab               | `/resonance`    | Stylized resource-allocation experiments                                       |
| Systemic Stress & Coordination Lab | `/systemic-lab` | Established financial mechanisms implemented in a stylized economic simulation |

Outputs from one domain are never evidence for another. Shared hashing and experiment infrastructure do not imply shared empirical validity.

---

## Verification & Build Suite

```bash
# Run scientific invariant and regression tests
npm test

# Run ESLint linter
npm run lint

# Build production bundle
npm run build

# Lint, typecheck, test, and production build
npm run verify

# Audit the resolved dependency tree
npm run audit:dependencies

# Emit a CycloneDX software bill of materials
npm run --silent sbom > sbom.cdx.json
```

## ARFR experiment integrity

ARFR uses refresh-independent fixed stepping, cumulative run statistics and versioned result passports with full current configuration and build provenance. See [timing, export boundaries and validation](docs/ARFR_EXPERIMENT_INTEGRITY.md). The four workstations load on demand, and pull requests run the test, typecheck, lint and build gates.
