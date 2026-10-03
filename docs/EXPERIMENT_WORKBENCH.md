# Experiment workbench

`/experiments` turns the existing Reality Split engine into a bounded, replayable experiment. It compares standard quantum mechanics with the proposed scalar-field coupling, using the same initial state and propagator. Other workstations remain separate domains; this result makes no claim about resource or financial networks.

## Protocol `two-site-coupling-sweep.v2`

Both branches start at site A. Bare site energies are 1 ε₀, drive angular frequency is 1.5 ε₀/ħ, duration is 12 ħ/ε₀, and the coarse timestep is 0.02 ħ/ε₀.

### Units

The protocol runs in **simulation units** with ħ = 1. Energies are multiples of an arbitrary scale ε₀ that the model does not fix, and times are multiples of ħ/ε₀. **No simulated time is in seconds.** Choosing ε₀ = 1 eV would make the time unit ≈ 0.658 fs, but that is a convention, not a calibration.

The Hamiltonian fixes only the product gφ, which must be an energy. φ is not identified with a physical field, so g (dimension ε₀ per φ-unit), φ_A, φ_B and the drive amplitude are **underspecified**. They are numerical parameters, not calibrated quantities. The machine-readable declaration is `TWO_SITE_UNITS` in `src/lib/units.ts`. Records carry it, and the integrity list checks it: every constraint balances dimensionally, no label claims seconds or eV, and no calibration is claimed without a source.

### Inputs

The standard branch has g = 0. The proposed branch uses the sampled g, static fields φA = −contrast/2 and φB = contrast/2, and an antisymmetric sinusoidal drive. Every sample is a fresh trajectory; results do not depend on navigation, elapsed wall time, or a random seed.

| Input | Accepted range |
| --- | --- |
| Maximum coupling | 0–2 |
| Static field contrast | 0–2 |
| Inter-site mixing | 0.05–1 |
| Drive amplitude | 0–1 |
| Samples | Integer 2–41; interface presets use 21 |

Sampling is linear, inclusive of zero and the selected maximum. Strict validation occurs before any computation, including for imported files.

### Research question

Each run carries a question, a hypothesis and an optional resolution on |ΔP_B|, all declared before execution. The protocol generates the rest of the card: baseline, null controls, independent variables, observables, numerical requirements and rejection criteria. The card is serialised at run start and covered by the digest. That binds it to the result. It cannot prove the question was written before someone saw an earlier run.

## What is exact and what is not

Each step applies the exact matrix exponential exp(−iH dt) of a frozen Hamiltonian. A **static** Hamiltonian is therefore propagated without discretisation error. This covers the established branch, and the proposed branch with the drive off. A **driven** Hamiltonian is frozen at each step's midpoint (exponential midpoint rule), an approximation whose global error is O(dt²). The driven trajectory is never described as analytically exact.

## Convergence ladder

Every sample is run at dt, dt/2 and dt/4. For P_A, P_B, the trace distance D, max D, mean D, and the final-time coherence c_A*c_B (a phase quantity invariant under global phase), the record stores error(dt, dt/2) and error(dt/2, dt/4).

Errors are compared at the coarse-grid times, which all three grids share. This isolates integration error from peak-sampling error. Each metric is classified as:

- **roundoff**: the finest pair agrees to ≤ 1e-10 (expected for static H)
- **asymptotic**: the error falls with observed order ≥ 1.5 (2 is expected)
- **pre-asymptotic**: the error falls, but more slowly
- **not converging**: halving dt did not reduce the error

## Physics integrity

After a run the workbench lists every check under four separate questions. Passing one never implies the next.

1. **Did the code run?** Finite outputs.
2. **Did the numerical method behave correctly?** Hermiticity of every step Hamiltonian; unitarity of the step propagator; agreement with an independent scaling-and-squaring exponential; probability conservation over all rungs (≤ 1e-10); the established branch against the Rabi closed form; dt → dt/2 and dt/2 → dt/4 agreement (≤ 1e-3); convergence trend; normalisation of the rendered spatial densities.
3. **Does the proposed model internally survive its controls?** Dimensional consistency; g = 0 collapse (≤ 1e-12); uniform static and uniform driven field nulls; the uniform field acting as the pure global phase e^{−igcT}; Δ = 0 transfer limit; E_A = E_B sign symmetry g → −g; the static proposed branch against its closed form.
4. **Does nature exhibit the predicted effect?** Never evaluable by simulation. Listed here: honest unit labels and calibration claims; the static coupling's exact degeneracy with a bare detuning (warning); physical units not calibrated (declared warning); experimental sensitivity unknown (declared warning).

Items marked *declared* restate metadata. They can only warn, never pass. The derivation behind every limit is in [research/gpd/derivations/two-site-limits.md](../research/gpd/derivations/two-site-limits.md).

### Research status

The status is computed from the checks with pessimistic precedence:

1. a numerical failure → `numerically_unstable`
2. a control failure → `control_failed`
3. a domain, unit or calibration failure → `assumptions_invalid`
4. another limit or invariant failure → `falsified_in_tested_parameter_region`. This is implementation-level only and never an empirical falsification.
5. otherwise, depending on the largest separation:
   - at or below 1e-12 → `simulation_effect_absent`
   - at or below 10× the finest ladder error → `inconclusive`
   - below a declared resolution → `prediction_below_declared_resolution`
   - otherwise → `simulation_effect_present`

The empirical status is always `empirical_result_required`. No simulation returns "confirmed".

## Records and replay

A v2 record (`waveform-experiment.v2`) contains:

- classification (`simulation-only`) and the full protocol, including its unit system
- the proposed and baseline model descriptors (assumptions encoded and prose-only, parameters with bounds, unit declaration, invariants, limiting cases, falsification conditions) and the observable definitions
- the research question card and the input specification
- the sampled results with the per-sample ladder, the convergence summary, every integrity check (failures included) and the assessment
- creation time, build source commit, and a SHA-256 digest over the body using the shared `scientific-e13.v1` canonicaliser

The CSV export adds the ladder columns. Use JSON for replay and provenance.

Import accepts at most 256 KB. The app rejects unknown fields, unsupported schemas or protocols, non-finite or out-of-range inputs, bad digests, missing rows, altered checks or statuses, altered question cards, and mismatched results. Replay recomputes every number, every check and the assessment. Numbers must agree to 1e-10 absolute (plus 1e-9 relative); statuses must match exactly; explanatory prose is not compared. A model description that differs from the current build is disclosed as a notice while the computation still agrees.

**Reproducibility is not validity.** A record whose checks failed replays successfully and stays failed. A digest detects unrehashed modification, but anyone can compute a new digest. Recomputation catches fabricated results. It does not authenticate an author or establish physical validity.

### Version 1 records

Records exported under `two-site-coupling-sweep.v1` (`waveform-experiment.v1`) still replay under the v1 protocol: dt versus dt/2, and three checks. They are never reinterpreted as v2. The workbench labels them as legacy records without a ladder, limiting cases, unit declaration or question, and they keep their six-column CSV.

## Development

`src/experiments/engine.ts` owns validation, computation, serialisation and replay for both protocol versions. Checks live in `src/quantum/validation/`; model descriptors in `src/lib/researchModels.ts`; observables in `src/lib/observables.ts`; units in `src/lib/units.ts`. Tests cover:

- controls, limits and their negative controls
- the ladder's regimes
- metadata never passing
- status precedence
- v1 replay from a fixture exported before v2
- tampering with checks and questions
- a mocked broken limit that replays and stays failed

Run `npm run verify` for lint, TypeScript, the test suite, production compilation and `npm run physics:audit`.
