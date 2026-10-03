# Limiting cases

Each row links a derivation to the executed check that tests it. `npm run physics:audit` fails if a check id listed in a model descriptor is not produced.

| Limit / invariant | Expected (derived) | Derivation | Check id | Audit status |
| --- | --- | --- | --- | --- |
| g → 0 | split ≡ 0 | two-site §1 | `g-zero-reduction` | PASS (0) |
| φ_A = φ_B static | no population effect | §2 | `uniform-field-null-static` | PASS (4e-14) |
| φ_A(t) = φ_B(t) driven | no population effect | §2 | `uniform-field-null-driven` | PASS (1e-14) |
| uniform field, phase | ⟨ψ_std\|ψ_model⟩ = e^{−igcT} | §2 | `uniform-field-global-phase` | PASS (2e-14) |
| Δ → 0 | P_B ≡ 0 | §3 | `zero-mixing-limit` | PASS (0) |
| E_A = E_B | P_B(g) = P_B(−g) | §4 | `equal-energy-sign-symmetry` | PASS (6e-16) |
| static baseline | Rabi closed form | §5 | `baseline-rabi-closed-form` | PASS (1e-14) |
| static proposed | Rabi with δ + gΔφ | §5 | `static-model-closed-form` | PASS (3e-15) |
| static coupling | ≡ bare detuning | §6 | `static-detuning-degeneracy` | WARNING (identifiability) |
| driven dt → 0 | order 2 | §0 | `convergence-trend` | PASS (2.00) |
| α → 0 | P_loc = Born | §8 | `kernel-alpha-zero` | PASS |
| flat φ | P_loc = Born | §8 | `kernel-flat-field` | PASS |
| constant χ | cancels | §8 | `kernel-constant-cancels` | PASS |

Measured values are from the audit at the workbench defaults (g swept to 1.6, contrast 1.2, Δ = 0.25, a = 0.4).
