# Two-site model: assumptions

Machine-readable form: `WOODYARD_TWO_SITE.assumptions` and `.proseOnlyAssumptions` in `src/lib/researchModels.ts`.

## Encoded in code

These are enforced by what the code computes. Changing them changes the numbers.

1. Two-level truncation: only sites A and B exist.
2. Closed, unitary evolution: no decoherence, loss, or measurement back-action.
3. Real, constant mixing Δ.
4. Initial state \|A⟩.
5. ħ = 1 simulation units.
6. The coupling is linear and diagonal: gφ is added to each site energy.
7. φ is a prescribed external c-number. It has no dynamics and matter does not act back on it.
8. φ is sampled at two points only.
9. The drive is antisymmetric: φ_A + φ_B is constant in time. As a result, the workbench cannot express a common-mode drive. The audit tests one directly through the step function.
10. The same g couples at both sites.

## Stated only in prose

Nothing enforces these. Each is a gap between the narrative and the computation.

1. **φ is a physical scalar field.** It is never identified with any known field and has no units.
2. **g is a physical coupling constant.** No normalisation or scale is given, so it cannot be compared with any laboratory bound.
3. **Energies are in eV.** Earlier comments and UI labels said so. The executed protocol uses simulation units. Labels now say ε₀.
4. **The two-site model is a faithful reduction of the continuum theory.** No derivation of the reduction is in the repository.
5. **The adiabatic ground state describes a prepared experiment.** `twoSiteModel` reports lower-eigenstate occupations. The workbench instead evolves from \|A⟩, which is a different preparation.

## Consequences that follow from the encoded assumptions

- **Static identifiability.** With the drive off, H_model = H_std with E_A → E_A + gφ_A and E_B → E_B + gφ_B. A static measurement cannot separate g(φ_B − φ_A) from an uncalibrated detuning (`static-detuning-degeneracy`, reported as a warning).
- **Sign blindness.** With E_A = E_B, populations from \|A⟩ do not depend on the sign of g (`equal-energy-sign-symmetry`).
- **Mixing is required.** With Δ = 0 the coupling cannot move any population (`zero-mixing-limit`).
