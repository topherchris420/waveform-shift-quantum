# Two-site limits and invariants: derivations

Every expected outcome encoded in `src/quantum/validation/twoSite.ts` is derived here first. Conventions: ħ = 1, basis {\|A⟩, \|B⟩}, initial state \|A⟩,

  H(t) = [[E_A + gφ_A(t), Δ], [Δ, E_B + gφ_B(t)]] = e₀(t)·I + d_z(t)·σ_z + Δ·σ_x,

with e₀ = (H₁₁ + H₂₂)/2 and d_z = (H₁₁ − H₂₂)/2. The established branch is the same matrix with g = 0.

## 0. What the integrator does

Each step applies U_n = exp(−iH(t_n^mid) dt), where t_n^mid = (n − ½)dt. The closed form in `evolveTwoSiteState` is the exact exponential of that frozen matrix, so:

- **Static H** (the established branch, or the proposed branch with a = 0): U_n = U(dt) for all n, and U(dt)^N = U(N·dt) exactly. The trajectory has **no discretisation error**, only rounding.
- **Driven H(t)**: freezing H at the midpoint is the exponential midpoint rule. In the Magnus expansion, the midpoint value reproduces ∫H dt over the step to O(dt³), and the first commutator term [H(t₁), H(t₂)] is also O(dt³). The local error is therefore O(dt³) and the global error O(dt²). Halving dt should cut the error about 4×, which is an observed order of 2.

The two cases are verified separately: `baseline-rabi-closed-form` and `static-model-closed-form` check the static claim, and the convergence ladder checks the driven claim. The audit shows observed order 2.00 for every driven metric. Static metrics agree to about 1e-13.

**Why the ladder compares at coarse-grid times.** The grids nest: dt/2 and dt/4 contain every coarse time. Comparing at those shared times isolates integration error. A maximum over a finer grid would also pick up peak-sampling error, which can make the error grow under refinement for reasons unrelated to the integrator.

## 1. Coupling removal, g → 0

H_model ≡ H_std, entry by entry. The two branches call the same function with identical floats, so the split is exactly 0, not just small. Check: `g-zero-reduction` (tolerance 1e-12; measured 0).

## 2. Uniform field, φ_A(t) = φ_B(t) = c(t)

H_model(t) = H_std + g·c(t)·I. The identity commutes with everything, so for each frozen step

  U_n^model = e^{−ig c_n dt} · U_n^std  exactly,

and after N steps \|ψ_model⟩ = e^{−ig Σ c_n dt} \|ψ_std⟩.

**Insensitive to a uniform field:** P_A, P_B, the trace distance D, the spatial density rendering, and every expectation value ⟨ψ\|O\|ψ⟩. The state differs only by a global phase.

**Not insensitive:**
- absolute energies, because the eigenvalues shift by g·c (`twoSiteModel(...).E_minus` moves by exactly gc)
- the global phase, which is −gcT for a static c
- a relative phase *between two systems that see different c*. That is the interferometric sector Δφ = (g/ħ)∫[φ(x₁) − φ(x₂)]dt. It is a non-uniform configuration, so it is not a counterexample.

The null therefore holds for populations only. It must not be read as "a uniform field does nothing". Checks:

- `uniform-field-null-static`: φ_A = φ_B = c ≠ 0, drive off
- `uniform-field-null-driven`: φ_A(t) = φ_B(t) = c + a sin ωt. Reality Split's drive is antisymmetric and cannot express this case, so the check calls the step function directly.
- `uniform-field-global-phase`: ⟨ψ_std(T)\|ψ_model(T)⟩ = e^{−igcT}, the non-null sector
- negative control (test): the antisymmetric drive with φ_A = φ_B = 0 *does* move population, so the null is specific to a common field

The workbench "Null control" preset (contrast 0, drive 0) is the static uniform case with c = 0.

## 3. Zero mixing, Δ → 0

