<div align="center">

# Waveform

### Change a parameter. Challenge a model. Keep the result.

**An open simulation studio from Vers3Dynamics for comparing predictions and keeping experiments reproducible.**

Start with a question about field coupling. Run a controlled sweep. See where the proposed model separates from its baseline—and where the effect disappears. Export the complete record, then import it to check the computation again.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vitest](https://img.shields.io/badge/Testing-Vitest-6E9F18.svg)](https://vitest.dev/)

[Run your first experiment](#run-your-first-experiment) · [Research Workstations](#research-workstations) · [Epistemic Framework](#epistemic-framework) · [Quickstart](#quickstart) · [Integrity](#experiment-integrity)

</div>

> **Research instrument notice.** Waveform separates established laws, proposed models, interpretive claims, and testable predictions. Simulations are exploratory instruments—not experimental evidence—and every export is designed to be reproducible and auditable.

## Run your first experiment

Open **`/experiments`** after starting the app. Everything in this workbench runs locally; no account, API key, or backend is required.

1. Choose **Driven field**, state the research question (a default is provided), then **Run comparison**. The workbench sweeps coupling while holding the rest of the protocol fixed.
2. Inspect maximum and mean population separation, then **Physics integrity**: every executed check (g = 0 collapse, uniform-field nulls, Δ = 0 and E_A = E_B limits, Hermiticity, propagator unitarity, probability conservation, the dt → dt/2 → dt/4 ladder), grouped under four separate questions. Failures stay visible.
3. Choose **Null control** and run again. With a spatially uniform static field, the population effect disappears.
4. **Save record** to keep the protocol, model assumptions, unit declaration, research question, results, convergence ladder, checks, source commit, and a SHA-256 digest. **CSV** exports the sampled values.
5. **Import & replay** the JSON. The app checks its structure and digest, recomputes everything, and rejects mismatches. Version 1 records still replay under their own protocol.

A passing replay establishes computational agreement with the current engine. It does **not** authenticate an author or establish the proposed model in nature, and a record whose checks failed replays as failed: reproducibility is not validity. The protocol runs in simulation units (ħ = 1, energies in ε₀, time in ħ/ε₀); g and φ have no physical calibration. See the [experiment protocol](docs/EXPERIMENT_WORKBENCH.md) for units, bounds, tolerances, and limitations.

## Research Workstations

Each workstation is isolated by domain. A result produced in one model is never silently promoted to evidence in another.

| Workstation | Route | Focus |
| --- | --- | --- |
| **Experiment Workbench** | `/experiments` | Controlled two-site coupling sweeps, numerical checks, JSON replay, and CSV export. |
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

- **Horodecki average teleportation fidelity** (Werner pair of purity \(p\), depolarizing decoherence \(d\)):

  $$F = \frac{2f + 1}{3},\qquad f = \frac{1 + 3p(1-d)}{4}$$

- **Massar–Popescu classical fidelity bound:**

  $$F \leq \frac{2}{3}$$

- **Barrier tunneling:** transmission is represented as $$T(E, V_0, a)$$ for energy $$E$$, barrier height $$V_0$$, and width $$a$$.

### Proposed Woodyard model

The two-site Hamiltonian introduces scalar-field coupling $$g$$:

$$H_2 = \begin{pmatrix} E_A + g\phi_A & \Delta \\ \Delta & E_B + g\phi_B \end{pmatrix}$$

The localization response uses the kernel $$\chi(x) = \exp\left[\alpha L(x)\right]$$:

$$P_{\mathrm{loc}}(x) = \frac{\chi(x)P_B(x)}{\int \chi(x')P_B(x')\,\mathrm{d}x'}$$

Time propagation applies the exact exponential of each frozen step Hamiltonian:

$$U(\mathrm{d}t) = \exp\left(-\frac{i}{\hbar}H\,\mathrm{d}t\right)$$

This is exact for a static Hamiltonian. A driven $$H(t)$$ is frozen at each step's midpoint, a second-order approximation whose error is measured by a dt → dt/2 → dt/4 ladder.

The expected invariant is total probability conservation:

$$P_A(t) + P_B(t) \equiv 1$$

### Falsification protocol

The proposed coupling predicts an interferometric phase

$$\Delta\phi_{\phi} = \frac{g}{\hbar}\int \left[\phi(x_1(t),t) - \phi(x_2(t),t)\right]\,\mathrm{d}t$$

but no number can yet be predicted for a real apparatus: φ is not identified with a physical field and g has no calibration. The empirical falsification condition is therefore **defined but not operational**. A static gradient is also exactly degenerate with an uncalibrated bare detuning, so only a controlled modulation of φ could separate the two. Simulation can reject the *implementation* (a failed limit, invariant or null control). It cannot reject or support the physical hypothesis. See the [audit report](research/gpd/reviews/2026-10-03-woodyard-two-site-audit.md).

## Core Capabilities

- **Comparative engine:** renders standard and proposed predictions side by side, including residual $$\Delta P$$ and percentage deviation.
- **Anomaly engine:** searches parameter space for high-deviation states while checking stability and feasibility bounds.
- **Numerical propagation:** integrates $$\lvert\psi(t)\rangle$$ with normalization, hermiticity, and timestep-stability checks.
- **Catalyst OS verification:** exports canonical JSON artifacts with SHA-256 hash chains, parameter digests, timestamps, and git commit binding.
- **Genesis routing:** compares direct and relay paths, physical-fit signals, and market fallback behavior.
- **Systemic stress testing:** models collateral haircuts, dollar-funding shocks, payment gridlock, margin calls, and fire-sale feedback.

## Quickstart

### Prerequisites

- Node.js `22.x` (CI uses `22.22.2`)
- npm (the CI lockfile is `package-lock.json`)

### Install and run

```bash
npm ci
npm run dev
```

### Verification commands

```bash
npm test                 # Vitest unit and invariant tests
npm run lint                 # ESLint
npm run typecheck            # Strict TypeScript checks
npm run verify               # lint, typecheck, test, build, and physics audit
npm run physics:audit        # deterministic physics audit (console + physics-audit.json)
npm run build                # Production bundle
npm run audit:dependencies   # Dependency audit
npm run --silent sbom > sbom.cdx.json # CycloneDX SBOM export
```

## Experiment Integrity

Waveform follows these reproducibility rules:

- **Deterministic stepping:** simulation loops use refresh-rate-independent, fixed timestep integration.
- **Explicit provenance:** experiment passports record git SHAs, active parameters, timestamps, and audit events.
- **Invariant testing:** probability normalization, matrix properties, balance-sheet reconciliation, and bounded-resource constraints are tested automatically.
- **Domain separation:** outputs remain scoped to their originating workstation and epistemic classification.
- **Continuous verification:** pull requests run linting, strict typechecking, invariant tests, and production compilation.

## Documentation

- [Experiment workbench and replay protocol](docs/EXPERIMENT_WORKBENCH.md)
- [Validation and reproducibility](docs/VALIDATION.md)
- [Physics research workspace (GPD methodology)](research/gpd/README.md)
- [Adaptive Resonant Field Router integrity](docs/ARFR_EXPERIMENT_INTEGRITY.md)
- [Genesis operating boundaries](docs/GENESIS_OPERATING_BOUNDARIES.md)
- [Monetary coordination model](docs/MONETARY_COORDINATION_MODEL.md)
- [Systemic stress lab](docs/SYSTEMIC_STRESS_LAB.md)
- [Financial mechanisms](docs/FINANCIAL_MECHANISMS.md)
- [Model risk and review](docs/MODEL_RISK_AND_REVIEW.md)

<div align="center">

*Waveform / Vers3Dynamics — open instruments, inspectable results.*

</div>
