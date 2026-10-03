# Research map

A map of the physics in this repository, made before anything was added. The first column of the capability table records what already existed. This change extended those systems; it did not replace them.

## Models and baselines

| Model | Epistemic class | Equations | Code |
| --- | --- | --- | --- |
| Two-site tunnelling | Established | H = [[E_A, Δ], [Δ, E_B]] | `evolveTwoSiteState` (g = 0), `twoSiteModel` |
| Two-site matter–scalar coupling (Woodyard 2026 §4) | Proposed | H(t) = [[E_A + gφ_A(t), Δ], [Δ, E_B + gφ_B(t)]] | `simulateRealitySplit` model branch |
| Localization kernel (Woodyard 2026 §3) | Proposed | ω_loc = ω₀ + βφ + κ∇²φ; χ = exp(αL); P_loc = χ\|ψ\|²/∫χ\|ψ\|² | `localizationKernel`, `observedLocalizationDensity`, `computeDivergenceField('scalar_kernel')`, `kernelRegionSeparation` |
| Interferometric phase (§7.2) | Proposed, formula only | Δφ = (g/ħ)∫[φ(x₁) − φ(x₂)]dt | `interferometryPhaseShift`, used by no protocol |
| Clock comparison (§7.3) | Proposed, formula only | ΔΦ = η∫[φ(x_A) − φ(x_B)]dt | `clockComparisonPhase`, used by no protocol |
| Ehrenfest potential (§6) | Proposed, formula only | V_eff = V + gφ | `ehrenfestEffectivePotential` |
| Barrier tunnelling, Born rule, double slit, Werner/Horodecki teleportation | Established | textbook closed forms | `src/lib/physics.ts` |

Descriptors: `src/lib/researchModels.ts` (`standard-two-site-qm`, `woodyard-two-site-v1`, `woodyard-localization-kernel-v1`).

## Comparison engine

`src/lib/realitySplit.ts` evolves both branches from \|A⟩ on the same grid with the same step function. When g = 0 they are the same floats. This is unchanged. What changed:

- the header now separates *exact frozen-step propagation* from the *O(dt²) midpoint discretisation* of a driven H(t)
- final state vectors are returned, so a phase quantity (c_A*c_B) can be convergence-tested
- unit comments say ε₀ and ħ/ε₀, not eV
- the kernel coefficients are exported, so their inconsistency with `compareModels` can be checked

## Capability inventory (before → after)

| Capability | Existed before | Added |
| --- | --- | --- |
| Validation helpers | `validateNormalization`, `validateHermitian2x2` (throwing) | Structured `VerificationResult` checks in `src/quantum/validation/`; the Hermitian guard now delegates to them |
| g = 0 control | Workbench check on sample 0; `realitySplit.test.ts` | Same check, plus a named limit backed by the model descriptor |
| Uniform-field null | Workbench "Null control" preset (static only) | Static and driven common-mode nulls, plus the uniform field's non-null sector (global phase e^{−igcT}) |
| Δ → 0, E_A = E_B, static closed forms | Not tested | Executed checks, each with a negative control |
| Timestep check | dt vs dt/2 on P_B | dt → dt/2 → dt/4 ladder over P_A, P_B, D, max D, mean D, coherence, with observed order |
| Propagator correctness | Norm test only | Unitarity and agreement with an independent scaling-and-squaring exponential |
| α → 0, flat kernel, normalisation | `realitySplit.test.ts`, `physics.test.ts` | Same properties as reusable checks, run by the audit |
| Units | Prose: "simulation units, ħ = 1" in the workbench; "eV" in comments and UI | `src/lib/units.ts`: machine-readable declaration, dimension algebra, calibration status; executed checks for consistency and honest labels |
| Epistemic classes | 4 classes in `epistemics.ts` | Same 4 classes; added the comparison-derivation axis, research statuses and the four gates |
| `compareModels` | `scientificStatus` per branch | `derivation` category per branch; the placeholder branch is no longer labelled Proposed |
| Observables | Implicit | `src/lib/observables.ts` with kind, units, calibration, sensitivity (`unknown`), confounders, falsification rule |
| Experiment records | `waveform-experiment.v1`: protocol, spec, results, 3 checks, digest, replay | `waveform-experiment.v2` adds model descriptor, unit declaration, observables, research question, ladder, full integrity list and assessment. v1 still replays under v1 |
| Audit | none | `npm run physics:audit` (console + JSON), in `verify` and CI |

## Numerical methods

| Method | Where | Exactness |
| --- | --- | --- |
| Closed-form 2×2 exp(−iH dt) | `evolveTwoSiteState` | Exact for the frozen H |
| Exponential midpoint rule | `simulateRealitySplit` with drive | O(dt²) global |
| Rectangle-rule time average | `meanDivergence` | Summary statistic |
| Riemann sums on a uniform x-grid | `computeDivergenceField`, `kernelRegionSeparation` | Region boundary located to one cell (first order) |

## Routes and workstations

`/` quantum lab (Reality Split, ComparisonPanel), `/experiments` workbench (protocol v2), `/arfr` field routing (separate passports), `/resonance` Genesis Resource Lab, `/systemic-lab` financial stress lab. The last two are outside physics verification. `src/test/researchIntegrity.test.ts` enforces that the import graphs stay separate.

## Tests and CI

Physics: `physics.test.ts`, `realitySplit.test.ts`, `quantumValidation.test.ts`, `experimentCard.test.ts`, `targetLock.test.ts`, `experimentWorkbench.test.ts`, and new `physicsVerification.test.ts`, `researchIntegrity.test.ts`, `experimentReplayFailure.test.ts`. CI (`.github/workflows/verify.yml`) runs lint, typecheck, tests, build and now `npm run physics:audit`.

## Known open issues (not fixed here)

- `src/lib/platforms.ts` holds order-of-magnitude noise floors for five apparatus classes without citations. Target Lock and the experiment cards compare simulation-unit predictions against them, although no physical mapping of φ or g exists. Their "testable" verdicts are therefore not operational. See the audit report.
- `compareModels`' kernel branch uses β = 0.5, κ = 0.1 and a fixed ∇²φ = 0.2, while the spatial kernel uses β = 2.0, κ = 0.15 and an analytic Laplacian. Both are now disclosed, and the branch is classified illustrative.
- The default kernel α = 1.2 lies outside the stated weak-response domain α ≲ 1.
