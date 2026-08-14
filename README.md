# R.A.I.N. Lab (experiment #9)

Evaluating standard quantum mechanics alongside the proposed **Woodyard (2026)** field-modulated spatial localization model.

> **Research Instrument Notice:** This application is designed as a rigorous scientific workstation. Established quantum mechanics and proposed physical extensions are strictly segregated, with explicit falsification conditions and cryptographically verifiable research artifacts.

---

## Epistemic Classification Framework

To ensure scientific rigor, all physics calculations and visual models are tagged under four explicit categories:

### 1. ESTABLISHED PHYSICS
- **Standard Quantum Mechanics**: Schrödinger evolution $i\hbar \frac{\partial\psi}{\partial t} = H\psi$, Born-rule outcome probabilities $P(i) = |\langle i|\psi\rangle|^2$.
- **Barrier Tunneling**: 1D rectangular potential barrier transmission $T(E, V, a)$.
- **Quantum Teleportation**: Bennett et al. (1993) 3-qubit discrete protocol via pre-shared entanglement and classical communication.
- **Werner States & Entanglement**: Entanglement concurrence $C(\rho) = \max(0, \frac{3p-1}{2})$ and Massar-Popescu classical limit $F \le 2/3$.

### 2. PROPOSED MODEL (Woodyard 2026)
- **Field-Modulated Two-Site System**: Hamiltonian $H_2 = \begin{pmatrix} E_A + g\phi_A & \Delta \\ \Delta & E_B + g\phi_B \end{pmatrix}$ with matter-scalar coupling $g$.
- **Localization Response Kernel**: Biased spatial density profile $P_{\text{loc}}(x) = \frac{\chi(x) P_B(x)}{\int \chi(x') P_B(x') dx'}$ with kernel factor $\chi(x) = \exp[\alpha L(x)]$.
- **Numerical Time Evolution**: Unitary matrix propagation $U(dt) = \exp(-i H dt / \hbar)$ preserving state norm $P_A(t) + P_B(t) \equiv 1.0$.

### 3. INTERPRETIVE CLAIM
- Conceptual framing of spatial location as an internal dynamical state modulated by scalar fields, rather than a fixed classical coordinate.

### 4. TESTABLE PREDICTIONS & FALSIFICATION CONDITIONS
- **Interferometric Phase Shift**: $\Delta\varphi_\phi = \frac{g}{\hbar} \int_0^T [\phi(x_1(t),t) - \phi(x_2(t),t)] dt$.
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

The Genesis Protocol extends Waveform Shift's experimental philosophy into economic coordination: run monetary exchange and computational resource routing from equivalent starting conditions, measure where their outcomes diverge, and search for the conditions under which each coordination mechanism performs better.

The laboratory now compares four architectures—Market, a lender-of-last-resort Stabilized Market, a telemetry-enabled Computational Market/Hybrid, and direct physical-resource Genesis routing—against one hidden oracle-welfare benchmark. Monetary trades must actually clear through balances, credit, collateral, counterparties, and settlement. The workstation reports feasible-but-unserved demand, stranded physical utility, a conserved unmet-demand decomposition, central-bank utilization, a transparent Thermodynamic Safety Valve, and a parameter-space Coordination Regime Map. Pure financial shocks preserve the physical world, while real-resource shocks bind every mechanism.

Genesis is not an anti-money claim and cannot receive a hardcoded victory. Discovery and holdout seeds remain separate; superiority must beat the strongest monetary/hybrid comparator, clear confidence and oracle-gap requirements, pass systemic-risk gates, and survive overhead sensitivity. See [the monetary coordination model](docs/MONETARY_COORDINATION_MODEL.md) for mechanisms, assumptions, hypotheses, and falsification conditions.

> **Core Principle:** Computation may outperform money for coordinating physically measurable resources (where the scarce information is how resources physically fit together), while markets remain superior where subjective preferences, price discovery, and financial risk carry the most valuable information.

### Key Simulation Components
1. **Multidimensional Value Vectors**: Replaces single scalar monetary pricing with 8-dimensional resource vectors $V_i(t) = f(S_i, D_i, U_i, Q_i, L_i, E_i, R_i, C_i)$ measuring scarcity, demand, urgency, quality, location, energy cost, reliability, and compatibility.
2. **CAISO Duck Curve Engine**: A 24-hour stochastic power grid simulator that models real-world energy availability anomalies.
3. **Multi-Hop Triangulation**: Dynamic routing through intermediary relay nodes (Battery Storage, Compute Brokers, Data Hubs) to perform time-shifting and form-shifting resource allocation.


---

## Verification & Build Suite

```bash
# Run scientific invariant test suite (10 automated vitest invariant checks)
npm test

# Run ESLint linter
npm run lint

# Build production bundle
npm run build
```