H(t) is diagonal for all t, so every U_n is diagonal and so is their product. Starting from \|A⟩, the B amplitude stays exactly 0: **P_B(t) ≡ 0 in both branches, whatever g and φ(t) do.** The proposed coupling cannot transfer population without mixing. In the frozen-step code, d = \|d_z\| and u_x = 0, so U is diagonal by construction. Check: `zero-mixing-limit` (measured 0).

The workbench input domain requires Δ ≥ 0.05. This checks the implementation limit, not a workbench setting.

## 4. Equal bare energies, E_A = E_B

With E_A = E_B, d_z = g(φ_A − φ_B)/2 is odd in g, while e₀ shifts by a multiple of the identity. Since σ_xσ_zσ_x = −σ_z and σ_xσ_xσ_x = σ_x,

  H(−g) = σ_x H(g) σ_x + κ(t)·I.

Each step propagator obeys U_n(−g) = e^{iθ_n} σ_x U_n(g) σ_x, and so does their product. Then

  P_B^{(−g)} = \|⟨B\|σ_x U(g) σ_x\|A⟩\|² = \|⟨A\|U(g)\|B⟩\|² = \|U_AB(g)\|².

Every 2×2 unitary has the form e^{iα}[[a, b], [−b*, a*]], so \|U_AB\| = \|U_BA\|. Hence **P_B(t) is identical for g and −g**, exactly, at the discrete level too.

Consequence: with E_A = E_B the sign of g is **not identifiable** from populations measured from \|A⟩.

Checks: `equal-energy-sign-symmetry` (measured ~6e-16). The test also confirms that the symmetry *fails* for E_B ≠ E_A, with a difference above 1e-2, so the check is not vacuous.

The baseline for E_A = E_B is the resonant Rabi oscillation P_B(t) = sin²(Δt), with full transfer. Check: `baseline-rabi-closed-form`.

## 5. Static closed form

For static H, P_B(t) = (4Δ²/Ω²) sin²(Ωt/2) with Ω² = δ² + 4Δ² and δ = H₂₂ − H₁₁:

- established: δ = E_B − E_A
- proposed, drive off: δ = E_B − E_A + g(φ_B − φ_A)

Checks: `baseline-rabi-closed-form`, `static-model-closed-form` (both ~1e-14).

## 6. Static identifiability

From §5, the static proposed branch is established QM with relabelled bare energies E_A → E_A + gφ_A and E_B → E_B + gφ_B. No static population measurement can distinguish a coupling from an uncalibrated detuning. Distinguishing them requires a **controlled change** of φ with E_B − E_A calibrated independently, to better than g·Δφ. Check: `static-detuning-degeneracy`. It is reported as a **warning** on the empirical gate. Confirming the degeneracy limits what can be learned, so it is not a success for the model.

## 7. Spatial rendering

Each predicted density is a mixture P_A·G_A(x) + P_B·G_B(x) of fixed, normalised Gaussian wells, renormalised on the grid. Both densities integrate to 1, so their difference integrates to 0. Coarse-graining cannot add distinguishability, so ∫\|Δρ\| ≤ 2D (data-processing inequality). Check: `density-rendering-normalization`. The well shapes are a rendering choice, not part of the model.

## 8. Localization kernel

With P_loc = χ\|ψ\|²/∫χ\|ψ\|² and χ = exp(αL):

- **α → 0:** χ ≡ 1, so P_loc = Born exactly (`kernel-alpha-zero`)
- **flat field:** φ constant ⇒ ∇²φ = 0 ⇒ ω_loc constant ⇒ L and χ constant ⇒ χ cancels: P_loc = Born for any α (`kernel-flat-field`)
- **any constant χ** cancels identically (`kernel-constant-cancels`). So the bare factor χ at one point, which is what `compareModels` reports, is not an observable.
- **normalisation:** ∫P_loc = ∫Born = 1, so ∫Δρ = 0 (`kernel-density-normalization`)
