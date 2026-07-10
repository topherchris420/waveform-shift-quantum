
# Make the Quantum Lab physicist-grade

Right now the app *looks* like a quantum sim, but it reads like a demo — labels are qualitative ("Transfer fidelity" as a wobbling sine), the teleportation "protocol" is a coordinate swap, and there is no math or reference to the real formalism. This plan raises it to something a working physicist would take seriously without changing the app's identity.

## Goals

1. Use the real formalism (Dirac notation, rendered LaTeX, correct units).
2. Ground each experiment mode in its actual analytical result.
3. Present data the way a lab does: axes, colorbars, exportable measurements, protocol circuit diagram.
4. Keep the current visual language (dark lab, cyan/violet/lime tokens, mono readouts) — just tighten it.

## Changes by area

### Teleportation mode — real protocol, not a swap

- Represent the qubit state as `|ψ⟩ = α|0⟩ + β|1⟩` on a small **Bloch sphere** widget (SVG, drag to rotate viewpoint).
- Replace the position swap with the **Bennett et al. 1993 protocol**:
  1. Prepare Bell pair `|Φ⁺⟩ = (|00⟩+|11⟩)/√2` between B and C.
  2. Bell-basis measurement on A,B → 2 classical bits.
  3. Apply Pauli correction (I, X, Z, XY) on C.
- Show the **circuit diagram** (H, CNOT, measurement, classical channel, conditional X/Z gates) as an inline SVG that lights up step-by-step as the animation runs.
- Compute and display real **fidelity** `F = |⟨ψ_in|ψ_out⟩|²` and show the 2 classical bits transmitted per run.

### Interference mode — quantitative fringes

- Overlay analytical intensity `I(y) = I₀ cos²(π d sin θ / λ)` on the rendered pattern, with axes in mm and radians.
- Slit separation `d`, wavelength `λ`, screen distance `L` become the sliders (replacing the abstract "field intensity" for this mode).
- Show a live **histogram** of detected photons along the screen accumulating over time — with a "collapse to particles" toggle that demonstrates single-photon build-up (Tonomura-style).

### Tunneling mode — real transmission coefficient

- Replace `exp(-V·0.052)` with the rectangular-barrier transmission:
  `T = [1 + V² sinh²(κa) / (4E(V−E))]⁻¹` for E<V, and the oscillatory form for E>V.
- Sliders: particle energy E (eV), barrier height V (eV), barrier width a (nm). Show `κa`, decay length, and T with three sig figs.
- Draw the actual wavefunction: incoming + reflected sinusoid on the left, exponential decay inside, transmitted sinusoid on the right, with `|ψ|²` shaded underneath.

### Superposition mode — Bloch sphere + measurement statistics

- Show the state on the Bloch sphere with adjustable θ, φ.
- "Measure" collapses to |0⟩ or |1⟩ with probabilities `cos²(θ/2)` / `sin²(θ/2)`; accumulate a **measurement histogram** and show it converging to the Born-rule prediction (with a running χ² goodness-of-fit).

### Global upgrades

- **KaTeX** for inline equations (Schrödinger, Bell states, Born rule, transmission coefficient) in each mode's premise panel.
- **Units everywhere**: Hz/THz, eV, nm, radians, °. Monospace tabular figures for numeric readouts (already have `tnum` in body).
- **Coordinate axes and colorbar** on the canvas (SI units, tick labels, a phase colorbar keyed to HSV domain coloring for the wave overlay).
- **Complex-phase coloring** for the standing waveforms: hue = arg(ψ), lightness = |ψ|. This is instantly readable to physicists.
- **Measurement log**: keep the current live log but add CSV export and show mean, σ, N.
- **References panel** (collapsible footer): Bennett et al. 1993 (teleportation), Nielsen & Chuang §1.3.7, Griffiths §2.5 (tunneling), Feynman Lectures III §1 (double slit) — with arXiv/DOI links.
- **Typography pass**: keep the current sans, but load **IBM Plex Serif** for equations and section headings' small caps eyebrows, and **JetBrains Mono** (already referenced in canvas text) for all numeric readouts. This is the visual code physicists recognize from papers and lab software (Origin, Igor, Mathematica notebooks).
- **Header rework**: replace "Vers3Dynamics Teleportation" hero with a compact instrument banner — project name, mode indicator, run/pause, timestamp, simulation clock in `t = 12.483 s` format, and an "About the model" link that opens a modal explaining assumptions (non-relativistic, single-particle, 1D barrier, ideal Bell pair, etc.).
- **Remove hyperbole**: rewrite copy to be neutral and technical. No "Watch particles pass through barriers they classically shouldn't!" — instead: "Rectangular potential barrier, non-relativistic Schrödinger regime."

## Technical notes

- Add `katex` (~70 KB) and use `<InlineMath>` from `react-katex`. Load stylesheet in `index.css`.
- Bloch sphere: pure SVG, no three.js needed — a 2D orthographic projection with draggable azimuth is enough and keeps bundle small.
- Circuit diagram: hand-authored SVG component with `data-step` attributes; animation driven by a small state machine tied to the existing `runExperiment` callback.
- Complex-phase coloring: precompute a 256-entry HSL LUT once, sample per pixel in the existing canvas draw loop — no perf regression.
- Keep `QuantumLab.tsx` as the shell but extract per-mode logic into `src/components/lab/{Teleportation,Interference,Tunneling,Superposition}.tsx` so the file stays under ~400 lines each.
- Store measurements in state as before; add a `toCSV()` helper and a download button.
- All new colors go through the existing tokens (`--quantum-glow`, `--violet`, `--lime`, `--copper`); no hardcoded hex in components.

## Out of scope

- No backend, no persistence across reloads.
- No real quantum simulator library (qiskit-in-browser is heavy) — analytical formulas are sufficient and more transparent.
- No 3D. The Bloch sphere stays 2D projected.
