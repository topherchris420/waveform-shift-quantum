<div align="center">

```
  ██████╗  █████╗ ██╗███╗   ██╗     ██╗      █████╗ ██████╗
  ██╔══██╗██╔══██╗██║████╗  ██║     ██║     ██╔══██╗██╔══██╗
  ██████╔╝███████║██║██╔██╗ ██║     ██║     ███████║██████╔╝
  ██╔══██╗██╔══██║██║██║╚██╗██║     ██║     ██╔══██║██╔══██╗
  ██║  ██║██║  ██║██║██║ ╚████║     ███████╗██║  ██║██████╔╝
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝     ╚══════╝╚═╝  ╚═╝╚═════╝
```

### **R.A.I.N. Lab — Experiment #9**
*Rigorous Scientific Workstation & Multi-Domain Physics/Economic Simulation Platform*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vitest](https://img.shields.io/badge/Testing-Vitest-6E9F18.svg)](https://vitest.dev/)

---

[🔬 Research Workstations](#-interactive-research-workstations) •
[📐 Epistemic Framework](#-epistemic-classification-framework) •
[⚡ Core Features](#-core-lab-features) •
[🌐 Genesis Protocol](#-the-genesis-protocol-complex-systems-resource-routing) •
[🏦 Systemic Stress Lab](#-systemic-stress--coordination-lab) •
[🚀 Quickstart & Commands](#-developer-quickstart--command-reference)

---

</div>

> ⚠️ **Research Instrument Notice:** R.A.I.N. Lab is engineered as a high-fidelity, interactive scientific workstation. Established physical laws and proposed physical/economic extensions are strictly segregated, with explicit falsification conditions, invariant tests, and cryptographically verifiable research artifacts (SHA-256 canonical hash chains).

---

## 🔬 Interactive Research Workstations

The laboratory consists of four isolated interactive research environments. Outputs from one domain are strictly segregated and never serve as empirical evidence for another.

| Workstation | Route | Epistemic Domain | Key Capabilities & Documentation |
| :--- | :--- | :--- | :--- |
| **Quantum & Woodyard Model** | [`/`](#) | Established Quantum Mechanics vs. Proposed Scalar Field Model | Dual live predictions, numerical residual $\Delta P$, Anomaly Engine, Catalyst OS export |
| **Adaptive Resonant Field Router** | [`/arfr`](#) | Field-Modulated Routing & Wavefront Dynamics | Physics engine, interactive canvas, real-time spatial wave packet propagation ([Docs](docs/ARFR_EXPERIMENT_INTEGRITY.md)) |
| **Genesis Resource Lab** | [`/resonance`](#) | Complex-Systems Resource Routing & Logistics | Bounded economic coordination, physical-fit signals vs. monetary clearing ([Docs](docs/GENESIS_OPERATING_BOUNDARIES.md)) |
| **Systemic Stress & Coordination** | [`/systemic-lab`](#) | Reconciled Financial Balance Sheets & Liquidity Cascades | Intraday settlement disruption, dollar funding stress, margin spirals ([Docs](docs/SYSTEMIC_STRESS_LAB.md)) |

---

## 📐 Epistemic Classification Framework

To enforce strict scientific integrity, all visual models, mathematical computations, and simulation parameters are classified into four explicit categories:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EPISTEMIC CLASSIFICATION SYSTEM                      │
├───────────────────┬───────────────────┬───────────────────┬─────────────┤
│ 1. ESTABLISHED    │ 2. PROPOSED MODEL │ 3. INTERPRETIVE   │ 4. TESTABLE │
│    PHYSICS        │    (Woodyard '26) │    CLAIMS         │    PREDICTS │
└───────────────────┴───────────────────┴───────────────────┴─────────────┘
```

### 1. Established Physics
Validated standard quantum mechanical formulations operating as ground-truth baselines:

* **Schrödinger Time Evolution:**
  $$i\hbar \frac{\partial\psi}{\partial t} = \hat{H}\psi$$
* **Born-Rule Outcome Probabilities:**
  $$P(i) = \left|\langle i|\psi\rangle\right|^2$$
* **1D Barrier Tunneling:** Rectangular potential barrier transmission coefficient $T(E, V_0, a)$.
* **Quantum Teleportation:** Bennett et al. (1993) 3-qubit discrete protocol using pre-shared EPR entanglement and classical signaling.
* **Werner States & Entanglement Bounds:** Concurrence $C(\rho) = \max\left(0, \frac{3p-1}{2}\right)$ and Massar–Popescu classical fidelity limit $F \le \frac{2}{3}$.

---

### 2. Proposed Model (Woodyard 2026)
Hypothetical matter-scalar field coupling model introducing field-modulated spatial localization:

* **Field-Modulated Two-Site System:** Hamiltonian with scalar field coupling $g$:
  $$H_2 = \begin{pmatrix} E_A + g\phi_A & \Delta \\ \Delta & E_B + g\phi_B \end{pmatrix}$$

* **Localization Response Kernel:** Spatial density profile biased by scalar kernel $\chi(x) = \exp\left[\alpha L(x)\right]$:
  $$P_{\mathrm{loc}}(x) = \frac{\chi(x) P_B(x)}{\int \chi(x') P_B(x') \,\mathrm{d}x'}$$

* **Unitary Time Evolution:** Norm-preserving propagator matrix preserving total state probability $P_A(t) + P_B(t) \equiv 1$:
  $$U(\mathrm{d}t) = \exp\left(-\frac{i}{\hbar} H \,\mathrm{d}t\right)$$

---

### 3. Interpretive Claim
Conceptual framing of spatial position not as a static classical coordinate, but as an internal dynamical quantum state continuously modulated by background scalar fields.

---

### 4. Testable Predictions & Falsification Criteria

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FALSIFICATION PROTOCOL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase Deviation:   Δφ_ϕ = (g / ℏ) ∫ [ ϕ(x₁(t),t) - ϕ(x₂(t),t) ] dt     │
│                                                                         │
│  RULE: If atom interferometry or optical clock precision measures      │
│  zero phase deviation within σ < 10⁻⁴, the scalar coupling parameter    │
│  region g is strictly FALSIFIED and discarded.                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Lab Features

* **Real-time Comparative Engine:** Dual rendering of standard QM versus Woodyard predictions with live display of $\Delta P$ residuals, percentage deviation, and interactive parameter controls.
* **Automated Anomaly Engine:** Algorithmic parameter space search that scans for states maximizing deviation from standard quantum mechanics while verifying numerical stability and feasibility limits.
* **Catalyst OS Verification:** Exportable canonical JSON research artifacts secured with SHA-256 hash chains, git commit SHA binding, and parameter digests.
* **Numerical Time Propagation:** Live interactive integration of $|\psi(t)\rangle$ showing energy level avoided crossings and probability oscillations.
* **Model Context Protocol (MCP):** Native integration points for AI/agent tool calling and automated quantum computation endpoints.

---

## 🌐 The Genesis Protocol: Complex-Systems Resource Routing

The Genesis Protocol extends experimental field mechanics to logistics and economic coordination under physical resource constraints:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      GENESIS ROUTING ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [ Physical Fields ] ───►  [ Operational Fit Signals ]                 │
│   (Scarcity, Energy,           │                                        │
│    Urgency, Quality)           ▼                                        │
│                     [ Genesis Route Engine ] ──► [ Cash / Credit Rail ] │
│                                │                     (Settlement)       │
│                                ▼                                        │
│                     [ Fallback to Market ] ───► [ Price Discovery ]     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Pillars
1. **Multi-Field Signals:** Physical fields measure spatial scarcity, demand, quality, energy availability, and compatibility without replacing price discovery or human consent.
2. **Stochastic Power Constraints:** 24-hour time-varying energy profiles simulate real-world grid intermittency and power outages.
3. **Dynamic Path Preview:** Real-time routing algorithms evaluate direct vs. relay paths, falling back to market mechanisms when routing nodes or telemetry fail.

> Read the [Genesis Operating Boundaries](docs/GENESIS_OPERATING_BOUNDARIES.md) and [Monetary Coordination Model](docs/MONETARY_COORDINATION_MODEL.md).

---

## 🏦 Systemic Stress & Coordination Lab

Located at `/systemic-lab`, this offline-first financial research workstation simulates institutional financial networks with full balance sheet reconciliation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  SYSTEMIC FINANCIAL STRESS NETWORK                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [ Fed / Central Bank ] ◄──► [ Direct Funding Claims ]                 │
│          ▲                              │                               │
│          │                              ▼                               │
│   [ Collateral Pools ] ◄────► [ Settlement Liquidity ] ──► [ Margin ]   │
│                                         │                     │         │
│                                         ▼                     ▼         │
│                               [ Intraday Payments ]  [ Fire Sales ]    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Experiments
* **LFBO Dollar-Funding Stress:** Cross-border liquidity shocks and collateral haircuts.
* **Intraday Settlement Disruption:** Gridlock resolution under time-critical payment queues.
* **Margin Spiral & Fire Sales:** Asset liquidation feedback loops and solvency degradation.

> Explore [Systemic Stress Lab Documentation](docs/SYSTEMIC_STRESS_LAB.md), [Financial Mechanisms](docs/FINANCIAL_MECHANISMS.md), and [Model Risk Review](docs/MODEL_RISK_AND_REVIEW.md).

---

## 🚀 Developer Quickstart & Command Reference

### Prerequisites
* **Node.js**: `v22.x` (or newer)
* **Package Manager**: `pnpm`

### Installation & Development

```bash
# Install dependencies
pnpm install

# Start local development server
pnpm dev

# Run Vitest unit & invariant tests
pnpm test

# Run ESLint linter
pnpm lint

# Perform TypeScript typechecking
pnpm typecheck

# Full verification suite (lint, typecheck, test, build)
pnpm verify

# Build production bundle
pnpm build

# Audit dependencies
pnpm audit:dependencies

# Export CycloneDX Software Bill of Materials (SBOM)
pnpm sbom > sbom.cdx.json
```

---

## 🔬 Experiment Integrity & Verification Standards

All simulation engines in R.A.I.N. Lab adhere to strict reproducibility guidelines:
* **Deterministic Stepping:** Time evolution engines utilize refresh-rate independent, fixed delta-t simulation steps.
* **Build & Parameter Provenance:** Exported experiment passports embed git commit SHAs, active parameter configurations, and timestamped audit logs.
* **Automated CI/CD Verification:** Continuous Integration workflows enforce linting, strict TypeScript checks, invariant tests, and bundle compilation on every pull request.

---

<div align="center">

*R.A.I.N. Lab — Bridging Quantum Physics, Complex Systems, and Financial Network Dynamics.*

</div>
