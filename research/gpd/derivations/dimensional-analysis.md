# Dimensional analysis

Base symbols: E (energy), T (time), L (length), F (the dimension of φ, which is unidentified). ħ has dimension E·T. The algebra is executable: `checkDimensionalConsistency` in `src/quantum/validation/dimensions.ts` reduces each constraint below to exponent vectors.

## Two-site sector (`TWO_SITE_UNITS`)

| Quantity | Dimension | Simulation unit | Calibration |
| --- | --- | --- | --- |
| E_A, E_B, Δ | E | ε₀ | simulation value |
| φ_A, φ_B, a | F | φ-unit | **underspecified** |
| g | E·F⁻¹ | ε₀ per φ-unit | **underspecified** |
| ω | T⁻¹ | ε₀/ħ | simulation value |
| t, dt | T | ħ/ε₀ | simulation value |

Constraints:

1. **diagonal-energy:** [E_A] = [gφ_A] = [g·a] = [Δ] = E, so **gφ must be an energy** and [g] = E·F⁻¹
2. **propagator-phase:** [H·dt/ħ] = 1
3. **drive-phase:** [ωt] = 1
4. **interferometric-phase:** [(g/ħ)·φ·t] = E·F⁻¹ · E⁻¹T⁻¹ · F · T = 1

All four balance. What dimensional analysis **cannot** supply: a value for F. Until φ is identified with a physical field, g cannot be expressed in SI, and no bound on g from any experiment can be applied.

Choosing ε₀ = 1 eV makes ħ/ε₀ ≈ 0.658 fs (`HBAR_EV_S`). That is a convention. Nothing in the model selects ε₀.

## Kernel sector (`KERNEL_UNITS`)

| Quantity | Dimension | Calibration |
| --- | --- | --- |
| ω₀, ω_w, Γ | T⁻¹ (kernel frequency unit) | **underspecified**: no relation to ε₀/ħ is declared |
| β | T⁻¹·F⁻¹ | **underspecified**: a free constant in code |
| κ | T⁻¹·F⁻¹·L² | **underspecified**: a free constant in code |
| x | L (sample half-width) | **underspecified** |
| α | 1 | simulation value |

Constraints: **local-resonance** ([ω₀] = [βφ] = [κφ/x²] = [ω_w] = [Γ] = T⁻¹) and **kernel-exponent** ([α] = 1). Both balance.
