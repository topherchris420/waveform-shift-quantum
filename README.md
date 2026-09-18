<div align="center">

# R.A.I.N. Lab

### Experiment #9 · Rigorous Scientific Workstation

**A multi-domain simulation platform for quantum mechanics, wavefront routing, complex-systems logistics, and financial network stress.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vitest](https://img.shields.io/badge/Testing-Vitest-6E9F18.svg)](https://vitest.dev/)

[Research Workstations](#research-workstations) · [Epistemic Framework](#epistemic-framework) · [Quickstart](#quickstart) · [Integrity](#experiment-integrity)

</div>

> **Research instrument notice.** R.A.I.N. Lab separates established laws, proposed models, interpretive claims, and testable predictions. Simulations are exploratory instruments—not experimental evidence—and every export is designed to be reproducible and auditable.

## Research Workstations

Each workstation is isolated by domain. A result produced in one model is never silently promoted to evidence in another.

| Workstation | Route | Focus |
| --- | --- | --- |
| **Quantum & Woodyard Model** | `/` | Standard quantum-mechanical baselines contrasted with a proposed scalar-field localization model. |
| **Adaptive Resonant Field Router** | `/arfr` | Spatial wave-packet propagation, field-modulated routing, and wavefront dynamics. See [experiment integrity](docs/ARFR_EXPERIMENT_INTEGRITY.md). |
| **Genesis Resource Lab** | `/resonance` | Bounded resource coordination under scarcity, energy, urgency, quality, and compatibility constraints. See [operating boundaries](docs/GENESIS_OPERATING_BOUNDARIES.md). |
| **Systemic Stress & Coordination** | `/systemic-lab` | Reconciled balance sheets, intraday settlement disruption, liquidity cascades, and margin spirals. See [lab documentation](docs/SYSTEMIC_STRESS_LAB.md). |

## Epistemic Framework

Every model is classified before it is visualized or exported.

1. **Established physics** — validated formulations used as reference baselines.
2. **Proposed model** — explicit hypotheses with named parameters and bounded domains.
3. **Interpretive claim** — conceptual framing that is not itself an empirical result.
4. **Testable prediction** — an observable consequence paired with a falsification condition.

### Established baselines

- **Schrödinger evolution:**

  $$i\hbar \frac{\partial \psi}{\partial t} = \hat{H}\psi$$

- **Born-rule outcome probability:**

  $$P(i) = \left|\langle i \mid \psi \rangle\right|^2$$

- **Werner-state concurrence:**

  $$C(\rho) = \max\left(0, \frac{3p - 1}{2}\right)$$

- **Massar–Popescu classical fidelity bound:**

  $$F \leq \frac{2}{3}$$

- **Barrier tunneling:** transmission is represented as $$T(E, V_0, a)$$ for energy $$E$$, barrier height $$V_0$$, and width $$a$$.

### Proposed Woodyard model

The two-site Hamiltonian introduces scalar-field coupling $$g$$:

$$H_2 = \begin{pmatrix} E_A + g\phi_A & \Delta \\ \Delta & E_B + g\phi_B \end{pmatrix}$$

The localization response uses the kernel $$\chi(x) = \exp\left[\alpha L(x)\right]$$:

$$P_{\mathrm{loc}}(x) = \frac{\chi(x)P_B(x)}{\int \chi(x')P_B(x')\,\mathrm{d}x'}$$

Time propagation uses the unitary infinitesimal propagator:

$$U(\mathrm{d}t) = \exp\left(-\frac{i}{\hbar}H\,\mathrm{d}t\right)$$

The expected invariant is total probability conservation:

$$P_A(t) + P_B(t) \equiv 1$$

### Falsification protocol

A proposed coupling must produce a measurable phase deviation:

$$\Delta\phi_{\phi} = \frac{g}{\hbar}\int \left[\phi(x_1(t),t) - \phi(x_2(t),t)\right]\,\mathrm{d}t$$

If atom-interferometry or optical-clock measurements constrain this deviation to zero within $$\sigma < 10^{-4}$$ across the model's stated parameter region, that region is rejected and discarded.

## Core Capabilities

- **Comparative engine:** renders standard and proposed predictions side by side, including residual $$\Delta P$$ and percentage deviation.
- **Anomaly engine:** searches parameter space for high-deviation states while checking stability and feasibility bounds.
- **Numerical propagation:** integrates $$\lvert\psi(t)\rangle$$ with normalization, hermiticity, and timestep-stability checks.
- **Catalyst OS verification:** exports canonical JSON artifacts with SHA-256 hash chains, parameter digests, timestamps, and git commit binding.
- **Genesis routing:** compares direct and relay paths, physical-fit signals, and market fallback behavior.
- **Systemic stress testing:** models collateral haircuts, dollar-funding shocks, payment gridlock, margin calls, and fire-sale feedback.

## Quickstart

### Prerequisites

- Node.js `22.x` or newer
- pnpm

### Install and run

```bash
pnpm install
pnpm dev
```

### Verification commands

```bash
pnpm test                 # Vitest unit and invariant tests
pnpm lint                 # ESLint
pnpm typecheck            # Strict TypeScript checks
pnpm verify               # lint, typecheck, test, and build
pnpm build                # Production bundle
pnpm audit:dependencies   # Dependency audit
pnpm sbom > sbom.cdx.json # CycloneDX SBOM export
```

## Experiment Integrity

R.A.I.N. Lab follows these reproducibility rules:

- **Deterministic stepping:** simulation loops use refresh-rate-independent, fixed timestep integration.
- **Explicit provenance:** experiment passports record git SHAs, active parameters, timestamps, and audit events.
- **Invariant testing:** probability normalization, matrix properties, balance-sheet reconciliation, and bounded-resource constraints are tested automatically.
- **Domain separation:** outputs remain scoped to their originating workstation and epistemic classification.
- **Continuous verification:** pull requests run linting, strict typechecking, invariant tests, and production compilation.

## Documentation

- [Adaptive Resonant Field Router integrity](docs/ARFR_EXPERIMENT_INTEGRITY.md)
- [Genesis operating boundaries](docs/GENESIS_OPERATING_BOUNDARIES.md)
- [Monetary coordination model](docs/MONETARY_COORDINATION_MODEL.md)
- [Systemic stress lab](docs/SYSTEMIC_STRESS_LAB.md)
- [Financial mechanisms](docs/FINANCIAL_MECHANISMS.md)
- [Model risk and review](docs/MODEL_RISK_AND_REVIEW.md)

<div align="center">

*R.A.I.N. Lab — bridging quantum physics, complex systems, and financial network dynamics.*

</div>
