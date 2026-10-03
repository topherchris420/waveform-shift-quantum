# Audit: Woodyard two-site scalar-field proposal

- **Date:** 2026-10-03
- **Tool:** `npm run physics:audit` (protocol `two-site-coupling-sweep.v2`, workbench defaults: g swept 0 → 1.6, φ_B − φ_A = 1.2, Δ = 0.25, a = 0.4, ω = 1.5, T = 12, dt = 0.02)
- **Posture:** adversarial. Nothing was tuned to make the model pass. Every number below was produced by an executed check, except where marked *declared*.

**Scientific conclusion: none.** This audit establishes computational and internal-consistency properties only.

## 1. The four gates

| Question | Outcome |
| --- | --- |
| Did the code run? | **Pass**: 357 finite outputs |
| Did the numerical method behave correctly? | **Pass** |
| Does the proposed model internally survive its controls? | **Pass** |
| Does nature exhibit the predicted effect? | **Not evaluable by simulation** |

Research status at the defaults: `simulation_effect_present` (the code predicts a separation). Empirical status: `empirical_result_required`.

## 2. Assumptions

**Encoded in code (10):** two-level truncation; closed unitary evolution; real constant Δ; initial state \|A⟩; ħ = 1; linear diagonal coupling gφ; φ prescribed, with no dynamics or back-reaction; φ sampled at two points; antisymmetric drive; the same g at both sites.

**Stated only in prose (5):** φ is a physical field; g is a physical constant; energies are in eV; the two-site model faithfully reduces the continuum theory; the adiabatic ground state describes the prepared experiment. None of these is enforced. The eV claim contradicted the executed protocol and has been removed from labels. See `assumptions/two-site-assumptions.md`.

## 3. Units and dimensions

- **Pass:** all 4 two-site constraints and both kernel constraints balance dimensionally.
- **Pass:** no quantity is labelled in seconds or eV under ħ = 1, and no calibration is claimed without a source.
- **Warning (declared): underspecified.** Only gφ is fixed (an energy). g has dimension E·F⁻¹, where F, the dimension of φ, is unidentified. ε₀ is unfixed, so no simulated time maps to seconds. g, φ_A, φ_B and a have **no calibrated value and cannot be mapped to SI or laboratory units.** In the kernel sector, ω₀, ω_w, Γ, β, κ and x are all underspecified, and the kernel frequency unit has no declared relation to ε₀/ħ.

## 4. Limits and invariants

All pass. Measured values:

| Check | Measured | Tolerance |
| --- | --- | --- |
| Hamiltonian Hermiticity (25,200 step matrices) | 0 | 0 |
| Propagator unitarity | 2.2e-16 | 1e-10 |
| Propagator vs independent exp(−iH dt) | 1.1e-16 | 1e-10 |
| Probability conservation | 1.8e-13 | 1e-10 |
| Baseline = Rabi closed form | 1.2e-14 | 1e-10 |
| g = 0 reduction | 0 | 1e-12 |
| Uniform static field null | 4.2e-14 | 1e-12 |
| Uniform driven field null | 1.5e-14 | 1e-12 |
| Uniform field = global phase e^{−igcT} | 1.6e-14 | 1e-7 |
| Δ = 0: no transfer | 0 | 1e-12 |
| E_A = E_B: g → −g symmetry | 5.8e-16 | 1e-10 |
| Static proposed = Rabi closed form | 2.7e-15 | 1e-10 |
| Two-site density rendering normalisation | 8.9e-16 | 1e-9 |

**No limit fails.** The implementation is internally consistent with its declared Hamiltonian. That is a statement about the code.

## 5. Convergence and stability

| Metric | err(dt, dt/2) | err(dt/2, dt/4) | Order |
| --- | --- | --- | --- |
| P_A, P_B, D | 2.2e-5 | 5.4e-6 | 2.00 |
| max D | 1.2e-5 | 3.1e-6 | 2.00 |
| mean D | 5.3e-6 | 1.3e-6 | 2.00 |
| coherence c_A*c_B | 1.1e-5 | 2.6e-6 | 2.00 |

This is the exponential-midpoint O(dt²) behaviour, which is the expected order. Static configurations agree to rounding level (~1e-13), because each frozen-step exponential is exact. **The driven trajectory is a second-order approximation, not an analytic solution.**

