# Requirements

A requirement is **met** only when an executed check or an inspected artifact shows it. A requirement is never met because documentation says so.

## Computational (testable by simulation)

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| C1 | Every equation is dimensionally consistent | Met | `dimensions-two-site-simulation-units.v1`, `dimensions-localization-kernel-simulation-units.v1` |
| C2 | Every step Hamiltonian is Hermitian; the step propagator is unitary and equals exp(−iH dt) | Met | `hamiltonian-hermiticity`, `propagator-unitarity`, `propagator-matches-expm` |
| C3 | Probability is conserved in both branches | Met | `probability-conservation` |
| C4 | g = 0 reproduces established QM exactly | Met | `g-zero-reduction` |
| C5 | A uniform field (static or driven) produces no population effect | Met | `uniform-field-null-static`, `uniform-field-null-driven` |
| C6 | Δ = 0 forbids transfer; E_A = E_B gives g → −g symmetry; static branches follow closed forms | Met | `zero-mixing-limit`, `equal-energy-sign-symmetry`, `baseline-rabi-closed-form`, `static-model-closed-form` |
| C7 | Time discretisation converges at the expected order across dt, dt/2, dt/4 | Met for the protocol domain | `timestep-dt-half`, `timestep-half-quarter`, `convergence-trend` |
| C8 | Kernel limits α → 0, flat field and constant kernel hold; density normalised | Met | `kernel-*` checks in the audit |
| C9 | Every declared invariant and limit is backed by an executed check | Met | audit "claim coverage" |
| C10 | Old experiment records replay under their own protocol | Met | `src/test/experimentWorkbench.test.ts` (v1 fixture) |

## Empirical (not testable by simulation)

| ID | Requirement | Status |
| --- | --- | --- |
| E1 | φ is identified with a physical field, with units | **Unmet** |
| E2 | g has a calibrated normalisation | **Unmet** |
| E3 | A physical system exists whose two sites see different φ | **Unmet** |
| E4 | E_B − E_A can be calibrated independently, to better than g·Δφ | **Unmet**. Without it, a static effect is indistinguishable from detuning |
| E5 | An apparatus resolution and noise model for P_B is declared | **Unmet** |
| E6 | Decoherence is modelled, or shown negligible on the relevant timescale | **Unmet**. The evolution is closed |
| E7 | Kernel frequencies and length have physical units; β and κ are declared parameters | **Unmet** |

Until E1–E6 are met, the empirical falsification condition for the two-site model is **defined but not operational**.
