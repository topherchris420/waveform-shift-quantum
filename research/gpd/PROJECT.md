# Project: two-site matter–scalar coupling

## Question

Does the proposed matter–scalar coupling (Woodyard 2026, Sec. 4), H(t) = [[E_A + gφ_A(t), Δ], [Δ, E_B + gφ_B(t)]], predict a two-site population evolution that differs from established quantum mechanics from the same initial state, and is that difference a property of the model rather than of the numerics?

A second question, which this project **cannot** answer: does nature show that difference? Answering it needs a physical identification of φ, a calibrated g and a measurement. None exists.

## Scope

In scope: the two-site sector as implemented in `src/lib/realitySplit.ts` and swept by `/experiments`, and the localization-kernel sector as rendered by the same file.

Out of scope: the teleportation and fallback branches of `compareModels()`. These are classified as speculative or illustrative and are not model predictions. Also out of scope: the Genesis Resource Lab, the Systemic Stress Lab and every financial or resource model. Physics verification applies to physics only.

## Conventions (locked)

| Convention | Value |
| --- | --- |
| Units | Simulation units, ħ = 1. Energies in ε₀ (unfixed scale), time in ħ/ε₀. Never seconds. |
| Field | φ has its own dimension F. It is not identified with any physical field. |
| Coupling | gφ is an energy, so [g] = E·F⁻¹. g alone is underspecified. |
| Basis | {\|A⟩, \|B⟩}, initial state \|A⟩ |
| Drive | φ_A(t) = φ_A + a sin ωt, φ_B(t) = φ_B − a sin ωt (antisymmetric) |
| Trace distance | D = ½Σ\|p_i − q_i\| = \|ΔP_B\| for two-level populations |
| Integrator | Exact exp(−iH dt) of each frozen step; driven H frozen at the step midpoint |

The machine-readable form is `TWO_SITE_UNITS` and `KERNEL_UNITS` in `src/lib/units.ts`.

## Verification targets

Each target names its executed check. See [limiting-cases/README.md](limiting-cases/README.md).

- Dimensional consistency of every equation-level constraint
- Hermiticity of every step Hamiltonian, unitarity of the step propagator, agreement with an independent matrix exponential
- Probability conservation in both branches
- g = 0 reduction, uniform-field nulls (static and driven), the uniform field as a pure global phase
- Δ = 0 transfer limit, E_A = E_B sign symmetry, static closed forms
- Timestep convergence dt → dt/2 → dt/4 with observed order
- Kernel: α → 0, flat field, constant kernel, density normalisation, grid convergence

## Status

See [reviews/2026-10-03-woodyard-two-site-audit.md](reviews/2026-10-03-woodyard-two-site-audit.md). Summary: the implementation survives every internal check. The model is computationally well-posed in simulation units and empirically untestable as specified.