**Stability scan** at dt = 0.02, worst metric over all ladder metrics:

- 24 points spanning the protocol domain: worst finest-pair error 3.9e-5, all within 1e-3
- beyond the domain (g = 5, 20, 80 and Δ = 3, 10): still within tolerance, order ≈ 2
- at large g the P_B error stays small partly because a large detuning suppresses transfer. The coherence metric is the binding one there (7e-5 at g = 20).

No numerically unstable region was found in or near the protocol domain.

## 6. Observables

| Quantity | Kind | Prediction for a real apparatus |
| --- | --- | --- |
| P_B(t), z | simulated observable | **not defined**: g and φ uncalibrated |
| D(t), max D, mean D, spatial divergence | numerical diagnostic | not a measured quantity |
| δ, χ(x), ω_loc | internal model variable | not measurable on its own |
| Interferometric phase Δφ_φ | experimentally measurable *type* | **not defined**: requires calibrated g and a physical φ(x, t) |
| Clock phase ΔΦ_AB | experimentally measurable *type* | **not defined**: η has no relation to g |

Required sensitivity is **unknown** for every physical observable. None was invented.

## 7. Where the proposed effect comes from

The two-site separation exists **only because of the assumed coupling term gφ** on the Hamiltonian diagonal. Three consequences limit what it can mean:

1. **Static degeneracy (warning).** With the drive off, the proposed trajectory equals established QM with relabelled bare energies (difference 0 to rounding). A static population measurement cannot distinguish g(φ_B − φ_A) from an uncalibrated detuning. Only a controlled modulation of φ, with E_B − E_A independently calibrated, could.
2. **Sign blindness.** With E_A = E_B, as in the protocol, populations cannot reveal the sign of g.
3. **Mixing required.** With Δ = 0, no coupling strength moves population.

## 8. Is the falsification language operational?

- **Internal consistency:** defined and **operational**. It is executed on every run.
- **Empirical:** defined and **not operational**. Missing: a physical identification of φ; a calibrated g; a two-site system that sees different φ; independent detuning calibration better than g·Δφ; an apparatus resolution and noise model for P_B; a decoherence model.

The earlier README text ("constrain this deviation to zero within σ < 10⁻⁴ … that region is rejected") and the comparison-panel text ("match within 5σ … the hypothesis is falsified") asserted an operational empirical test with an invented noise floor. Both have been rewritten.

## 9. compareModels() classification

| Branch | Category | Model prediction? |
| --- | --- | --- |
| `two_site` | derived prediction (static lower-eigenstate occupation, Eq. 15–19) | yes, but subject to the static degeneracy above |
| `scalar_kernel` | illustrative: a bare χ at one point, with fixed β = 0.5, κ = 0.1, ∇²φ = 0.2 | no |
| `teleportation` | speculative: decoherence × (1 − 0.1α), no derivation | no |
| fallback (`interference`, …) | illustrative: placeholder 0.5 + 0.1α, previously labelled *Proposed* | no |

The UI now renders non-derived values with a dashed border, struck-through value and an explicit "not a model prediction" label.

## 10. Findings that remain open

1. **Platform noise floors are uncited.** `src/lib/platforms.ts` gives order-of-magnitude single-shot and systematic floors for five apparatus classes. Target Lock and the experiment cards judge simulation-unit predictions "testable" against them, although no mapping from φ or g to any of those platforms exists. Those verdicts should be read as arithmetic on assumed inputs, not as feasibility. Recommended: mark each floor with a source or `unknown`, and gate the "testable now" verdict on a declared φ → platform mapping.
2. **Kernel coefficients differ across code paths** (warning): β = 2.0, κ = 0.15 in the spatial kernel versus β = 0.5, κ = 0.1 in `compareModels`. The model fixes neither, so the two surfaces do not show the same model instance.
3. **Default α = 1.2 exceeds the stated weak-response domain** α ≲ 1 (warning). Kernel results at the defaults are an extrapolation.
4. **No verified literature.** The source paper is not in the repository, and its equation numbers have not been checked.

## 11. What real measurement specification is still missing

A physical field for φ with units; a value or scale for g; a platform with two sites at different φ; a means to modulate φ in a controlled way; independent calibration of the bare detuning; a P_B readout resolution and noise model; and a decoherence model. Without these, the proposal is a well-posed simulation of an unfalsifiable hypothesis.
